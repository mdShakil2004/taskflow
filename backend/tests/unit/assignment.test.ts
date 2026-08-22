import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock every I/O boundary so this is a true unit test of the service's
// validation logic, not an integration test in disguise.
vi.mock("../../src/modules/assignments/assignment.repository", () => ({
  assignmentRepository: {
    findTaskInOrg: vi.fn(),
    findMembershipInOrg: vi.fn(),
    findExistingAssignment: vi.fn(),
    getUser: vi.fn(),
    createAssignmentWithOutbox: vi.fn(),
    markOutboxDispatched: vi.fn(),
    removeAssignment: vi.fn(),
  },
}));
vi.mock("../../src/infrastructure/queue/queues", () => ({
  notificationQueue: { add: vi.fn().mockResolvedValue({ id: "job-1" }) },
}));
vi.mock("../../src/infrastructure/redis/redis", () => ({
  redis: { set: vi.fn().mockResolvedValue("OK") },
}));

import { assignmentRepository } from "../../src/modules/assignments/assignment.repository";
import { assignmentService } from "../../src/modules/assignments/assignment.service";
import { AppError } from "../../src/shared/errors/app-error";

const ORG_ID = "org-1";
const TASK_ID = "task-1";
const USER_ID = "user-1";

describe("assignmentService.assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws TASK_NOT_FOUND when the task does not belong to the org", async () => {
    (assignmentRepository.findTaskInOrg as any).mockResolvedValue(null);

    await expect(assignmentService.assign(ORG_ID, TASK_ID, USER_ID)).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("throws MEMBER_NOT_FOUND when the assignee is not a member of the org", async () => {
    (assignmentRepository.findTaskInOrg as any).mockResolvedValue({ id: TASK_ID, title: "T" });
    (assignmentRepository.findMembershipInOrg as any).mockResolvedValue(null);

    await expect(assignmentService.assign(ORG_ID, TASK_ID, USER_ID)).rejects.toMatchObject({
      code: "MEMBER_NOT_FOUND",
    });
  });

  it("throws DUPLICATE_ASSIGNMENT when the assignment already exists", async () => {
    (assignmentRepository.findTaskInOrg as any).mockResolvedValue({ id: TASK_ID, title: "T" });
    (assignmentRepository.findMembershipInOrg as any).mockResolvedValue({ role: "member" });
    (assignmentRepository.findExistingAssignment as any).mockResolvedValue({ id: "existing" });

    await expect(assignmentService.assign(ORG_ID, TASK_ID, USER_ID)).rejects.toMatchObject({
      code: "DUPLICATE_ASSIGNMENT",
    });
  });

  it("creates the assignment and enqueues a notification job on the happy path", async () => {
    (assignmentRepository.findTaskInOrg as any).mockResolvedValue({ id: TASK_ID, title: "Ship it" });
    (assignmentRepository.findMembershipInOrg as any).mockResolvedValue({ role: "member" });
    (assignmentRepository.findExistingAssignment as any).mockResolvedValue(null);
    (assignmentRepository.getUser as any).mockResolvedValue({ id: USER_ID, email: "u@example.com" });
    (assignmentRepository.createAssignmentWithOutbox as any).mockResolvedValue({
      assignment: { id: "assignment-1", taskId: TASK_ID, userId: USER_ID },
      outboxEntry: { id: "outbox-1" },
    });

    const result = await assignmentService.assign(ORG_ID, TASK_ID, USER_ID);

    expect(result.assignment.id).toBe("assignment-1");
    expect(result.jobId).toBe("job-1");
    expect(assignmentRepository.markOutboxDispatched).toHaveBeenCalledWith("outbox-1");
  });

  it("wraps thrown errors as AppError instances with a stable error code", async () => {
    (assignmentRepository.findTaskInOrg as any).mockResolvedValue(null);
    try {
      await assignmentService.assign(ORG_ID, TASK_ID, USER_ID);
      throw new Error("expected assign() to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });
});

describe("assignmentService.unassign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws ASSIGNMENT_NOT_FOUND when no assignment exists", async () => {
    (assignmentRepository.findTaskInOrg as any).mockResolvedValue({ id: TASK_ID });
    (assignmentRepository.findExistingAssignment as any).mockResolvedValue(null);

    await expect(assignmentService.unassign(ORG_ID, TASK_ID, USER_ID)).rejects.toMatchObject({
      code: "ASSIGNMENT_NOT_FOUND",
    });
  });
});
