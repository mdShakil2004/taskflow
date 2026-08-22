import { FastifyInstance } from "fastify";
import { assignmentController } from "./assignment.controller";

// Registered as a nested plugin under /api/v1/tasks/:taskId/assignments —
// the parent taskRoutes plugin already applies requireAuth +
// requireOrganizationContext, so no need to repeat those hooks here.
export async function assignmentRoutesForTask(app: FastifyInstance): Promise<void> {
  app.post("/", assignmentController.assign);
  app.delete("/:userId", assignmentController.unassign);
}
