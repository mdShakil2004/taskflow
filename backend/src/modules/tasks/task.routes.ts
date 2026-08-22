import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganizationContext } from "../../middleware/tenant.middleware";
import { taskController } from "./task.controller";
import { assignmentRoutesForTask } from "../assignments/assignment.routes";
import { commentRoutesForTask } from "../comments/comment.routes";

/**
 * Nested under /api/v1/projects/:projectId/tasks — listing and creation are
 * inherently scoped to a single project, so the projectId comes from the URL.
 */
export async function taskRoutesForProject(app: FastifyInstance): Promise<void> {
  app.get("/", taskController.list);
  app.post("/", taskController.create);
}

/**
 * Top-level /api/v1/tasks routes for operations addressed by task id
 * directly. Every handler still re-derives the organization boundary via the
 * task -> project -> organization chain in the service layer — the task id
 * alone is never sufficient for authorization.
 */
export async function taskRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireOrganizationContext);

  app.get("/:taskId", taskController.getById);
  app.patch("/:taskId", taskController.update);
  app.delete("/:taskId", taskController.remove);
  app.patch("/bulk-status", taskController.bulkUpdateStatus);

  await app.register(assignmentRoutesForTask, { prefix: "/:taskId/assignments" });
  await app.register(commentRoutesForTask, { prefix: "/:taskId/comments" });
}
