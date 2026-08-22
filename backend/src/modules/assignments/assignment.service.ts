import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/utils/logger";
import { notificationQueue } from "../../infrastructure/queue/queues";
import { redis } from "../../infrastructure/redis/redis";
import { assignmentRepository } from "./assignment.repository";

const DEDUP_WINDOW_SECONDS = 5;

export const assignmentService = {
  async assign(organizationId: string, taskId: string, targetUserId: string) {
    const task = await assignmentRepository.findTaskInOrg(organizationId, taskId);
    if (!task) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }

    // The assignee must belong to the same organization as the task —
    // resolved via a DB-backed membership check, never trusted from input.
    const membership = await assignmentRepository.findMembershipInOrg(organizationId, targetUserId);
    if (!membership) {
      throw AppError.notFound("MEMBER_NOT_FOUND", "Target user is not a member of this organization");
    }

    const existing = await assignmentRepository.findExistingAssignment(taskId, targetUserId);
    if (existing) {
      throw AppError.conflict("DUPLICATE_ASSIGNMENT", "User is already assigned to this task");
    }

    // Bonus: deduplicate notification bursts (e.g. accidental double-click)
    // within a 5-second window using a Redis SETNX-style lock. This guards
    // the *notification*, not the assignment itself (which is already
    // uniqueness-protected at the DB level above).
    const dedupKey = `assignment-notify-dedup:${taskId}:${targetUserId}`;
    const acquired = await redis.set(dedupKey, "1", "EX", DEDUP_WINDOW_SECONDS, "NX");

    const { assignment, outboxEntry } = await assignmentRepository.createAssignmentWithOutbox(
      taskId,
      targetUserId
    );

    let jobId: string | undefined;

    if (acquired === "OK") {
      const assignee = await assignmentRepository.getUser(targetUserId);
      try {
        // Attempt immediate enqueue so the happy path delivers the
        // notification without waiting for the recovery sweep. If this
        // throws (e.g. Redis briefly unavailable), the assignment we already
        // committed above is NOT rolled back — the outbox row stays
        // `pending` and the worker's recovery sweep will publish it later.
        // This means the API can only guarantee "notification will
        // eventually be sent", not "notification was already queued", on
        // the failure path — a deliberate, documented tradeoff (see
        // docs/technical-decisions.md) since Postgres and Redis cannot share
        // a real distributed transaction.
        const job = await notificationQueue.add("send-assignment-email", {
          outboxId: outboxEntry.id,
          taskId,
          taskTitle: task.title,
          assigneeId: targetUserId,
          assigneeEmail: assignee!.email,
        });
        jobId = job.id;
        await assignmentRepository.markOutboxDispatched(outboxEntry.id);
      } catch (err) {
        logger.error(
          { err, outboxId: outboxEntry.id, taskId },
          "Immediate queue enqueue failed — leaving outbox row pending for recovery sweep"
        );
      }
    }

    return { assignment, jobId };
  },

  async unassign(organizationId: string, taskId: string, targetUserId: string) {
    const task = await assignmentRepository.findTaskInOrg(organizationId, taskId);
    if (!task) {
      throw AppError.notFound("TASK_NOT_FOUND", "Task not found");
    }

    const existing = await assignmentRepository.findExistingAssignment(taskId, targetUserId);
    if (!existing) {
      throw AppError.notFound("ASSIGNMENT_NOT_FOUND", "Assignment not found");
    }

    await assignmentRepository.removeAssignment(taskId, targetUserId);
  },
};
