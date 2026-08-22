import { prisma } from "../../infrastructure/database/prisma";
import { OrgRole } from "@prisma/client";

export const memberRepository = {
  listByOrganization(organizationId: string) {
    return prisma.orgMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  findByOrgAndUser(organizationId: string, userId: string) {
    return prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
  },

  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  addMember(organizationId: string, userId: string, role: OrgRole) {
    return prisma.orgMember.create({ data: { organizationId, userId, role } });
  },

  updateRole(organizationId: string, userId: string, role: OrgRole) {
    return prisma.orgMember.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: { role },
    });
  },

  removeMember(organizationId: string, userId: string) {
    return prisma.orgMember.delete({
      where: { organizationId_userId: { organizationId, userId } },
    });
  },

  countAdmins(organizationId: string) {
    return prisma.orgMember.count({ where: { organizationId, role: "org_admin" } });
  },
};
