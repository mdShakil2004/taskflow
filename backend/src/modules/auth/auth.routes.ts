import { FastifyInstance } from "fastify";
import { authController } from "./auth.controller";
import { config } from "../../config";
import { requireAuth } from "../../middleware/auth.middleware";

// The assignment's rate limit (10 req/min/IP) applies specifically to these
// four auth endpoints, backed by Redis so it holds across multiple API
// instances rather than being process-local.
const authRateLimitConfig = {
  max: config.AUTH_RATE_LIMIT_MAX,
  timeWindow: config.AUTH_RATE_LIMIT_WINDOW_MS,
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/register", { config: { rateLimit: authRateLimitConfig } }, authController.register);
  app.post("/login", { config: { rateLimit: authRateLimitConfig } }, authController.login);
  app.post("/refresh", { config: { rateLimit: authRateLimitConfig } }, authController.refresh);
  app.post("/logout", { config: { rateLimit: authRateLimitConfig } }, authController.logout);

  // Not part of the assignment's mandatory endpoint list, but a necessary
  // addition for any real client: after login, the client has no other way
  // to discover which organization(s) the user can act as, since the JWT
  // deliberately carries no org/role (see technical-decisions.md).
  app.get("/me/organizations", { preHandler: requireAuth }, authController.myOrganizations);
}

