# TaskFlow — Requirement Checklist

Every item below is implemented in this repository and, where applicable, covered by automated tests.

> **Bonus** items are explicitly marked.

---

## Technology

* [x] Node.js + TypeScript + Fastify
* [x] PostgreSQL only
* [x] Redis + BullMQ
* [x] Prisma ORM
* [x] Docker Compose:

  * API
  * Worker
  * PostgreSQL
  * Redis

---

# Task 01 — Data Modeling & Database

* [x] `users`, `organizations`, `org_members`, `projects`, `tasks`, `task_assignments`, `comments`
* [x] Foreign keys with documented `CASCADE` / `RESTRICT` behavior
* [x] Projects reference organizations
* [x] Tasks reference projects
* [x] `task_assignments` references tasks and users
* [x] `comments` references tasks and users
* [x] PostgreSQL enums for task status and priority
* [x] Query-pattern indexes documented in `prisma/schema.prisma` and migration SQL
* [x] Prisma migrations
* [x] Seed data:

  * 2 organizations
  * 5 users
  * Multiple projects
  * 15 tasks across both organizations
  * Varied statuses and priorities
  * Assignments
  * Comments
* [x] **Bonus:** Soft delete using `deleted_at` on projects and tasks
* [x] **Bonus:** PostgreSQL full-text search on task title and description using generated `tsvector` + GIN index

---

# Task 02 — Authentication & Authorization

* [x] `POST /auth/register`
* [x] `POST /auth/login`
* [x] `POST /auth/refresh`
* [x] `POST /auth/logout`
* [x] `GET /auth/me/organizations`
* [x] bcrypt password hashing with cost factor ≥ 12
* [x] Access JWT with 15-minute TTL
* [x] Refresh token with 7-day TTL
* [x] Refresh tokens stored as hashes in the database
* [x] Refresh-token revocation
* [x] Roles:

  * `org_admin`
  * `member`
* [x] Organization admins can manage members
* [x] Organization admins can delete projects
* [x] Members cannot perform admin-only operations
* [x] Authentication middleware attaches the authenticated user and organization context
* [x] Organization membership is verified against PostgreSQL
* [x] Service-layer queries are scoped using the authenticated `organizationId`
* [x] Client-provided organization IDs are never trusted directly
* [x] Cross-tenant access returns `403 Forbidden`
* [x] Cross-tenant data is not exposed
* [x] Authentication endpoints are rate-limited to 10 requests/minute/IP using Redis
* [x] **Bonus:** Refresh-token rotation
* [x] **Bonus:** Logout from all devices

### Why `/auth/me/organizations`?

The endpoint is an additional usability endpoint rather than a mandatory assignment endpoint.

The JWT intentionally does not contain organization information, so a client needs a way to discover the organizations associated with the authenticated user after login.

---

# Task 03 — REST API: Projects & Tasks

## Projects

* [x] Full project CRUD
* [x] Every project belongs to the authenticated user's organization
* [x] Organization-scoped authorization

## Tasks

* [x] Full task CRUD
* [x] Every task belongs to a project
* [x] Every task's project belongs to the authenticated user's organization
* [x] Status filtering
* [x] Priority filtering
* [x] Assignee filtering
* [x] Due-date range filtering
* [x] Offset pagination
* [x] Pagination response:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

* [x] Zod validation for:

  * Request bodies
  * Query parameters
  * Route parameters
* [x] Consistent error response:

```json
{
  "error": "...",
  "code": "...",
  "details": {}
}
```

* [x] Task assignment endpoint
* [x] Task unassignment endpoint
* [x] Assignee must belong to the same organization
* [x] Project dashboard with task counts grouped by status
* [x] Dashboard aggregation performed through a single database `groupBy` query
* [x] **Bonus:** Bulk task status update
* [x] **Bonus:** Full-text task search using the `search` query parameter

---

# Task 04 — Background Jobs & Notifications

* [x] Redis + BullMQ notification queue
* [x] Task assignment persisted before the response
* [x] Notification job enqueued on the successful path before the response
* [x] Documented fallback when queue submission fails
* [x] Documented PostgreSQL/Redis partial-failure consistency strategy
* [x] Dedicated background worker process
* [x] Worker processes notification jobs independently of the API
* [x] Mock email notification
* [x] 3 retries after the initial attempt
* [x] 4 total attempts
* [x] Exponential backoff:

  * 1 second
  * 2 seconds
  * 4 seconds
* [x] Dead-letter queue after retry exhaustion
* [x] Failed jobs reported with `failed` status
* [x] `GET /jobs/:id`
* [x] Job status response includes:

  * `jobId`
  * `status`
  * `metadata`
* [x] Docker Compose starts:

  * API
  * Worker
  * PostgreSQL
  * Redis
* [x] **Bonus:** Assignment-notification deduplication within 5 seconds using Redis `SETNX`
* [x] **Bonus:** Global email rate limit of 50/minute using BullMQ's Redis-backed limiter

---

# Task 05 — Testing & API Documentation

## Unit Tests

* [x] Authentication
* [x] Password hashing
* [x] JWT behavior
* [x] Assignment validation
* [x] Pagination helper

## Integration Tests

* [x] Login flow
* [x] Task CRUD
* [x] Cross-tenant access returns `403`
* [x] Validation failures
* [x] Test database isolation through per-test database truncation
* [x] Dedicated test database
* [x] **Bonus:** Queue integration test proving task assignment creates a BullMQ job

## API Documentation

* [x] OpenAPI/Swagger
* [x] Swagger served at `/docs`
* [x] Importable Postman collection
* [x] Postman environment variables
* [x] **Bonus:** Coverage report using Vitest + V8

---

# Documentation & Submission

* [x] README

  * Overview
  * Architecture
  * Tech stack
  * Setup
  * Environment variables
  * Migrations
  * Seed data
  * API/worker execution
  * Docker
  * Demo credentials
  * API examples
  * Technical decisions
  * Assumptions
  * Known limitations
* [x] `docs/architecture.md`

  * Mermaid architecture diagrams
  * Request/response flow
  * Authentication flow
  * Multi-tenant authorization flow
  * Assignment/notification flow
  * Background-job architecture
* [x] `docs/technical-decisions.md`
* [x] `docs/database.md`

  * ER diagram
  * Table responsibilities
  * Constraints
  * Foreign keys
  * Deletion behavior
* [x] `docs/requirement-checklist.md`
* [x] `.env.example`
* [x] No secrets committed
* [x] GitHub Codespaces support
* [x] `.devcontainer/devcontainer.json`
* [x] Docker-in-Docker development environment
* [x] `docs/codespaces.md`
* [x] `scripts/setup-codespaces-env.sh`

---

# Deployment / Development Environment

The complete stack can run inside GitHub Codespaces without requiring Docker Desktop on the developer's local machine.

```text
GitHub Codespace
       │
       ▼
Docker Compose
       │
       ├── Fastify API
       ├── BullMQ Worker
       ├── PostgreSQL
       └── Redis
```

Browser-accessible services:

```text
5173 → React + Vite
3000 → Fastify API + Swagger
```

Infrastructure services remain internal:

```text
5432 → PostgreSQL
6379 → Redis
```

---

# Overall Status

| Area                       | Status |
| -------------------------- | :----: |
| Technology stack           |    ✅   |
| Database & migrations      |    ✅   |
| Authentication             |    ✅   |
| RBAC                       |    ✅   |
| Multi-tenancy              |    ✅   |
| Projects                   |    ✅   |
| Tasks                      |    ✅   |
| Assignment workflow        |    ✅   |
| Redis / BullMQ             |    ✅   |
| Worker                     |    ✅   |
| Retry / DLQ                |    ✅   |
| Dashboard                  |    ✅   |
| Comments                   |    ✅   |
| Testing                    |    ✅   |
| Swagger / OpenAPI          |    ✅   |
| Postman                    |    ✅   |
| Docker                     |    ✅   |
| Codespaces                 |    ✅   |
| Architecture documentation |    ✅   |
| Database documentation     |    ✅   |
| Technical decisions        |    ✅   |
| Requirement checklist      |    ✅   |
| Bonus features             |    ✅   |
