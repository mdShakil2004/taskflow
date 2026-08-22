import { FastifyRequest } from "fastify";
import { OrgRole } from "@prisma/client";
import { AppError } from "../shared/errors/app-error";

/**
 * Returns a Fastify preHandler that enforces the authenticated user holds
 * one of the allowed roles within the current organization context. Centralized
 * here so role checks are never duplicated ad hoc inside individual controllers.
 */
export function requireRole(...allowedRoles: OrgRole[]) {
  return async function roleGuard(request: FastifyRequest): Promise<void> {
    if (!request.auth) {
      throw AppError.unauthorized();
    }
    if (!allowedRoles.includes(request.auth.role)) {
      throw AppError.forbidden("This action requires a higher role");
    }
  };
}
