import { prisma } from "../../infrastructure/database/prisma";
import { Prisma } from "@prisma/client";
import { sha256 } from "../../shared/utils/hash";
import { AppError } from "../../shared/errors/app-error";

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  // Lists the organizations a JWT-verified user belongs to. Deliberately
  // requires only requireAuth (not requireOrganizationContext) — this is
  // the one endpoint a client needs before it can even select an org to act
  // as, so it can't itself depend on the X-Organization-Id header.
  listMembershipsForUser(userId: string) {
    return prisma.orgMember.findMany({
      where: { userId },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  createUserWithMembership(params: {
    email: string;
    passwordHash: string;
    fullName: string;
    organizationId?: string;
    organizationName?: string;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email: params.email,
          passwordHash: params.passwordHash,
          fullName: params.fullName,
        },
      });

      let organization;
      if (params.organizationId) {
        organization = await tx.organization.findUnique({ where: { id: params.organizationId } });
        if (!organization) {
          // Thrown inside the transaction so the just-created user is rolled back too.
          throw AppError.notFound("ORGANIZATION_NOT_FOUND", "No organization exists with that id");
        }
      } else {
        organization = await tx.organization.create({ data: { name: params.organizationName! } });
      }

      // The first user to create an org is its admin; anyone joining an
      // existing org by id starts as a plain member.
      const role = params.organizationId ? "member" : "org_admin";

      await tx.orgMember.create({
        data: { organizationId: organization.id, userId: user.id, role },
      });

      return { user, organization, role };
    });
  },

  storeRefreshToken(params: {
    userId: string;
    token: string;
    expiresAt: Date;
  }) {
    return prisma.refreshToken.create({
      data: {
        userId: params.userId,
        tokenHash: sha256(params.token),
        expiresAt: params.expiresAt,
      },
    });
  },

  findActiveRefreshTokenByRawToken(token: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  },

  /** Rotation: revoke the old token row and link it to its replacement. */
  rotateRefreshToken(params: { oldTokenId: string; newTokenId: string }) {
    return prisma.refreshToken.update({
      where: { id: params.oldTokenId },
      data: { revokedAt: new Date(), replacedById: params.newTokenId },
    });
  },

  revokeRefreshTokenByRawToken(token: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllRefreshTokensForUser(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
