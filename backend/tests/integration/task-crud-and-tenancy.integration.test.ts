import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, truncateAll } from "./test-helpers";
import { prisma } from "../../src/infrastructure/database/prisma";

async function registerAndLogin(app: FastifyInstance, email: string, orgName: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password: "StrongPass123!", fullName: "Test User", organizationName: orgName },
  });
  const body = res.json();
  return {
    accessToken: body.accessToken as string,
    organizationId: body.organization.id as string,
  };
}

function authHeaders(accessToken: string, organizationId: string) {
  return { authorization: `Bearer ${accessToken}`, "x-organization-id": organizationId };
}

describe("Task CRUD and cross-tenant isolation", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await truncateAll();
    app = await buildTestApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("performs full project + task CRUD within a single organization", async () => {
    const userA = await registerAndLogin(app, "crud-a@example.com", "CRUD Org A");

    const createProject = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(userA.accessToken, userA.organizationId),
      payload: { name: "Website Relaunch" },
    });
    expect(createProject.statusCode).toBe(201);
    const projectId = createProject.json().id;

    const createTask = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
      payload: { title: "Design homepage", priority: "high" },
    });
    expect(createTask.statusCode).toBe(201);
    const taskId = createTask.json().id;

    const getTask = await app.inject({
      method: "GET",
      url: `/api/v1/tasks/${taskId}`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
    });
    expect(getTask.statusCode).toBe(200);
    expect(getTask.json().title).toBe("Design homepage");

    const updateTask = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${taskId}`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
      payload: { status: "in_progress" },
    });
    expect(updateTask.statusCode).toBe(200);
    expect(updateTask.json().status).toBe("in_progress");

    const listTasks = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectId}/tasks`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
    });
    expect(listTasks.statusCode).toBe(200);
    expect(listTasks.json().total).toBe(1);

    const deleteTask = await app.inject({
      method: "DELETE",
      url: `/api/v1/tasks/${taskId}`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
    });
    expect(deleteTask.statusCode).toBe(204);

    const getAfterDelete = await app.inject({
      method: "GET",
      url: `/api/v1/tasks/${taskId}`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
    });
    expect(getAfterDelete.statusCode).toBe(404);
  });

  it("returns 403 when a user from Org A attempts to read Org B's project", async () => {
    const userA = await registerAndLogin(app, "tenant-a@example.com", "Tenant Org A");
    const userB = await registerAndLogin(app, "tenant-b@example.com", "Tenant Org B");

    const projectB = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(userB.accessToken, userB.organizationId),
      payload: { name: "Org B Secret Project" },
    });
    const projectBId = projectB.json().id;

    // User A attempts to read Org B's project using Org A's org context —
    // the tenant middleware should reject before the project lookup even runs.
    const crossTenantRead = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectBId}`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
    });
    expect(crossTenantRead.statusCode).toBe(404); // scoped query finds nothing, no data leaked

    // User A attempts to select Org B as their context directly (impersonation attempt).
    const impersonation = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${projectBId}`,
      headers: authHeaders(userA.accessToken, userB.organizationId),
    });
    expect(impersonation.statusCode).toBe(403);
    expect(impersonation.json().code).toBe("FORBIDDEN");
  });

  it("returns 403 when a user from Org A attempts to update Org B's task", async () => {
    const userA = await registerAndLogin(app, "tenant-a2@example.com", "Tenant Org A2");
    const userB = await registerAndLogin(app, "tenant-b2@example.com", "Tenant Org B2");

    const projectB = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(userB.accessToken, userB.organizationId),
      payload: { name: "Org B Project" },
    });
    const taskB = await app.inject({
      method: "POST",
      url: `/api/v1/projects/${projectB.json().id}/tasks`,
      headers: authHeaders(userB.accessToken, userB.organizationId),
      payload: { title: "Org B Task" },
    });
    const taskBId = taskB.json().id;

    const crossTenantUpdate = await app.inject({
      method: "PATCH",
      url: `/api/v1/tasks/${taskBId}`,
      headers: authHeaders(userA.accessToken, userB.organizationId),
      payload: { status: "done" },
    });
    expect(crossTenantUpdate.statusCode).toBe(403);
  });

  it("rejects a member (non-admin) attempting to delete a project", async () => {
    const admin = await registerAndLogin(app, "rbac-admin@example.com", "RBAC Org");

    // Directly create a second, member-role user in the same org to avoid
    // adding a public "invite" endpoint just for the test.
    const memberUser = await prisma.user.create({
      data: {
        email: "rbac-member@example.com",
        passwordHash: (await import("bcrypt")).default.hashSync("StrongPass123!", 12),
        fullName: "Member User",
      },
    });
    await prisma.orgMember.create({
      data: { organizationId: admin.organizationId, userId: memberUser.id, role: "member" },
    });
    const memberLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "rbac-member@example.com", password: "StrongPass123!" },
    });
    const memberToken = memberLogin.json().accessToken;

    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(admin.accessToken, admin.organizationId),
      payload: { name: "Admin-owned project" },
    });

    const memberDeleteAttempt = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.json().id}`,
      headers: authHeaders(memberToken, admin.organizationId),
    });
    expect(memberDeleteAttempt.statusCode).toBe(403);

    const adminDelete = await app.inject({
      method: "DELETE",
      url: `/api/v1/projects/${project.json().id}`,
      headers: authHeaders(admin.accessToken, admin.organizationId),
    });
    expect(adminDelete.statusCode).toBe(204);
  });

  it("validates task filter query parameters and rejects invalid enum values", async () => {
    const userA = await registerAndLogin(app, "filters@example.com", "Filters Org");
    const project = await app.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: authHeaders(userA.accessToken, userA.organizationId),
      payload: { name: "Filter Test Project" },
    });

    const invalidStatus = await app.inject({
      method: "GET",
      url: `/api/v1/projects/${project.json().id}/tasks?status=not_a_real_status`,
      headers: authHeaders(userA.accessToken, userA.organizationId),
    });
    expect(invalidStatus.statusCode).toBe(400);
    expect(invalidStatus.json().code).toBe("VALIDATION_ERROR");
  });
});
