import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireOrganizationContext } from "../../middleware/tenant.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { memberController } from "./member.controller";

export async function memberRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireOrganizationContext);

  app.get("/", memberController.list);
  app.post("/", { preHandler: requireRole("org_admin") }, memberController.add);
  app.patch("/:userId", { preHandler: requireRole("org_admin") }, memberController.updateRole);
  app.delete("/:userId", { preHandler: requireRole("org_admin") }, memberController.remove);
}
