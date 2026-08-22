# TaskFlow Console

A React + Vite + TypeScript + Tailwind frontend for exercising every
endpoint of the TaskFlow backend (the `../` directory of this repo) — built as a test/ops
console, not a customer-facing product.

## Design

Grounded in the backend's own domain: TaskFlow is a dispatch-style
project/task queue, so the UI borrows a control-room visual language —
dark canvas, signal-colored status dots (`todo`/`in_progress`/`review`/`done`,
`low`→`urgent` priority), monospace for IDs and job data. The signature
element is **QueuePulse** (`src/components/QueuePulse.tsx`): a live,
polling indicator that watches a BullMQ job move through
`pending → active → completed/failed` in real time after you assign a task —
making the async notification flow (the trickiest part of the backend)
directly visible and testable, not just a 201 response you have to trust.

## What it exercises

- **Auth**: register (creates org, becomes admin), login, transparent
  access-token refresh on 401 (`api/client.ts`), logout (single device or
  all devices)
- **Multi-tenancy**: `GET /auth/me/organizations` populates an org switcher
  in the sidebar; switching sends a different `X-Organization-Id` header on
  every subsequent request — the fastest way to manually verify cross-tenant
  403/404 behavior (log in as one org's admin, switch to an org you don't
  belong to, watch requests fail correctly)
- **RBAC**: member-role users see disabled/hidden admin actions (project
  delete, member role changes) that would 403 if attempted anyway
- **Projects & tasks**: full CRUD, filters (status/priority/search),
  pagination, bulk status update, dashboard counts
- **Assignments**: assign a user, capture the returned `jobId`, watch it
  live via QueuePulse
- **Comments**
- **Job lookup**: paste any job id and watch its status independently

## Run it

```bash
npm install
cp .env.example .env   # point VITE_API_URL at your running TaskFlow API
npm run dev
```

Requires the TaskFlow API running (see the repo root `README.md`) — by
default at `http://localhost:3000`.

## Build

```bash
npm run build     # tsc -b && vite build, output in dist/
npm run preview   # serve the production build locally
```

## Structure

```
src/
├── api/          # typed fetch client + one function per backend endpoint
├── context/      # AuthContext (session, org switching), ToastContext
├── components/   # Layout, StatusPill, PriorityRail, QueuePulse, ...
├── pages/        # one file per route
└── lib/          # localStorage session helper, error formatting
```
