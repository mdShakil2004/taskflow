import { Job } from "bullmq";
import { z } from "zod";
import { sendMockEmail } from "../../src/infrastructure/email/email.service";
import { logger } from "../../src/shared/utils/logger";
import { TaskAssignmentNotificationJob } from "../../src/infrastructure/queue/queues";

const jobPayloadSchema = z.object({
  outboxId: z.string().uuid(),
  taskId: z.string().uuid(),
  taskTitle: z.string(),
  assigneeId: z.string().uuid(),
  assigneeEmail: z.string().email(),
});

/**
 * Processes a single task-assignment-notification job. Throws on any
 * failure so BullMQ applies the configured retry/backoff policy; after
 * attempts are exhausted, the queue's 'failed' listener (see worker.ts)
 * routes the job to the dead-letter queue.
 */
export async function processAssignmentNotification(
  job: Job<TaskAssignmentNotificationJob>
): Promise<{ delivered: true }> {
  const payload = jobPayloadSchema.parse(job.data);

  logger.info(
    { jobId: job.id, taskId: payload.taskId, attempt: job.attemptsMade + 1 },
    "Processing task assignment notification"
  );

  await sendMockEmail({
    to: payload.assigneeEmail,
    subject: `You were assigned: ${payload.taskTitle}`,
    body: `You have been assigned to the task "${payload.taskTitle}".`,
  });

  return { delivered: true };
}
