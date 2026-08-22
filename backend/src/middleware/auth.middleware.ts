import { FastifyRequest } from "fastify";
import { AppError } from "../shared/errors/app-error";
import { verifyAccessToken } from "../shared/utils/jwt";

/**
 * Verifies the JWT access token from the Authorization header and attaches
 * the raw userId to the request. Does NOT resolve organization/role — that
 * happens in tenant.middleware.ts via a DB-backed membership check, rather
 * than trusting the token or any client-supplied header on its own.
 */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw AppError.unauthorized("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    (request as FastifyRequest & { verifiedUserId?: string }).verifiedUserId = payload.sub;
  } catch {
    throw AppError.unauthorized("Invalid or expired access token");
  }
}
