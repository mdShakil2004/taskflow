import { Queue, Worker } from "bullmq";
import { createRedisConnection } from "../src/infrastructure/redis/redis";
import { NOTIFICATION_QUEUE_NAME } from "../src/infrastructure/queue/queue.config";
import { notificationQueue, TaskAssignmentNotificationJob } from "../src/infrastructure/queue/queues";
import { processAssignmentNotification } from "./processors/email.processor";
import { DEAD_LETTER_QUEUE_NAME, OUTBOX_SWEEP_GRACE_MS, OUTBOX_SWEEP_INTERVAL_MS } from "./worker.config";
import { config } from "../src/config";
import { logger } from "../src/shared/utils/logger";
import { prisma } from "../src/infrastructure/database/prisma";

const connection = createRedisConnection();

// Dead-letter queue: a plain BullMQ queue used as a durable record of jobs
// that exhausted all retry attempts. Nothing consumes it automatically —
// it exists so failed notifications are inspectable/replayable rather than
// silently disappearing (BullMQ has no built-in DLQ primitive).
const deadLetterQueue = new Queue(DEAD_LETTER_QUEUE_NAME, { connection });

const worker = new Worker<TaskAssignmentNotificationJob>(
  NOTIFICATION_QUEUE_NAME,
  processAssignmentNotification,
  {
    connection,
    // Bonus: global email rate limit — caps this worker to N jobs per
    // minute. With multiple worker instances sharing the same Redis-backed
    // queue, BullMQ's rate limiter coordinates across all of them (the
    // limiter state lives in Redis, not in worker-local memory), so the cap
    // applies to total throughput regardless of worker count.
    limiter: { max: config.GLOBAL_EMAIL_RATE_LIMIT_PER_MIN, duration: 60_000 },
  }
);

worker.on("completed", async (job) => {
  logger.info({ jobId: job.id, taskId: job.data.taskId }, "Notification job completed");
  await prisma.notificationOutbox
    .update({ where: { id: job.data.outboxId }, data: { status: "dispatched", dispatchedAt: new Date() } })
    .catch(() => undefined); // outbox row may already be marked dispatched by the API path
});

worker.on("failed", async (job, err) => {
  if (!job) return;

  const attemptsMax = job.opts.attempts ?? 1;
  logger.warn(
    { jobId: job.id, taskId: job.data.taskId, attemptsMade: job.attemptsMade, attemptsMax, err: err.message },
    "Notification job attempt failed"
  );

  // Retries are exhausted — route to the dead-letter queue and mark the
  // outbox row failed so it's excluded from further recovery sweeps.
  if (job.attemptsMade >= attemptsMax) {
    await deadLetterQueue.add("dead-letter", { originalJobId: job.id, data: job.data, error: err.message });
    await prisma.notificationOutbox
      .update({
        where: { id: job.data.outboxId },
        data: { status: "failed", attempts: job.attemptsMade, lastError: err.message },
      })
      .catch(() => undefined);
    logger.error({ jobId: job.id, taskId: job.data.taskId }, "Notification job moved to dead-letter queue");
  }
});

/**
 * Recovery sweep for the transactional outbox: publishes any outbox row that
 * is still `pending` after a short grace period, covering the case where the
 * API's immediate enqueue attempt (in assignment.service.ts) failed. This is
 * what makes eventual delivery durable despite Postgres and Redis having no
 * shared distributed transaction — see docs/technical-decisions.md.
 */
async function sweepPendingOutboxRows(): Promise<void> {
  const cutoff = new Date(Date.now() - OUTBOX_SWEEP_GRACE_MS);
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "pending", createdAt: { lt: cutoff } },
    take: 50,
  });

  for (const row of pending) {
    const task = await prisma.task.findUnique({ where: { id: row.taskId } });
    const assignee = await prisma.user.findUnique({ where: { id: row.assigneeId } });
    if (!task || !assignee) continue;

    try {
      await notificationQueue.add("send-assignment-email", {
        outboxId: row.id,
        taskId: row.taskId,
        taskTitle: task.title,
        assigneeId: row.assigneeId,
        assigneeEmail: assignee.email,
      });
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { status: "dispatched", dispatchedAt: new Date() },
      });
      logger.info({ outboxId: row.id }, "Recovered pending outbox row and enqueued notification");
    } catch (err) {
      logger.error({ err, outboxId: row.id }, "Outbox recovery sweep failed to enqueue — will retry next sweep");
    }
  }
}

setInterval(() => {
  sweepPendingOutboxRows().catch((err) => logger.error({ err }, "Outbox sweep crashed"));
}, OUTBOX_SWEEP_INTERVAL_MS);

logger.info("TaskFlow worker started, listening for task-assignment notifications");

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection in worker");
});
