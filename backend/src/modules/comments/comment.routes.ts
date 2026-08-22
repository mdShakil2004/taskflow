import { FastifyInstance } from "fastify";
import { commentController } from "./comment.controller";

// Nested under /api/v1/tasks/:taskId/comments; parent taskRoutes plugin
// already applies auth + tenant-context hooks.
export async function commentRoutesForTask(app: FastifyInstance): Promise<void> {
  app.get("/", commentController.list);
  app.post("/", commentController.create);
}
