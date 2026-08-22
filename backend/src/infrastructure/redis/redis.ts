import Redis from "ioredis";
import { config } from "../../config";

// Shared ioredis connection factory. BullMQ requires maxRetriesPerRequest:
// null on connections used for blocking operations (workers/queues).
export function createRedisConnection() {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export const redis = createRedisConnection();
