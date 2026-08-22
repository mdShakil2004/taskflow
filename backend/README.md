# TaskFlow

A lightweight, multi-tenant project-management backend: users belong to
organizations, organizations own projects, projects contain tasks, tasks can
be assigned to users (which triggers an asynchronous email notification via
Redis + BullMQ), and users can comment on tasks.

Built for the GrubPac Technologies backend developer assignment.

> **No Docker on your laptop?** You don't need it. This project is fully
> runnable in **GitHub Codespaces** — Docker still runs (it's a hard
> requirement of the assignment and this repo includes a real `Dockerfile`
> and `docker-compose.yml`), just inside the cloud container instead of your
> machine. See [`docs/codespaces.md`](docs/codespaces.md) or jump to
> [section 14](#14-local-setup).

## 1. Project overview

- Node.js 20 + TypeScript (strict mode) + Fastify
- PostgreSQL via Prisma, with hand-reviewed raw-SQL migrations
- Redis + BullMQ for the assignment-notification background job
- JWT auth (access + refresh) with organization-scoped RBAC
- Two deployable processes from one codebase: the **API** and the **worker**
- A **React + Vite + Tailwind test console** in [`frontend/`](frontend/README.md) that exercises every endpoint — see below

## 2. Features

- Register / login / refresh (with rotation) / logout (single device or all devices)
- Organization membership with two roles: `org_admin`, `member`
- Full CRUD for projects and tasks, scoped to the caller's organization
- Task filters (status, priority, assignee, due-date range) + full-text search
- Offset pagination on every list endpoint
- Assign / unassign a task to/from a user in the same organization
- Async email notification on assignment, with retry/backoff/dead-letter queue
- `GET /jobs/:id` job status endpoint
- Project dashboard: task counts grouped by status
- Task comments
- Soft delete on projects/tasks
- Bulk task status update
- Swagger UI + Postman collection

## 3. Architecture

See [`docs/architecture.md`](docs/architecture.md) for diagrams. In short:

```
Client -> Fastify API -> PostgreSQL (Prisma)
                       -> Redis/BullMQ -> Worker (separate process) -> mock email
```

Every route follows `Route -> Controller -> Service -> Repository -> Prisma`.
Controllers are thin (parse, call service, map response); services own
business rules; repositories are the only files that call Prisma directly.

## 4. Tech stack

Fastify, TypeScript (strict), Prisma, PostgreSQL 16, Redis 7, BullMQ, Zod,
bcrypt, jsonwebtoken, Vitest, Docker Compose. See
[`docs/technical-decisions.md`](docs/technical-decisions.md) for *why* each
was chosen specifically for TaskFlow, not a generic pitch.

## 5. Project structure

```
taskflow/
├── src/            # API: modules (auth, projects, tasks, ...), middleware, infra, shared
├── worker/          # Background worker process + BullMQ job processor
├── prisma/          # schema.prisma, hand-written migrations, seed.ts
├── tests/           # unit/ and integration/
├── docs/            # architecture, technical-decisions, database, requirement-checklist
├── postman/         # Postman collection
├── docker-compose.yml
└── Dockerfile        # multi-stage: `api` and `worker` build targets
```

## 6. Database design

Full detail in [`docs/database.md`](docs/database.md) (ER diagram, table
responsibilities, CASCADE/RESTRICT rationale, indexing, soft-delete
semantics). Seven required tables plus `refresh_tokens` (session storage) and
`notification_outbox` (reliable async delivery — see technical-decisions.md).

## 7. Authentication

`POST /auth/register|login|refresh|logout`. bcrypt (cost 12), 15-minute
access JWTs, 7-day refresh tokens stored as a SHA-256 hash with rotation and
reuse detection. Full rationale in `docs/technical-decisions.md`.

## 8. Multi-tenancy model

The JWT carries only `{ sub, type }` — no role or org. Every request must
also send `X-Organization-Id`, which is treated as a *selector*, never as an
authorization decision: `middleware/tenant.middleware.ts` re-verifies, via a
DB lookup against `org_members`, that the JWT-verified user is actually a
member of that organization, and derives the role from the database. Every
org-owned resource query is scoped by `request.auth.organizationId`
server-side. See `docs/technical-decisions.md` → "Multi-tenant isolation".

## 9. RBAC

Two roles: `org_admin`, `member`. Admins can manage members and delete
projects. Enforced centrally via `middleware/role.middleware.ts::requireRole(...)`,
applied as a route-level `preHandler` — never duplicated as ad hoc `if` checks.

## 10. Background job architecture

BullMQ queue `task-assignment-notifications`, consumed by a **separate**
worker process (`worker/worker.ts`) — never run inside the API process. See
`docs/architecture.md` for the full sequence diagram.

## 11. Queue consistency strategy

The trickiest requirement: persist the assignment and enqueue the job before
returning, without leaving inconsistent state on partial failure. TaskFlow
writes the assignment + a transactional outbox row atomically in Postgres,
attempts an immediate BullMQ enqueue, and falls back to a worker-side
recovery sweep if that immediate attempt fails — all explained in detail,
including what is and isn't actually guaranteed, in
[`docs/technical-decisions.md`](docs/technical-decisions.md) → "Assignment /
queue consistency strategy".

## 12. Retry/DLQ strategy

4 total attempts (1 initial + 3 retries), exponential backoff 1s → 2s → 4s.
After exhaustion, the job is pushed to a separate dead-letter queue
(`task-assignment-notifications-dlq`) and `GET /jobs/:id` reports `failed`.

## 13. API documentation

Swagger UI: `http://localhost:3000/docs` (once the API is running).
Postman collection: [`postman/TaskFlow.postman_collection.json`](postman/TaskFlow.postman_collection.json)
— imports with no manual edits; uses collection variables (`baseUrl`,
`accessToken`, etc.) auto-populated by test scripts as you run the demo flow
in order (Register → Create project → Create task → Assign → Job status →
View task → Dashboard).

## 14. Local setup

TaskFlow can be run two ways — pick whichever matches your situation. Both
use the exact same `docker compose up --build`; the only difference is
*where* that command runs.

### Option 1 — Cloud development (GitHub Codespaces) — no local installs needed

**You do not need Docker, PostgreSQL, or Redis installed on your laptop for
this path.** Docker still runs — just inside the cloud container, not on
your machine. Open this repo in a GitHub Codespace and follow
[`docs/codespaces.md`](docs/codespaces.md) for the full walkthrough
(port forwarding, why the frontend needs a special API URL in the cloud, and
how to make the app reviewable by someone else). Short version:

```bash
docker compose up --build      # backend: api, worker, postgres, redis
npm run db:setup                # migrate + seed, in a second terminal
cd frontend && npm run dev      # frontend, in a third terminal
```

### Option 2 — Local machine (requires Docker Desktop, or local Postgres + Redis)

#### Prerequisites
- Node.js 20+
- Docker & Docker Compose (recommended path), **or** local PostgreSQL 16 + Redis 7

#### 2a — Docker Compose (recommended)
```bash
cp .env.example .env
docker compose up --build
```
This starts `postgres`, `redis`, `api`, and `worker`. On first run, apply
migrations and seed data from your host machine (or `docker compose exec api sh`):
```bash
npm install
npm run db:setup
```
API: http://localhost:3000 — Swagger: http://localhost:3000/docs

#### 2b — Run natively (no Docker at all)
```bash
npm install
cp .env.example .env   # point DATABASE_URL/REDIS_URL at your local Postgres/Redis
npm run db:setup
npm run dev             # API, in one terminal
npm run dev:worker      # worker, in another terminal
```

### Frontend (test console) — same command either way
Once the API is running (any option above):
```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL — see docs/codespaces.md if running in the cloud
npm run dev              # opens on http://localhost:5173 (or the forwarded URL in Codespaces)
```
Log in with a seeded account (see section 22) and you're exercising the live
API through the UI — including the assignment → BullMQ → job-status flow,
visualized live via the QueuePulse indicator. See
[`frontend/README.md`](frontend/README.md) for what it covers and how it's
designed.

## 15. Environment variables

See [`.env.example`](.env.example) for the full list with comments. All are
validated at startup by `src/config.ts` (fail-fast — the app refuses to
start with a missing/invalid value, e.g. `BCRYPT_ROUNDS` below 12).

## 16. Database migration

Migrations are plain SQL under `prisma/migrations/`, applied via:
```bash
npx prisma migrate deploy   # production/CI: apply existing migrations
npx prisma migrate dev      # local development: apply + create new migrations from schema changes
```

## 17. Seed data

```bash
npm run prisma:seed
```
Creates 2 organizations, 5 users, 3 projects, 15 tasks (varied
status/priority), assignments, and comments. See section 22 for credentials.

## 18. Running API
```bash
npm run dev          # local, hot reload
npm run build && npm start   # production build
```

## 19. Running worker
```bash
npm run dev:worker
npm run build && npm run start:worker
```

## 20. Running tests
```bash
npm test                    # unit tests only — no DB/Redis required
npm run test:integration    # integration tests — requires a running Postgres + Redis
npm run test:coverage       # coverage report (bonus)
```
**Test isolation**: integration tests truncate every table before each test
and are meant to run against a **dedicated test database** — never your dev
database. Point `DATABASE_URL` in `.env.test` at a database named e.g.
`taskflow_test` before running `test:integration`. See
`docs/technical-decisions.md` → "Test isolation strategy" for why truncation
was chosen over transaction rollback.

## 21. Docker setup
```bash
docker compose up --build     # first run / after code changes
docker compose down -v        # tear down, including the Postgres volume
```
Includes health checks for all four services; `api` and `worker` wait for
`postgres`/`redis` to be healthy before starting.

## 22. Demo credentials

All passwords: `DemoPass123!` (development-only, never use in production).

| Organization | Role | Email |
|---|---|---|
| Nimbus Logistics | org_admin | admin@nimbus.example |
| Nimbus Logistics | member | member@nimbus.example |
| Nimbus Logistics | member | dev@nimbus.example |
| Solace Retail Group | org_admin | admin@solace.example |
| Solace Retail Group | member | member@solace.example |

Use two different organizations' admins to demonstrate cross-tenant 403s —
e.g. log in as `admin@nimbus.example`, note their org id, then try accessing
a Solace project/task id with `admin@solace.example`'s token but Nimbus's org
header (impersonation attempt → 403), or with the correct org header for a
resource that simply doesn't exist there (→ 404, no data leaked).

## 23. API examples

**Register**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"StrongPass123!","fullName":"You","organizationName":"Your Org"}'
```

**Create a project** (org context via header)
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-Organization-Id: <organizationId>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Website Relaunch"}'
```

**Filter tasks**
```bash
curl "http://localhost:3000/api/v1/projects/<projectId>/tasks?status=in_progress&priority=high&dueFrom=2026-08-01&dueTo=2026-08-31" \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-Organization-Id: <organizationId>"
```

**Assign a task**
```bash
curl -X POST http://localhost:3000/api/v1/tasks/<taskId>/assignments \
  -H "Authorization: Bearer <accessToken>" \
  -H "X-Organization-Id: <organizationId>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<targetUserId>"}'
```

## 24. Technical decisions

See [`docs/technical-decisions.md`](docs/technical-decisions.md) — every
non-obvious choice (pagination style, retry semantics, refresh-token
storage, CASCADE/RESTRICT rules, the assignment/queue consistency strategy,
test isolation) explained specifically for TaskFlow, with tradeoffs stated
rather than glossed over.

## 25. Assumptions

- The assignment's endpoint paths (`/auth/*`, `/jobs/:id`) are preserved
  exactly as written; other business resources use an `/api/v1` prefix per
  general REST convention, since the PDF didn't mandate a prefix for them.
- Registration either creates a new organization (caller becomes `org_admin`)
  or joins an existing one by id (caller becomes `member`) — the PDF didn't
  specify how a user's first organization membership is established, and an
  explicit invite-code/invite-link flow was out of scope for this assignment.
  Adding a member to an org after that point is an admin-only action
  (`POST /api/v1/members`).
- "3 retries" is read as 3 retries after the initial attempt (4 total),
  matching the 3-step backoff sequence — see technical-decisions.md for the
  reasoning, since this is genuinely ambiguous in the source text.
- Offset pagination was chosen over cursor pagination (the PDF allows either).

## 26. Known limitations

- **Outbox recovery delay**: if the immediate BullMQ enqueue attempt fails,
  notification delivery can be delayed up to ~15 seconds (grace period +
  sweep interval) rather than being instant. This is a deliberate,
  documented tradeoff, not an oversight — see technical-decisions.md.
- **Soft delete does not cascade**: deleting a project soft-deletes only the
  project row, not its tasks (though task listing/lookup already filters by
  `project.deletedAt IS NULL`, so soft-deleted-project tasks are invisible
  via the API either way). A stricter implementation would cascade the
  `deletedAt` write or add a scheduled cleanup job.
- **No refresh-token-family invalidation UI**: reuse of a revoked refresh
  token triggers revocation of *all* of that user's sessions server-side as
  a defensive measure, but there's no endpoint yet to notify the user this
  happened (e.g. "you were logged out everywhere because of a suspicious
  refresh attempt").
- **Outbox backlog isn't independently monitored**: `/health` checks
  Postgres/Redis connectivity, but not oldest-pending-outbox-row age — a
  production deployment would want that as a separate signal.
- **Verification environment constraint**: this repository's automated
  test/build verification was performed in a network-sandboxed environment
  that could not reach `binaries.prisma.sh` (Prisma's engine CDN), so
  `prisma generate`/`migrate` could not be executed there. In that
  environment, all *raw* migration SQL was instead validated directly
  against a real local PostgreSQL 16 instance (tables, indexes, generated
  `tsvector` column, and CASCADE/RESTRICT behavior all confirmed working —
  see the SQL transcript in the project history), and all unit tests
  (bcrypt hashing, JWT sign/verify, pagination helper, assignment validation
  logic) passed against the compiled TypeScript. `npm install`, `npx tsc`,
  and `npx vitest run tests/unit` were all executed successfully. Only the
  Prisma CLI's own binary download was blocked — on any machine with normal
  internet access (a reviewer's laptop, CI, or the Docker build itself),
  `npx prisma generate` / `migrate deploy` will work normally, since
  `binaries.prisma.sh` is a standard public endpoint.





Organization A — Nimbus Logistics
  admin:  admin@nimbus.example / DemoPass123!
  member: member@nimbus.example / DemoPass123!
Organization B — Solace Retail Group
  admin:  admin@solace.example / DemoPass123!
  member: member@solace.example / DemoPass123!
