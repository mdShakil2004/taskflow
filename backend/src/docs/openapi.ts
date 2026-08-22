import { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import { FastifySwaggerUiOptions } from "@fastify/swagger-ui";

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: "TaskFlow API",
      description:
        "Multi-tenant project management backend. Authenticate via /auth/login, then send " +
        "the returned access token as `Authorization: Bearer <token>` and select your " +
        "organization via the `X-Organization-Id` header on every org-scoped request.",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000", description: "Local" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        organizationHeader: { type: "apiKey", in: "header", name: "X-Organization-Id" },
      },
    },
    security: [{ bearerAuth: [], organizationHeader: [] }],
    tags: [
      { name: "Auth", description: "Registration, login, token refresh, logout" },
      { name: "Organizations", description: "Current organization context" },
      { name: "Members", description: "Organization membership management (RBAC)" },
      { name: "Projects", description: "Project CRUD" },
      { name: "Tasks", description: "Task CRUD, filters, dashboard, bulk update" },
      { name: "Assignments", description: "Assign/unassign tasks to users" },
      { name: "Comments", description: "Task comments" },
      { name: "Jobs", description: "Background job status" },
    ],
  },
};

export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: "/docs",
  uiConfig: { docExpansion: "list", deepLinking: true },
};
