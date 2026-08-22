import { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma";
import { CreateTaskInput, TaskFilterQuery, UpdateTaskInput } from "./task.schema";
import { toSkipTake } from "../../shared/pagination/pagination";

// Every method takes organizationId and enforces it via the task -> project
// -> organization chain (never authorizes by task id alone), per the
// assignment's explicit "never authorize a task only by its task ID" rule.

function buildWhere(
  organizationId: string,
  projectId: string,
  filters: Partial<TaskFilterQuery>
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {
    projectId,
    project: { organizationId, deletedAt: null },
    deletedAt: null,
  };

  if (filters.status) where.status = filters.status as TaskStatus;
  if (filters.priority) where.priority = filters.priority as TaskPriority;
  if (filters.assigneeId) {
    where.assignments = { some: { userId: filters.assigneeId } };
  }
  if (filters.dueFrom || filters.dueTo) {
    where.dueDate = {
      ...(filters.dueFrom ? { gte: filters.dueFrom } : {}),
      ...(filters.dueTo ? { lte: filters.dueTo } : {}),
    };
  }

  return where;
}

export const taskRepository = {
  async list(organizationId: string, projectId: string, filters: TaskFilterQuery) {
    const { skip, take } = toSkipTake(filters);

    // Full-text search uses Postgres's native tsvector/GIN index (see
    // migration 0002) rather than ILIKE, so it scales with a proper index
    // instead of a sequential scan.
    if (filters.search) {
      const [data, totalRows] = await Promise.all([
        prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT t.id FROM tasks t
          JOIN projects p ON p.id = t.project_id
          WHERE t.project_id = ${projectId}
            AND p.organization_id = ${organizationId}
            AND p.deleted_at IS NULL
            AND t.deleted_at IS NULL
            AND t.search_vector @@ plainto_tsquery('english', ${filters.search})
          ORDER BY t.created_at DESC
          OFFSET ${skip} LIMIT ${take}
        `),
        prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint as count FROM tasks t
          JOIN projects p ON p.id = t.project_id
          WHERE t.project_id = ${projectId}
            AND p.organization_id = ${organizationId}
            AND p.deleted_at IS NULL
            AND t.deleted_at IS NULL
            AND t.search_vector @@ plainto_tsquery('english', ${filters.search})
        `),
      ]);
      const ids = data.map((r: { id: string }) => r.id);
      const tasks = ids.length
        ? await prisma.task.findMany({
            where: { id: { in: ids } },
            include: { assignments: true },
          })
        : [];
      // Preserve the relevance/recency order returned by the raw query.
      const byId = new Map(tasks.map((t) => [t.id, t]));
      const ordered = ids.map((id: string) => byId.get(id)).filter(Boolean);
      return { data: ordered, total: Number(totalRows[0]?.count ?? 0) };
    }

    const where = buildWhere(organizationId, projectId, filters);
    const [data, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { assignments: true },
      }),
      prisma.task.count({ where }),
    ]);
    return { data, total };
  },

  findByIdInOrg(organizationId: string, taskId: string) {
    return prisma.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { organizationId, deletedAt: null } },
      include: { assignments: true, project: true },
    });
  },

  create(projectId: string, input: CreateTaskInput) {
    return prisma.task.create({ data: { ...input, projectId } });
  },

  async update(organizationId: string, taskId: string, input: UpdateTaskInput) {
    const result = await prisma.task.updateMany({
      where: { id: taskId, deletedAt: null, project: { organizationId, deletedAt: null } },
      data: input,
    });
    return result.count;
  },

  async softDelete(organizationId: string, taskId: string) {
    const result = await prisma.task.updateMany({
      where: { id: taskId, deletedAt: null, project: { organizationId, deletedAt: null } },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },

  async bulkUpdateStatus(organizationId: string, taskIds: string[], status: TaskStatus) {
    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds }, deletedAt: null, project: { organizationId, deletedAt: null } },
      data: { status },
    });
    return result.count;
  },

  // Single aggregate query (GROUP BY) rather than one query per status.
  async dashboardCounts(organizationId: string, projectId: string) {
    const rows = await prisma.task.groupBy({
      by: ["status"],
      where: { projectId, deletedAt: null, project: { organizationId, deletedAt: null } },
      _count: { _all: true },
    });
    const counts: Record<TaskStatus, number> = { todo: 0, in_progress: 0, review: 0, done: 0 };
    for (const row of rows) counts[row.status] = row._count._all;
    return counts;
  },
};
