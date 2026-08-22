import { FastifyRequest } from "fastify";
import { prisma } from "../infrastructure/database/prisma";
import { AppError } from "../shared/errors/app-error";

/**
 * Resolves the authenticated organization context.
 *
 * The client selects which organization it wants to act as via the
 * X-Organization-Id header, but that header is only a *selector* — it is
 * never used directly as an authorization boundary. This middleware always
 * re-verifies, against the org_members table, that the JWT-verified user is
 * actually a member of that organization, and derives the role from the DB
 * (never from the client). If verification fails, the request is rejected
 * with 403 and no information about the target organization is revealed.
 */
export async function requireOrganizationContext(request: FastifyRequest): Promise<void> {
  const verifiedUserId = (request as FastifyRequest & { verifiedUserId?: string }).verifiedUserId;
  if (!verifiedUserId) {
    throw AppError.unauthorized();
  }

  const organizationId = request.headers["x-organization-id"];
  if (!organizationId || typeof organizationId !== "string") {
    throw AppError.validation("X-Organization-Id header is required", {
      field: "x-organization-id",
    });
  }

  const membership = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: verifiedUserId } },
  });

  if (!membership) {
    // Deliberately generic — do not reveal whether the org exists at all.
    throw AppError.forbidden("You do not have access to this organization");
  }

  request.auth = {
    userId: verifiedUserId,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}
