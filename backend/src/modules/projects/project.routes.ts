import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganizationContext } from "../../middleware/tenant.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { projectController } from "./project.controller";
import { taskRoutesForProject } from "../tasks/task.routes";
import { taskService } from "../tasks/task.service";
import { z } from "zod";

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireOrganizationContext);

  app.get("/", projectController.list);
  app.post("/", projectController.create);
  app.get("/:id", projectController.getById);
  app.patch("/:id", projectController.update);
  // Deletion is admin-only per the assignment's RBAC requirement.
  app.delete("/:id", { preHandler: requireRole("org_admin") }, projectController.remove);

  // Task counts grouped by status, via a single aggregate query.
  app.get("/:id/dashboard", async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const counts = await taskService.dashboard(request.auth!.organizationId, id);
    reply.status(200).send(counts);
  });

  // Nested task routes: /projects/:projectId/tasks
  await app.register(taskRoutesForProject, { prefix: "/:projectId/tasks" });
}
