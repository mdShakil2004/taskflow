import { prisma } from "../../infrastructure/database/prisma";
import { CreateProjectInput, UpdateProjectInput } from "./project.schema";
import { PaginationQuery, toSkipTake } from "../../shared/pagination/pagination";

// Every query here is scoped by organizationId, which the caller must supply
// from request.auth.organizationId — never from a client-provided value.
export const projectRepository = {
  async list(organizationId: string, pagination: PaginationQuery) {
    const where = { organizationId, deletedAt: null };
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      prisma.project.count({ where }),
    ]);
    return { data, total };
  },

  findByIdInOrg(organizationId: string, id: string) {
    // Both id AND organizationId are part of the lookup itself, not an
    // afterthought check — a project belonging to another org simply will
    // not be found, rather than being fetched and then filtered.
    return prisma.project.findFirst({ where: { id, organizationId, deletedAt: null } });
  },

  create(organizationId: string, input: CreateProjectInput) {
    return prisma.project.create({ data: { ...input, organizationId } });
  },

  update(organizationId: string, id: string, input: UpdateProjectInput) {
    return prisma.project.updateMany({ where: { id, organizationId, deletedAt: null }, data: input });
  },

  softDelete(organizationId: string, id: string) {
    return prisma.project.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  },
};
