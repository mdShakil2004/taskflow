import { prisma } from "../../infrastructure/database/prisma";

export const commentRepository = {
  // Task lookup is scoped through project -> organization, same pattern as
  // every other org-owned resource — never trust the task id alone.
  findTaskInOrg(organizationId: string, taskId: string) {
    return prisma.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { organizationId, deletedAt: null } },
    });
  },

  list(taskId: string) {
    return prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  create(taskId: string, authorId: string, body: string) {
    return prisma.comment.create({
      data: { taskId, authorId, body },
      include: { author: { select: { id: true, fullName: true, email: true } } },
    });
  },
};
