import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganizationContext } from "../../middleware/tenant.middleware";
import { jobController } from "./job.controller";

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireOrganizationContext);

  app.get("/:id", jobController.getStatus);
}
