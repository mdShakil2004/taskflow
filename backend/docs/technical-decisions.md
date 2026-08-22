# TaskFlow — Technical Decisions

## Why Fastify over Express
Fastify's schema-driven request lifecycle and built-in hooks (`preHandler`)
map directly onto the layered auth → tenant → RBAC checks this assignment
requires, without extra middleware libraries. Its official `@fastify/swagger`
plugin also keeps the OpenAPI spec close to the route declarations, reducing
the chance of Swagger drifting from the real API.

## Why Prisma
Prisma's generated client gives compile-time-checked queries (important for
"strict TypeScript, no `any`") and a first-class migration workflow
(`prisma migrate dev` / `deploy`), satisfying the "no manually maintained
schema.sql" requirement while still allowing hand-written SQL migrations
(used for the generated `tsvector` column, which Prisma's schema DSL can't
express directly).

## Why PostgreSQL
Mandated by the assignment. Beyond that: native `tsvector`/GIN full-text
search (used for the bonus task search) and native enum types (used for
`TaskStatus`/`TaskPriority`) are both first-class Postgres features that a
generic ORM-only approach would otherwise have to fake with string columns.

## Why Redis + BullMQ
Mandated by the assignment. BullMQ specifically (over a hand-rolled Redis
queue) gives production-grade retry/backoff, a queryable job state machine
(`waiting`/`active`/`completed`/`failed`) that maps directly onto
`GET /jobs/:id`, and a Redis-coordinated rate limiter, which is what makes the
bonus global 50 emails/minute limit correct across multiple worker instances
rather than just per-process.

## CORS and cloud dev environments
`app.ts` registers CORS with `origin: true` (reflect the request's own
Origin header rather than a fixed allowlist). This is a deliberate choice,
not an oversight: when the app runs in GitHub Codespaces, the frontend is
served from a per-Codespace, per-session URL
(`https://<codespace-name>-5173.app.github.dev`) that isn't known ahead of
time and changes every time a new Codespace is created — a static
allowlisted origin would break that workflow. `X-Organization-Id` and
`Authorization` are the only non-default headers the frontend sends, and
both are explicitly reflected in preflight responses (verified in practice —
see `docs/codespaces.md`). The actual security boundary is unaffected either
way: CORS only controls which *browser* origins may read the response, while
every request is still authenticated by JWT and tenant-scoped by
`org_members` regardless of Origin — a permissive CORS policy widens who can
*attempt* a request from a browser, not who can succeed.

## Why offset pagination over cursor pagination
The assignment allows either. Offset was chosen because:
1. Task/project lists in TaskFlow are typically small-to-medium (hundreds, not millions, of rows per project), so the "skip N rows" cost is negligible.
2. The assignment's own example response body is the offset shape (`data/total/page/limit`), and Swagger/Postman consumers can jump to an arbitrary page (e.g. "show me page 5") which cursor pagination can't do.
3. It keeps the API surface simpler for a reviewer to exercise manually.
The tradeoff: offset pagination degrades on very large, frequently-mutated
tables (page drift, `COUNT(*)` cost). If TaskFlow's task volume grew into the
millions-per-project range, cursor pagination (keyset on `created_at, id`)
would be the next step — noted here rather than silently ignored.

## Password hashing
bcrypt with `BCRYPT_ROUNDS=12` (enforced as a config floor via
`z.coerce.number().int().min(12)` in `src/config.ts` — the app refuses to
start with a lower value). Chosen over Argon2 because bcrypt is what the
assignment explicitly names, and its cost factor is trivially auditable in
code review (`bcrypt.hash(password, config.BCRYPT_ROUNDS)`).

## JWT design
Two secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) so that a leak of one
does not compromise the other. Payload is intentionally minimal —
`{ sub, type }` for access tokens, `{ sub, type, jti }` for refresh tokens —
with no role or organization embedded. This is a direct consequence of the
multi-tenancy requirement: a user's role can differ per organization and a
user can belong to more than one, so baking a single role/org into the token
would either be wrong the moment the user switches context or require
re-issuing tokens on every org switch. Instead, role/org are re-resolved from
`org_members` on every request (see tenant.middleware.ts).

## Refresh token strategy
Refresh tokens are stored in `refresh_tokens` as a **SHA-256 hash**, never
plaintext — a stolen database export alone cannot be replayed as a valid
session. Rotation is implemented: every `/auth/refresh` call issues a new
token pair and revokes the presented one, linking old → new via
`replaced_by_id`. If a *revoked* token is presented again (a strong signal of
theft — the legitimate client should already have the newer token), the
service revokes **every** active refresh token for that user as a defensive
measure, not just the one presented.

## RBAC
Two roles (`org_admin`, `member`), matching the assignment exactly — no
speculative extra roles. Enforcement is centralized in
`middleware/role.middleware.ts::requireRole(...roles)`, applied as a
`preHandler` on specific routes (currently: member management, project
deletion) rather than duplicated as `if` checks inside each controller.

## Multi-tenant isolation
Three layers, deliberately redundant:
1. **Middleware**: `tenant.middleware.ts` refuses to attach `request.auth` unless a real `org_members` row exists for (header org id, JWT user id).
2. **Repository queries**: every org-owned resource query includes `organizationId` (or, for tasks, the `project.organizationId` relation) as a `WHERE` condition — not as a post-fetch filter. A cross-tenant lookup returns "not found", not "found, then rejected", which is why cross-tenant reads return 404 (record genuinely not visible in that scope) while cross-tenant *impersonation attempts* (selecting another org via the header without membership) return 403 at the middleware layer, before any resource is even queried. Both codepaths are exercised in `tests/integration/task-crud-and-tenancy.integration.test.ts`.
3. **Task authorization is never by task id alone**: every task-scoped query joins back through `project.organizationId`, per the assignment's explicit instruction.

## FK CASCADE/RESTRICT choices
See `docs/database.md` for the full table; summarized rule: deleting a
container (`organization` → `projects`, `project` → `tasks`, `task` →
`assignments`/`comments`) cascades, because the child is meaningless without
its parent. Deleting a `user` is `RESTRICT`ed from `task_assignments` and
`comments` — a user is not "owned" by an organization the way a task is owned
by a project, and silently cascading a user's deletion into destroying
assignment/comment history would erase an audit trail. The intended path for
removing a user's access is removing their `org_members` row (which *does*
cascade) or, in a future iteration, an `is_active` deactivation flag.

## Indexing strategy
Indexes are added for query patterns that actually run in this codebase (see
inline comments in `prisma/schema.prisma` and the initial migration), not
speculatively on every column:
- `org_members(organization_id, user_id)` — unique, backs the per-request membership check.
- `projects(organization_id)` — backs the project list endpoint.
- `tasks(project_id)`, `tasks(project_id, status)`, `tasks(project_id, priority)`, `tasks(due_date)` — back the task list + filter endpoints and the dashboard aggregate.
- `task_assignments(task_id, user_id)` unique — enforces the "one assignment per user per task" rule at the DB level, not just in application code.
- `tasks.search_vector` GIN index — backs full-text search without a sequential scan.

## Queue retry / backoff semantics
"Retry failed jobs 3 times" with a 3-step backoff (1s → 2s → 4s) is read as
**3 retries after the initial attempt = 4 total attempts**, because the
backoff sequence has exactly 3 delays (one per retry). Implemented as BullMQ
`attempts: 4, backoff: { type: 'exponential', delay: 1000 }`. This is called
out explicitly here (rather than left ambiguous) because "N retries" is
genuinely read both ways in practice.

## Dead-letter queue strategy
BullMQ has no built-in DLQ primitive — a "failed" job simply stays in the
original queue's failed set. TaskFlow implements the DLQ as a second, plain
BullMQ queue (`task-assignment-notifications-dlq`) that the worker's
`failed` event handler pushes to once `job.attemptsMade >= attempts`. This
keeps failed notifications inspectable/replayable rather than either (a)
silently vanishing or (b) cluttering the primary queue's failed-job list
indefinitely.

## Assignment / queue consistency strategy
This is the trickiest requirement in the assignment: the API must persist the
assignment *and* enqueue the job before returning success, but must not leave
inconsistent state if either half fails.

**What is NOT true**: PostgreSQL and Redis do not share a distributed
transaction. There is no way to atomically guarantee "assignment row exists
in Postgres" AND "job exists in Redis" as a single all-or-nothing operation.

**What TaskFlow actually does**:
1. Write the `TaskAssignment` row and a `NotificationOutbox` row (status
   `pending`) in **one Postgres transaction**. This part *is* atomic — the
   assignment and its outbox record are always consistent with each other.
2. Immediately after committing, attempt to enqueue the BullMQ job in the
   same request. If it succeeds, mark the outbox row `dispatched` and return
   `jobId` to the client — this is the common case and satisfies "enqueue the
   job before returning a successful response".
3. If the enqueue attempt throws (e.g. Redis briefly unreachable), the
   request **still returns 201** with `jobId: null` — the assignment itself
   is real and already committed; there is no reason to fail the whole
   request over a notification. The outbox row stays `pending`.
4. A background sweep in the worker (every 10s, only rows older than a 5s
   grace period) finds `pending` outbox rows and enqueues them, then marks
   them `dispatched`.

**Net guarantee**: the assignment write can never be "lost" due to a queue
failure, and the notification is *eventually* delivered even if the
immediate enqueue attempt fails — at the cost of a bounded delay (up to ~15s
worst case: 5s grace + up to 10s until the next sweep) in that failure case
only. This is documented as a deliberate at-least-once, eventually-consistent
design rather than a false claim of strict consistency.

**Failure mode not fully covered**: if the worker process itself is down for
longer than expected, `pending` outbox rows accumulate until it comes back —
there's no separate alerting on outbox backlog age in this submission; that
would be a natural next step (e.g. exposing a `/health` check that also
reports oldest-pending-outbox-age).

## Test isolation strategy
Integration tests truncate every application table in `beforeEach` (see
`tests/integration/test-helpers.ts::truncateAll`) rather than relying on
transaction rollback. Fastify's `app.inject()` and Prisma's own connection
pooling don't compose cleanly with wrapping each test in an outer
transaction (Prisma's `$transaction` in the app code would itself be nested
inside a test transaction, which Postgres doesn't support the way some
ORMs' savepoint-based test helpers assume). Truncation is simpler, fully
reliable, and fast enough at this data volume. Tests are expected to run
against a **dedicated test database** (see README "Running tests") — never
against a developer's normal dev database.
