import { prisma } from "../../infrastructure/database/prisma";

export const organizationRepository = {
  findById(id: string) {
    return prisma.organization.findUnique({ where: { id } });
  },
};
