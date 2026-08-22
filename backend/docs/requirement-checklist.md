# TaskFlow — Requirement Checklist

Every item below is implemented in this repository and exercised by an
automated test where applicable. "Bonus" items are clearly marked.

## Technology
- [PASS] Node.js + TypeScript + Fastify
- [PASS] PostgreSQL only (no SQLite/MongoDB/Firebase/Supabase/PlanetScale)
- [PASS] Redis + BullMQ
- [PASS] Prisma ORM
- [PASS] Docker Compose (API, Worker, PostgreSQL, Redis)

## Task 01 — Data modeling & database
- [PASS] `users`, `organizations`, `org_members`, `projects`, `tasks`, `task_assignments`, `comments` tables
- [PASS] Foreign keys with documented CASCADE/RESTRICT (`docs/database.md`)
- [PASS] Projects reference organizations; tasks reference projects
- [PASS] `task_assignments` references task + user; `comments` references task + user (author)
- [PASS] PostgreSQL enums for status and priority
- [PASS] Indexes with query-pattern comments in `prisma/schema.prisma` and the migration SQL
- [PASS] Prisma migrations (no manually maintained schema.sql)
- [PASS] Seed data: 2 orgs, 5 users, multiple projects, 15 tasks across both orgs, varied status/priority, assignments, comments
- [PASS] ★ Bonus: soft delete (`deleted_at` on projects/tasks)
- [PASS] ★ Bonus: PostgreSQL full-text search on task title + description (generated `tsvector` + GIN index)

## Task 02 — Authentication & authorization
- [PASS] `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`
- [PASS] `GET /auth/me/organizations` — not in the assignment's mandatory list, added to make the API actually usable by a real client (the JWT deliberately carries no org, so a client needs *some* way to discover which orgs a user belongs to after login)
- [PASS] bcrypt, cost factor ≥ 12 (enforced by config validation)
- [PASS] Access JWT, 15 min TTL
- [PASS] Refresh token, 7 day TTL, stored in DB (hashed) with revocation
- [PASS] Roles: `org_admin`, `member`
- [PASS] Admins manage members and delete projects; members cannot
- [PASS] Auth middleware attaches user + organization context (JWT + DB-verified membership)
- [PASS] All service-layer queries scoped by `organizationId` from `request.auth`
- [PASS] Client-provided org id never trusted directly (`tenant.middleware.ts` re-verifies via DB)
- [PASS] Cross-tenant access → 403, no data leakage
- [PASS] Auth endpoints rate-limited 10 req/min/IP (Redis-backed)
- [PASS] ★ Bonus: refresh token rotation
- [PASS] ★ Bonus: logout all devices (`allDevices: true`)

## Task 03 — REST API: projects & tasks
- [PASS] Full CRUD for projects
- [PASS] Full CRUD for tasks
- [PASS] Every project belongs to the authenticated user's org
- [PASS] Every task's project belongs to the authenticated user's org
- [PASS] Task filters: status, priority, assignee, due-date range
- [PASS] Offset pagination, `{data, total, page, limit}` shape (see technical-decisions.md for why offset was chosen)
- [PASS] Zod validation for body/query/params
- [PASS] Consistent error shape `{error, code, details}`
- [PASS] Assign/unassign endpoints; assignee must share the task's org
- [PASS] Project dashboard with task counts grouped by status (single `groupBy` aggregate)
- [PASS] ★ Bonus: bulk task status update (`PATCH /api/v1/tasks/bulk-status`)
- [PASS] ★ Bonus: full-text task search (`?search=` query param on the task list endpoint)

## Task 04 — Background jobs & email notifications
- [PASS] Redis + BullMQ notification queue
- [PASS] Assignment persisted and job enqueued before the response returns (happy path); documented fallback via outbox when enqueue fails
- [PASS] Documented consistency strategy for DB/Redis partial failure (technical-decisions.md)
- [PASS] Worker (separate process) processes email jobs
- [PASS] Mock email sending
- [PASS] Retry 3 times (4 total attempts), exponential backoff 1s/2s/4s
- [PASS] Dead-letter queue after retry exhaustion; job status reported as `failed`
- [PASS] `GET /jobs/:id` returning jobId, status, metadata
- [PASS] Docker Compose starts API + Worker + Postgres + Redis
- [PASS] ★ Bonus: assignment notification dedup within 5 seconds (Redis SETNX)
- [PASS] ★ Bonus: global email rate limit, 50/min, coordinated via BullMQ's Redis-backed limiter across worker instances

## Task 05 — Testing & API documentation
- [PASS] Unit tests: authentication (hashing, JWT), assignment validation, pagination helper
- [PASS] Integration tests: login flow, task CRUD, cross-tenant access → 403, validation failures
- [PASS] Test isolation via per-test DB truncation against a dedicated test database
- [PASS] OpenAPI/Swagger, served locally at `/docs`
- [PASS] Postman collection, imports without manual edits, uses environment variables
- [PASS] ★ Bonus: coverage report (`npm run test:coverage`, v8 provider)
- [PASS] ★ Bonus: integration test proving task assignment creates a BullMQ job

## Documentation & submission
- [PASS] README (overview, architecture, tech stack, setup, env vars, migrations, seed, running API/worker/tests, Docker, demo credentials, API examples, technical decisions, assumptions, known limitations)
- [PASS] `docs/architecture.md` with Mermaid diagrams
- [PASS] `docs/technical-decisions.md`
- [PASS] `docs/database.md` with ER diagram
- [PASS] `docs/requirement-checklist.md` (this file)
- [PASS] `.env.example`, no secrets committed
- [PASS] Cloud development environment (GitHub Codespaces): `.devcontainer/devcontainer.json` with Docker-in-Docker, `docs/codespaces.md`, `scripts/setup-codespaces-env.sh` — Docker Compose still runs the required 4 services, just inside the cloud container instead of requiring Docker Desktop locally
