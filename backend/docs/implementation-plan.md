# TaskFlow — Implementation Plan (Phase 0)

## Mandatory requirements extracted from the assignment PDF
- Node.js/TS + Fastify, PostgreSQL only, Redis+BullMQ, Prisma, Docker Compose (API, Worker, Postgres, Redis)
- Tables: users, organizations, org_members, projects, tasks, task_assignments, comments (+ refresh_tokens, notification_outbox as supporting tables)
- Enums: task status (todo/in_progress/review/done), priority (low/medium/high/urgent)
- Auth: register/login/refresh/logout, bcrypt cost ≥12, access JWT 15m, refresh JWT 7d stored in DB + revocable, rate limit 10 req/min/IP on all four auth routes
- RBAC: org_admin, member. Admins manage members + delete projects.
- Multi-tenancy: org context derived from authenticated membership only, never from client-supplied org_id. Cross-tenant → 403, no data leakage.
- Projects & Tasks: full CRUD, task filters (status/priority/assignee/due-date range), pagination (offset, `{data,total,page,limit}` — chosen over cursor, see technical-decisions.md), Zod validation, consistent error shape `{error,code,details}`
- Assignment: assign/unassign endpoints, assignee must be same org, enqueue notification job without blocking response, documented consistency strategy for DB/queue partial failure
- Background jobs: BullMQ queue, worker as separate process, retry x3 with backoff 1s/2s/4s, DLQ after exhaustion, `GET /jobs/:id` returning jobId/status/metadata
- Dashboard: task counts grouped by status via single aggregate query
- Comments: task + author reference, org-scoped
- Testing: unit (auth, assignment validation, pagination) + integration (login, task CRUD, cross-tenant 403, validation errors), isolated test DB
- Docs: OpenAPI/Swagger (served locally), Postman collection (importable, env vars), README, architecture.md, technical-decisions.md, database.md, requirement-checklist.md

## Bonus (implemented only after core is solid)
- Soft delete (`deleted_at`) on projects/tasks — **implemented**
- Assignment notification dedup within 5s — **implemented** (Redis SETNX key)
- Global email rate limit 50/min — **implemented** (BullMQ limiter on worker)
- Refresh token rotation + logout-all-devices — **implemented**
- Full-text search (Postgres tsvector) — **implemented** on task title+description
- Bulk task status update — **implemented**
- Coverage report — **implemented** via vitest --coverage
- Queue-job integration test — **implemented**

## Ambiguous areas → explicit decisions
1. **Pagination style**: PDF allows offset OR cursor. Decision: offset, matches the explicit `{data,total,page,limit}` shape shown first and is simplest to reason about for a reviewer. Documented in technical-decisions.md.
2. **DB/Queue consistency**: PDF requires assignment persisted AND job enqueued before the response returns (no pure outbox-only deferred design), but also requires no inconsistent state on partial failure. Decision: write assignment + outbox row in one DB transaction, then attempt an immediate BullMQ enqueue in the same request. If enqueue succeeds, mark the outbox row `dispatched`. If enqueue throws, the request still returns success (the assignment is real and committed) but a background outbox-recovery sweep (interval in the worker) picks up any `pending` outbox rows and publishes them, guaranteeing eventual delivery without blocking or rolling back the assignment. This is documented in detail in technical-decisions.md, including that Postgres+Redis have no real distributed transaction.
3. **"3 retries" semantics**: Decision: 3 retries = 4 total attempts is the more common reading, but the assignment's backoff sequence (1s/2s/4s) has exactly 3 delays, implying 3 retry attempts after the initial one = 4 total attempts. We use BullMQ `attempts: 4` (`1 initial + 3 retries`) with `backoff: {type:'exponential', delay:1000}` → delays 1s/2s/4s between attempts. Documented explicitly.
4. **Refresh token storage**: PDF says "store in DB with revocation support," doesn't mandate hashing. Decision: store only a SHA-256 hash of the refresh token (defense in depth against DB read exposure), matching "do not store plaintext secrets" security best practice.
5. **Task assignment uniqueness**: not explicit — decision: `@@unique([taskId, userId])` at DB level, service-level pre-check for a clean 409-style `DUPLICATE_ASSIGNMENT` error.
6. **CASCADE/RESTRICT**: documented per-table in database.md; general rule — deleting a parent org-owned resource cascades to its direct children (org→members/projects, project→tasks, task→assignments/comments) since orphaned rows are meaningless; deleting a `user` is RESTRICTed from org_members/comments/assignments to avoid silently destroying audit history — soft-delete/deactivate the user instead.

## Implementation order
Phase 1 scaffold → Phase 2 DB/migrations/seed → Phase 3 auth → Phase 4 RBAC/tenancy → Phase 5 projects → Phase 6 tasks/filters/dashboard → Phase 7 assignments → Phase 8 BullMQ/worker → Phase 9 comments → Phase 10 tests → Phase 11 Swagger/Postman → Phase 12 Docker validation → Phase 13 docs → Phase 14 audit.
