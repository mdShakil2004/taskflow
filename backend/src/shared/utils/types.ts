import { OrgRole } from "@prisma/client";

// Authenticated request context, resolved server-side on every request:
// - userId comes from a verified JWT.
// - organizationId/role come from a DB lookup against org_members, keyed by
//   userId + the client-selected org (see middleware/tenant.middleware.ts).
// The client-selected org is only a *selector*; it is never trusted as an
// authorization decision by itself.
export interface AuthContext {
  userId: string;
  organizationId: string;
  role: OrgRole;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
