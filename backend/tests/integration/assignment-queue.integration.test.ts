import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, truncateAll } from "./test-helpers";
import { prisma } from "../../src/infrastructure/database/prisma";
import { notificationQueue } from "../../src/infrastructure/queue/queues";

async function registerAndLogin(app: FastifyInstance, email: string, orgName: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "StrongPass123!", fullName: "Test User", organizationName: orgName },
  });
  const body = res.json();
  return { accessToken: body.accessToken as string, organizationId: body.organization.id as string, userId: body.user.id as string };
}

function authHeaders(accessToken: string, organizationId: string) {
  return { authorization: `Bearer ${accessToken}`, "x-organization-id": organizationId };
}

describe("Task assignment -> BullMQ job creation", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await truncateAll();
    await notificationQueue.drain();
    app = await buildTestApp();
  });

  afterAll(async () => {
    await notificationQueue.close();
    await prisma.$disconnect();
  });

  it("creates a BullMQ job when a task is assigned, retrievable via GET /jobs/:id", async () => {
    const owner = await registerAndLogin(app, "queue-owner@example.com", "Queue Org");

    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { name: "Queue Test Project" },
    });
    const task = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.json().id}/tasks`,
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { title: "Task needing an owner" },
    });

    const assignRes = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${task.json().id}/assignments`,
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { userId: owner.userId },
    });

    expect(assignRes.statusCode).toBe(201);
    const jobId = assignRes.json().jobId;
    expect(jobId).toBeTruthy();

    const job = await notificationQueue.getJob(jobId);
    expect(job).not.toBeNull();
    expect(job!.data.taskId).toBe(task.json().id);
    expect(job!.data.assigneeId).toBe(owner.userId);

    const jobStatusRes = await app.inject({
      method: "GET",
      url: `/jobs/${jobId}`,
      headers: authHeaders(owner.accessToken, owner.organizationId),
    });
    expect(jobStatusRes.statusCode).toBe(200);
    expect(["pending", "active", "completed"]).toContain(jobStatusRes.json().status);
  });

  it("rejects assigning a user who is not a member of the task's organization", async () => {
    const orgA = await registerAndLogin(app, "assign-a@example.com", "Assign Org A");
    const orgB = await registerAndLogin(app, "assign-b@example.com", "Assign Org B");

    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(orgA.accessToken, orgA.organizationId),
      payload: { name: "Assign Org A Project" },
    });
    const task = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.json().id}/tasks`,
      headers: authHeaders(orgA.accessToken, orgA.organizationId),
      payload: { title: "Org A Task" },
    });

    const crossOrgAssign = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${task.json().id}/assignments`,
      headers: authHeaders(orgA.accessToken, orgA.organizationId),
      payload: { userId: orgB.userId },
    });

    expect(crossOrgAssign.statusCode).toBe(404);
    expect(crossOrgAssign.json().code).toBe("MEMBER_NOT_FOUND");
  });

  it("rejects a duplicate assignment of the same user to the same task", async () => {
    const owner = await registerAndLogin(app, "dup-assign@example.com", "Dup Assign Org");
    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { name: "Dup Assign Project" },
    });
    const task = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${project.json().id}/tasks`,
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { title: "Dup Assign Task" },
    });

    await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${task.json().id}/assignments`,
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { userId: owner.userId },
    });
    const secondAttempt = await app.inject({
      method: "POST",
      url: `/api/v1/tasks/${task.json().id}/assignments`,
      headers: authHeaders(owner.accessToken, owner.organizationId),
      payload: { userId: owner.userId },
    });

    expect(secondAttempt.statusCode).toBe(409);
    expect(secondAttempt.json().code).toBe("DUPLICATE_ASSIGNMENT");
  });
});
