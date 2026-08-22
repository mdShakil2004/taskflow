import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildTestApp, truncateAll } from "./test-helpers";
import { prisma } from "../../src/infrastructure/database/prisma";

describe("Auth: login flow", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await truncateAll();
    app = await buildTestApp();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers a new user and organization, returning tokens", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "founder@example.com",
        password: "StrongPass123!",
        fullName: "Founder Person",
        organizationName: "Acme Inc",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.organization.role).toBe("org_admin");
  });

  it("rejects registering the same email twice", async () => {
    const payload = {
      email: "dup@example.com",
      password: "StrongPass123!",
      fullName: "Dup User",
      organizationName: "Dup Org",
    };
    await app.inject({ method: "POST", url: "/auth/register", payload });
    const res = await app.inject({ method: "POST", url: "/auth/register", payload });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("logs in with valid credentials", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "login@example.com",
        password: "StrongPass123!",
        fullName: "Login User",
        organizationName: "Login Org",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login@example.com", password: "StrongPass123!" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeDefined();
  });

  it("rejects an invalid password without revealing whether the email exists", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "wrongpass@example.com",
        password: "StrongPass123!",
        fullName: "Wrong Pass",
        organizationName: "WP Org",
      },
    });

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "wrongpass@example.com", password: "not-the-password" },
    });
    const unknownEmail = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "no-such-user@example.com", password: "whatever" },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    expect(wrongPassword.json().code).toBe(unknownEmail.json().code);
  });

  it("rejects malformed registration input with a validation error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: "123" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  it("issues a new token pair via refresh and rotates the old refresh token", async () => {
    const registerRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "refresh@example.com",
        password: "StrongPass123!",
        fullName: "Refresh User",
        organizationName: "Refresh Org",
      },
    });
    const { refreshToken } = registerRes.json();

    const refreshRes = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.json().refreshToken).not.toBe(refreshToken);

    // The rotated-out token must no longer be usable.
    const reuseRes = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken },
    });
    expect(reuseRes.statusCode).toBe(401);
  });
});
