import { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/infrastructure/database/prisma";
import bcrypt from "bcrypt";

/**
 * Test isolation strategy: each test file truncates every application table
 * before it runs (see beforeEach in the test files), rather than sharing
 * mutable fixture state between tests or relying on transaction rollback
 * (which doesn't compose cleanly with Fastify's own connection pooling).
 * Tests are expected to run against a dedicated TEST database — see
 * docs/technical-decisions.md "Test isolation strategy" and the README.
 */
export async function truncateAll(): Promise<void> {
  await prisma.$transaction([
    prisma.comment.deleteMany(),
    prisma.taskAssignment.deleteMany(),
    prisma.notificationOutbox.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.orgMember.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function buildTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function createOrgWithAdmin(orgName: string, email: string, password = "TestPass123!") {
  const passwordHash = await bcrypt.hash(password, 12);
  const org = await prisma.organization.create({ data: { name: orgName } });
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName: "Test Admin" },
  });
  await prisma.orgMember.create({
    data: { organizationId: org.id, userId: user.id, role: "org_admin" },
  });
  return { org, user, password };
}
