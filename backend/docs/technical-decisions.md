# TaskFlow — Technical Decisions

This document records the key engineering decisions behind TaskFlow, including the reasoning, trade-offs, and known limitations.

---

## 1. Why Fastify over Express

Fastify's schema-driven request lifecycle and built-in `preHandler` hooks map naturally to the layered authentication, tenant, and RBAC checks required by the assignment.

The official `@fastify/swagger` plugin also keeps the OpenAPI definition close to the route declarations, reducing the risk of documentation drifting from the actual API.

---

## 2. Why Prisma

Prisma provides a generated, type-safe client that supports the project's strict TypeScript requirement without relying on `any`.

It also provides a first-class migration workflow through:

```bash
prisma migrate dev
prisma migrate deploy
```

This satisfies the requirement to use Prisma migrations rather than maintaining a manually written `schema.sql`.

A small amount of hand-written SQL is still used where Prisma's schema DSL cannot directly express the PostgreSQL `tsvector` search column.

---

## 3. Why PostgreSQL

PostgreSQL is required by the assignment.

It also provides two capabilities used directly by TaskFlow:

* Native PostgreSQL enums for `TaskStatus` and `TaskPriority`
* Native `tsvector` and GIN indexes for the bonus full-text task search

These features avoid implementing database-level equivalents through generic string columns or application-side search.

---

## 4. Why Redis + BullMQ

Redis and BullMQ are required by the assignment.

BullMQ was chosen instead of implementing a custom Redis queue because it provides:

* Retry and backoff handling
* Queryable job states
* `waiting`, `active`, `completed`, and `failed` states
* Job status information used by `GET /jobs/:id`
* Redis-coordinated rate limiting

The Redis-backed limiter also allows the global email limit to remain coordinated when multiple worker instances are running, rather than applying a separate limit inside each process.

---

## 5. CORS and GitHub Codespaces

TaskFlow uses:

```ts
origin: true
```

for CORS.

This reflects the request's Origin rather than relying on a fixed allowlist.

This is intentional because GitHub Codespaces generates a different frontend URL for each Codespace, for example:

```text
https://<codespace-name>-5173.app.github.dev
```

A static allowlist would therefore require manual configuration whenever a new Codespace is created.

The frontend sends:

```text
Authorization
X-Organization-Id
```

and these headers are handled by the CORS preflight configuration.

CORS is not the application's authorization boundary.

Every request is still protected by:

```text
JWT authentication
        ↓
Organization membership verification
        ↓
Tenant-scoped database queries
```

Therefore, permissive CORS determines which browser origins can attempt to read responses; it does not grant authorization to access another tenant's data.

---

## 6. Why Offset Pagination

The assignment allows either offset or cursor pagination.

TaskFlow uses offset pagination because:

1. The expected project/task datasets are small-to-medium rather than millions of rows per project.
2. The assignment's example response uses:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

3. Reviewers can directly request arbitrary pages.
4. The API remains straightforward to exercise through Swagger and Postman.

The trade-off is that offset pagination becomes less efficient on very large, frequently changing datasets because of `OFFSET` cost, `COUNT(*)`, and page drift.

If task volumes eventually reach millions of records per project, cursor/keyset pagination based on `(created_at, id)` would be the natural next step.

---

## 7. Password Hashing

TaskFlow uses bcrypt with:

```text
BCRYPT_ROUNDS=12
```

The configuration enforces a minimum cost of 12:

```ts
z.coerce.number().int().min(12)
```

The application refuses to start if a lower value is configured.

bcrypt was selected because the assignment explicitly requires it and because the configured cost factor is directly auditable in the implementation.

---

## 8. JWT Design

TaskFlow uses separate secrets for access and refresh tokens:

```text
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
```

This prevents compromise of one signing secret from automatically compromising the other token type.

The token payload is intentionally minimal.

### Access token

```json
{
  "sub": "userId",
  "type": "access"
}
```

### Refresh token

```json
{
  "sub": "userId",
  "type": "refresh",
  "jti": "tokenId"
}
```

Role and organization are intentionally **not** embedded in the JWT.

A user can belong to multiple organizations and can have different roles in each organization. Embedding one organization/role into the token would therefore create stale or incorrect authorization context when the user changes organizations.

Instead, the organization and role are resolved from `org_members` for each authenticated request.

---

## 9. Refresh Token Strategy

Only a SHA-256 hash of the refresh token is stored:

```text
refresh_tokens.token_hash
```

The raw refresh token is never persisted.

This provides an additional layer of protection if the database is exposed.

Refresh-token rotation is also implemented.

Each refresh operation:

1. Validates the presented refresh token.
2. Issues a new access/refresh token pair.
3. Revokes the presented refresh token.
4. Links the old token to the replacement using `replaced_by_id`.

If a previously revoked refresh token is presented again, this is treated as a potential token-theft signal. All active refresh tokens for that user are revoked as a defensive response.

---

## 10. RBAC

TaskFlow implements exactly the two roles defined by the assignment:

```text
org_admin
member
```

No additional roles are introduced.

Authorization is centralized through:

```text
middleware/role.middleware.ts
```

using:

```text
requireRole(...roles)
```

The authorization check is attached to protected routes through Fastify `preHandler` hooks instead of duplicating role checks inside individual controllers.

Currently, this is used for operations such as:

* Member management
* Project deletion

---

## 11. Multi-Tenant Isolation

Tenant isolation is deliberately enforced at multiple layers.

### Layer 1 — Tenant Middleware

`tenant.middleware.ts` verifies that the authenticated user actually has a membership record for the requested organization.

No valid membership means no authenticated organization context is attached to the request.

### Layer 2 — Repository Queries

Organization-owned queries include the authenticated `organizationId` directly in the database `WHERE` condition.

The application does not:

```text
fetch resource
      ↓
filter tenant in memory
```

Instead, tenant scope is part of the database query itself.

For tasks, the query also scopes through:

```text
project.organizationId
```

This prevents a task ID from becoming a cross-tenant access path.

### 403 vs 404

There are two distinct cases:

```text
User selects an organization they do not belong to
                    ↓
                  403
```

versus:

```text
User is authenticated for their organization
                    ↓
Resource belongs to another organization
                    ↓
Scoped query cannot see it
                    ↓
404
```

This prevents cross-tenant resource existence from being unnecessarily exposed.

---

## 12. Foreign Key CASCADE / RESTRICT Strategy

Container-owned resources use cascading deletion where the child has no independent meaning.

For example:

```text
Organization
    ├── Projects
    │      └── Tasks
    │             ├── Assignments
    │             └── Comments
    └── Members
```

Deleting the parent therefore cascades to its dependent records.

User deletion is more restrictive for historical records.

`task_assignments` and `comments` use `RESTRICT` because automatically deleting those records would destroy assignment and authorship history.

The intended approach for removing a user's access is to remove the relevant organization membership or deactivate the user rather than destroying historical records.

---

## 13. Indexing Strategy

Indexes are based on query patterns actually used by the application rather than being added indiscriminately.

### Organization membership

```text
org_members(organization_id, user_id)
```

Used for per-request membership verification.

### Projects

```text
projects(organization_id)
```

Used by organization-scoped project listing.

### Tasks

```text
tasks(project_id)
tasks(project_id, status)
tasks(project_id, priority)
tasks(due_date)
```

These support task listing, filtering, and dashboard queries.

### Task assignments

```text
task_assignments(task_id, user_id)
```

is unique and enforces the one-assignment-per-user-per-task invariant at the database level.

### Full-text search

```text
tasks.search_vector
```

has a GIN index for PostgreSQL full-text search.

---

## 14. Queue Retry and Backoff Semantics

The assignment specifies three retries with a three-step backoff:

```text
1s → 2s → 4s
```

TaskFlow interprets this as:

```text
Initial attempt
    ↓
Retry 1 — 1s
    ↓
Retry 2 — 2s
    ↓
Retry 3 — 4s
```

Therefore:

```text
4 total attempts
```

BullMQ configuration:

```ts
{
  attempts: 4,
  backoff: {
    type: "exponential",
    delay: 1000
  }
}
```

This interpretation is explicitly documented because "3 retries" can otherwise be interpreted as either three total attempts or three attempts after the initial attempt.

---

## 15. Dead-Letter Queue

BullMQ does not provide a separate first-class DLQ abstraction.

TaskFlow therefore uses a second BullMQ queue:

```text
task-assignment-notifications-dlq
```

When a notification job exhausts its configured attempts, the worker's `failed` event handler publishes the failed job to the DLQ.

This keeps failed notifications separately inspectable and replayable rather than allowing them to remain indefinitely mixed with the primary queue's failed jobs.

---

## 16. Assignment / Queue Consistency

This is the most important consistency decision in the notification workflow.

The system must persist the task assignment and enqueue its notification before returning success on the normal path.

However, PostgreSQL and Redis do not participate in the same distributed transaction.

Therefore, the application cannot atomically guarantee that both the PostgreSQL row and Redis job either succeed or fail together.

### Step 1 — Atomic Database Transaction

The API creates:

```text
TaskAssignment
NotificationOutbox(pending)
```

inside one PostgreSQL transaction.

Therefore, the assignment and its recovery record are committed atomically.

### Step 2 — Immediate Queue Enqueue

After the database transaction commits, the API immediately attempts to enqueue the BullMQ notification job.

If successful:

```text
outbox → dispatched
```

and the API returns the `jobId`.

### Step 3 — Redis Failure

If Redis/BullMQ is temporarily unavailable:

```text
Assignment → committed
Outbox → pending
Job → not yet created
```

The API still returns a successful assignment response with:

```json
{
  "jobId": null
}
```

The assignment itself is not rolled back because notification delivery is recoverable.

### Step 4 — Outbox Recovery

The worker periodically checks for pending outbox records.

The current recovery strategy:

```text
5s grace period
+
worker sweep every 10s
```

Pending records are published to BullMQ and then marked as dispatched.

### Result

The design provides:

```text
Assignment durability
+
At-least-once notification delivery
+
Eventual consistency
```

If the immediate enqueue fails, the expected recovery delay is bounded to approximately 15 seconds under the documented timing assumptions.

### Known Limitation

If the worker itself remains down, pending outbox records accumulate until the worker returns.

The current implementation does not provide dedicated alerting for an aging outbox backlog.

A production extension could expose the oldest pending outbox age through health or observability metrics.

---

## 17. Test Isolation

Integration tests use a dedicated test database.

Before each test, application tables are truncated instead of wrapping every test in an outer database transaction.

This was chosen because Fastify's `app.inject()`, Prisma connection pooling, and application-level Prisma transactions do not compose cleanly with an outer test transaction.

Table truncation is simpler and reliable for the dataset size used by the test suite.

Tests must never run against the normal development database.

---

## Engineering Summary

The main architectural principles are:

```text
Fastify
   ↓
Middleware / Hooks
   ↓
Authentication
   ↓
Tenant Verification
   ↓
RBAC
   ↓
Controllers
   ↓
Services
   ↓
Repositories
   ↓
PostgreSQL
```

For asynchronous work:

```text
API
 ↓
PostgreSQL Transaction
 ├── Assignment
 └── Outbox
 ↓
BullMQ / Redis
 ↓
Worker
 ↓
Mock Email
```

The design intentionally favors **explicit authorization boundaries, database-enforced invariants, recoverable asynchronous processing, and documented trade-offs** over claiming guarantees that the underlying infrastructure cannot actually provide.
