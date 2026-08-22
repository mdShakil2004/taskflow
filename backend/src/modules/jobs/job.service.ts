import { notificationQueue } from "../../infrastructure/queue/queues";
import { AppError } from "../../shared/errors/app-error";

// Maps BullMQ's internal job states onto the four statuses the assignment
// requires the API to expose: pending, active, completed, failed. BullMQ
// internals (e.g. "waiting", "delayed", "waiting-children") are intentionally
// collapsed into "pending" so the client never has to understand queue internals.
const STATE_TO_API_STATUS: Record<string, "pending" | "active" | "completed" | "failed"> = {
  waiting: "pending",
  delayed: "pending",
  "waiting-children": "pending",
  active: "active",
  completed: "completed",
  failed: "failed",
};

export const jobService = {
  async getStatus(jobId: string) {
    const job = await notificationQueue.getJob(jobId);
    if (!job) {
      throw AppError.notFound("JOB_NOT_FOUND", "Job not found");
    }

    const state = await job.getState();
    const status = STATE_TO_API_STATUS[state] ?? "pending";

    return {
      jobId: job.id,
      status,
      metadata: {
        attemptsMade: job.attemptsMade,
        // Undefined when the job hasn't failed — omit noisy nulls.
        failedReason: job.failedReason || undefined,
        data: job.data,
        finishedOn: job.finishedOn ?? null,
        processedOn: job.processedOn ?? null,
      },
    };
  },
};
