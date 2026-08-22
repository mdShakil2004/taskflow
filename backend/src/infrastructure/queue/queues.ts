import { Queue } from "bullmq";
import { createRedisConnection } from "../redis/redis";
import {
  NOTIFICATION_QUEUE_NAME,
  NOTIFICATION_JOB_ATTEMPTS,
  NOTIFICATION_JOB_BACKOFF_MS,
} from "./queue.config";

export interface TaskAssignmentNotificationJob {
  outboxId: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeEmail: string;
}

const connection = createRedisConnection();

export const notificationQueue = new Queue<TaskAssignmentNotificationJob>(
  NOTIFICATION_QUEUE_NAME,
  {
    connection,
    defaultJobOptions: {
      attempts: NOTIFICATION_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: NOTIFICATION_JOB_BACKOFF_MS },
      // Keep a bounded history so Redis memory doesn't grow unbounded, while
      // still leaving enough completed/failed jobs around for GET /jobs/:id.
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    },
  }
);
