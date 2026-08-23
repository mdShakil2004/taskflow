# TaskFlow — Implementation Plan

## 1. Mandatory Requirements

The following requirements were extracted from the assignment specification and form the core implementation scope.

### Backend & Infrastructure

* Node.js + TypeScript
* Fastify
* PostgreSQL
* Prisma
* Redis
* BullMQ
* Docker Compose
* Separate API and Worker processes
* Docker services:

  * API
  * Worker
  * PostgreSQL
  * Redis

### Database

Required tables:

```text
users
organizations
org_members
projects
tasks
task_assignments
comments
```

Supporting tables:

```text
refresh_tokens
notification_outbox
```

Required task status values:

```text
todo
in_progress
review
done
```

Required priority values:

```text
low
medium
high
urgent
```

---

# 2. Authentication

Required endpoints:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

Security requirements:

* bcrypt password hashing
* bcrypt cost ≥ 12
* Access JWT TTL: 15 minutes
* Refresh JWT TTL: 7 days
* Refresh tokens stored in the database
* Refresh tokens revocable
* Authentication rate limit:

  * 10 requests/minute/IP
  * Applied to all four authentication endpoints

Implemented additionally:

* Refresh-token rotation
* Logout-all-devices
* SHA-256 hashed refresh-token storage

---

# 3. RBAC

Two organization roles:

```text
org_admin
member
```

### `org_admin`

Can:

* Manage organization members
* Delete projects

### `member`

Has normal organization-scoped project/task access subject to the application's authorization rules.

---

# 4. Multi-Tenancy

Organization context must be derived from the authenticated user's membership.

The system must **never trust a client-supplied organization ID as an authorization decision**.

Authorization flow:

```text
Authenticated User
       ↓
Selected Organization Context
       ↓
Database Membership Lookup
       ↓
User + Organization + Role
       ↓
Authorized Request Context
       ↓
Organization-scoped Query
```

Cross-tenant access must return:

```text
403 Forbidden
```

No data from another organization may be exposed.

---

# 5. Projects and Tasks

## Projects

Full CRUD:

```text
Create
Read
Update
Delete
```

Projects are organization-scoped.

---

## Tasks

Full CRUD:

```text
Create
Read
Update
Delete
```

Task filtering supports:

* Status
* Priority
* Assignee
* Due-date range

Pagination uses **offset pagination**:

```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

Offset pagination was selected because the assignment explicitly allows either offset or cursor pagination and presents the above response structure.

Validation uses Zod.

Errors follow the consistent structure:

```json
{
  "error": "...",
  "code": "...",
  "details": {}
}
```

---

# 6. Task Assignment

Required operations:

```text
Assign
Unassign
```

Assignment validation must ensure:

* Task belongs to the current organization
* Assignee belongs to the same organization
* Duplicate assignment is rejected
* Database uniqueness prevents concurrent duplicate assignments

Assignment notification processing must be asynchronous.

The HTTP response must not wait for notification processing.

---

# 7. Database / Queue Consistency

The assignment requires both:

1. Assignment persistence
2. Notification job enqueueing

The implementation uses a transactional outbox strategy.

### Request flow

```text
POST assignment
       ↓
Validate task + organization + assignee
       ↓
DB Transaction
 ├── Create TaskAssignment
 └── Create NotificationOutbox(pending)
       ↓
Commit
       ↓
Attempt BullMQ enqueue
       ↓
 ┌───────────────┴────────────────┐
 │                                │
Success                         Failure
 │                                │
Mark dispatched                 Keep pending
 │                                │
Return response                 Worker recovery
```

If the immediate Redis/BullMQ enqueue fails, the assignment remains committed.

The worker periodically scans pending outbox records and retries publishing them.

This provides eventual delivery without rolling back a valid database assignment because of a temporary queue failure.

The implementation explicitly documents that PostgreSQL and Redis do not provide a distributed transaction across both systems.

---

# 8. Background Jobs

BullMQ is used for asynchronous task-assignment notifications.

The worker runs as a separate process.

### Queue

```text
task-assignment-notifications
```

### Retry Policy

The implementation interprets **3 retries** as:

```text
1 initial attempt
+
3 retries
=
4 total attempts
```

Backoff:

```text
1s
2s
4s
```

BullMQ configuration:

```text
attempts: 4
backoff:
  type: exponential
  delay: 1000
```

### Dead-Letter Queue

After all attempts are exhausted:

```text
task-assignment-notifications-dlq
```

is used for permanently failed notification jobs.

### Job Status

```text
GET /jobs/:id
```

returns job information including:

```text
jobId
status
metadata
```

---

# 9. Dashboard

The dashboard provides task counts grouped by status.

The implementation uses a single aggregate database query rather than fetching all tasks and calculating counts in application memory.

Expected grouping:

```text
todo
in_progress
review
done
```

---

# 10. Comments

Comments contain:

```text
task
author
body
```

Comments are:

* Task-scoped
* Author-attributed
* Organization-scoped

Cross-tenant comment access is prevented through the same organization authorization model.

---

# 11. Testing

## Unit Tests

Required coverage includes:

* Authentication
* Assignment validation
* Pagination

## Integration Tests

Required scenarios include:

* Login
* Task CRUD
* Cross-tenant access → `403`
* Validation errors

Tests use an isolated test database.

Additional implemented coverage includes:

* Queue-job integration test
* Coverage report

---

# 12. Documentation

Required documentation:

```text
OpenAPI / Swagger
Postman collection
README
architecture.md
technical-decisions.md
database.md
requirement-checklist.md
```

Swagger is served by the application.

The Postman collection is importable and uses environment variables for runtime values.

---

# 13. Implemented Bonus Features

The following features were implemented after the mandatory functionality.

### Soft Delete

Implemented for:

```text
projects
tasks
```

using:

```text
deleted_at
```

### Assignment Deduplication

Implemented using a Redis `SETNX` key with a 5-second deduplication window.

### Global Email Rate Limit

Implemented through BullMQ:

```text
50 notifications/minute
```

### Refresh Token Rotation

Implemented with:

* Token rotation
* Reuse detection
* Logout-all-devices

### Full-Text Search

Implemented using PostgreSQL `tsvector` over:

```text
task.title
task.description
```

### Bulk Task Status Update

Implemented.

### Coverage

Implemented using:

```text
vitest --coverage
```

### Queue Integration Test

Implemented.

---

# 14. Ambiguous Areas and Engineering Decisions

## 14.1 Pagination

The assignment allows:

```text
offset
OR
cursor
```

Decision:

```text
offset pagination
```

Reason:

* The assignment explicitly presents `{data,total,page,limit}`
* Straightforward for a reviewer
* Appropriate for the expected project-management workload

Detailed rationale:

```text
docs/technical-decisions.md
```

---

## 14.2 Database / Queue Consistency

Decision:

```text
Transactional assignment + outbox
+
Immediate BullMQ enqueue attempt
+
Background recovery
```

The assignment requires the assignment to be persisted and the job to be enqueued before the response returns while also requiring a strategy for partial failure.

The implementation therefore:

1. Commits assignment + outbox in one PostgreSQL transaction.
2. Attempts immediate BullMQ enqueue.
3. Marks the outbox record dispatched when successful.
4. Leaves the outbox record pending if enqueue fails.
5. Lets the worker recover pending records.

This avoids losing notifications without coupling the assignment transaction to Redis availability.

---

## 14.3 Retry Semantics

The assignment specifies:

```text
3 retries
```

with:

```text
1s / 2s / 4s
```

The implementation interprets this as:

```text
Initial attempt
Retry 1 → 1s
Retry 2 → 2s
Retry 3 → 4s
```

Therefore:

```text
4 total attempts
```

---

## 14.4 Refresh Token Storage

The assignment requires refresh tokens to be stored in the database and revocable but does not explicitly require hashing.

Decision:

```text
Store SHA-256 hash
```

rather than plaintext refresh tokens.

This reduces exposure if database contents are compromised.

---

## 14.5 Task Assignment Uniqueness

The assignment does not explicitly define duplicate assignment behavior.

Decision:

```text
@@unique([taskId, userId])
```

at the database level.

The service layer performs a pre-check to return a clean duplicate-assignment error, while the database constraint protects against concurrent requests.

---

## 14.6 CASCADE / RESTRICT

Deletion behavior is documented per relationship in:

```text
docs/database.md
```

General approach:

```text
Organization
    ↓ CASCADE
Members / Projects
    ↓
Project
    ↓ CASCADE
Tasks
    ↓ CASCADE
Assignments / Comments
```

User deletion is restricted where doing so would destroy assignment or authorship history.

Users should instead be deactivated rather than hard-deleted when historical records depend on them.

---

# 15. Implementation Order

The implementation was structured into the following phases:

```text
Phase 1
Scaffold
        ↓
Phase 2
Database / Migrations / Seed
        ↓
Phase 3
Authentication
        ↓
Phase 4
RBAC / Multi-Tenancy
        ↓
Phase 5
Projects
        ↓
Phase 6
Tasks / Filters / Dashboard
        ↓
Phase 7
Task Assignments
        ↓
Phase 8
BullMQ / Worker
        ↓
Phase 9
Comments
        ↓
Phase 10
Tests
        ↓
Phase 11
Swagger / Postman
        ↓
Phase 12
Docker Validation
        ↓
Phase 13
Documentation
        ↓
Phase 14
Final Audit
```

The bonus functionality was implemented only after the core assignment requirements were completed.
