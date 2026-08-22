import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganizationContext } from "../../middleware/tenant.middleware";
import { organizationController } from "./organization.controller";

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireOrganizationContext);

  app.get("/me", organizationController.getCurrent);
}
