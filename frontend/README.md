# TaskFlow Console

A React + Vite + TypeScript + Tailwind frontend for exercising every
endpoint of the TaskFlow backend (`../backend`) — built as a test/operations
console rather than a customer-facing product.

## Design

TaskFlow is a dispatch-style project and task queue, so the UI uses a
control-room visual language:

- Dark canvas
- Signal-colored status indicators
- Status states: `todo`, `in_progress`, `review`, `done`
- Priority levels: `low`, `medium`, `high`, `urgent`
- Monospace typography for IDs and job data

The signature component is **QueuePulse**
(`src/components/QueuePulse.tsx`).

QueuePulse polls a BullMQ job after a task assignment and displays its
lifecycle:

```text
pending → active → completed / failed
````

This makes the asynchronous notification pipeline directly visible and
testable from the UI.

## What It Exercises

### Authentication

* Register an organization and create its first admin
* Login
* Automatic access-token refresh on `401`
* Logout from the current device
* Logout from all devices

### Multi-Tenancy

* `GET /auth/me/organizations`
* Organization switcher in the sidebar
* Sends `X-Organization-Id` with subsequent API requests
* Allows manual verification of tenant isolation
* Cross-tenant requests are rejected by the backend

### RBAC

The UI reflects the user's organization role:

* `org_admin`

  * Manage members
  * Change member roles
  * Delete projects
* `member`

  * Regular project/task access
  * Administrative actions are disabled or hidden

Backend authorization remains authoritative even if a restricted request is
manually attempted.

### Projects & Tasks

* Project CRUD
* Task CRUD
* Status filtering
* Priority filtering
* Full-text task search
* Pagination
* Bulk task status updates
* Dashboard task counts

### Assignments

* Assign a task to an organization member
* Capture the returned `jobId`
* Monitor notification processing through QueuePulse
* Observe the asynchronous BullMQ workflow from the UI

### Comments

* View task comments
* Add comments
* Exercise task-scoped comment APIs

### Background Jobs

* Look up any job by ID
* Monitor job status
* Observe:

```text
pending → active → completed
```

or:

```text
pending → active → failed
```

## Run It

Install dependencies:

```bash
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

Set the API URL:

```env
VITE_API_URL=http://localhost:3000
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at:

```text
http://localhost:5173
```

The TaskFlow API must be running separately.

For GitHub Codespaces, see:

[`backend/docs/codespaces.md`](../backend/docs/codespaces.md)

## Build

Create a production build:

```bash
npm run build
```

The generated files are placed in:

```text
dist/
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
src/
├── api/
│   └── typed fetch client and backend endpoint functions
│
├── context/
│   ├── AuthContext
│   └── ToastContext
│
├── components/
│   ├── Layout
│   ├── StatusPill
│   ├── PriorityRail
│   ├── QueuePulse
│   └── ...
│
├── pages/
│   └── application pages and routes
│
└── lib/
    ├── localStorage session helpers
    └── error formatting
```

## Demo Credentials

### Organization A — Nimbus Logistics

| Role   | Email                   | Password       |
| ------ | ----------------------- | -------------- |
| Admin  | `admin@nimbus.example`  | `DemoPass123!` |
| Member | `member@nimbus.example` | `DemoPass123!` |

### Organization B — Solace Retail Group

| Role   | Email                   | Password       |
| ------ | ----------------------- | -------------- |
| Admin  | `admin@solace.example`  | `DemoPass123!` |
| Member | `member@solace.example` | `DemoPass123!` |

## Recommended Demo Flow

For a quick end-to-end demonstration:

1. Sign in as an organization admin.
2. Open the dashboard and inspect task counts.
3. Browse projects and tasks.
4. Filter tasks by status or priority.
5. Open a task and assign it to a member.
6. Observe the returned notification job through **QueuePulse**.
7. Watch the job transition from `pending` to `active` and then
   `completed`.
8. Add a comment to the task.
9. Switch organizations and verify that tenant-scoped data changes.
10. Sign in as a member to verify RBAC restrictions.

## Backend

The frontend communicates exclusively with the TaskFlow API.

```text
TaskFlow Console
       │
       │ HTTP / JSON
       ▼
Fastify API
       │
       ├── PostgreSQL
       │
       └── Redis / BullMQ
                 │
                 ▼
              Worker
```

The frontend never connects directly to PostgreSQL or Redis.

For backend architecture and implementation details, see:

* [`Architecture`](../backend/docs/architecture.md)
* [`Database Design`](../backend/docs/database.md)
* [`Technical Decisions`](../backend/docs/technical-decisions.md)
* [`Requirement Checklist`](../backend/docs/requirement-checklist.md)

```
```
