import { prisma } from "../../infrastructure/database/prisma";
import { Prisma } from "@prisma/client";

export const assignmentRepository = {
  findTaskInOrg(organizationId: string, taskId: string) {
    return prisma.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { organizationId, deletedAt: null } },
    });
  },

  findMembershipInOrg(organizationId: string, userId: string) {
    return prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
  },

  findExistingAssignment(taskId: string, userId: string) {
    return prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId, userId } },
    });
  },

  getUser(userId: string) {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  /**
   * Persists the assignment AND a notification-outbox row in a single DB
   * transaction, so the two are always consistent with each other even if
   * the subsequent queue publish attempt fails. See technical-decisions.md.
   */
  async createAssignmentWithOutbox(taskId: string, userId: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const assignment = await tx.taskAssignment.create({ data: { taskId, userId } });
      const outboxEntry = await tx.notificationOutbox.create({
        data: { taskId, assigneeId: userId, status: "pending" },
      });
      return { assignment, outboxEntry };
    });
  },

  markOutboxDispatched(outboxId: string) {
    return prisma.notificationOutbox.update({
      where: { id: outboxId },
      data: { status: "dispatched", dispatchedAt: new Date() },
    });
  },

  removeAssignment(taskId: string, userId: string) {
    return prisma.taskAssignment.deleteMany({ where: { taskId, userId } });
  },
};
