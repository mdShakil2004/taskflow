# Running TaskFlow in GitHub Codespaces

This guide covers running the complete TaskFlow stack in **GitHub Codespaces**:

* React frontend
* Fastify API
* PostgreSQL
* Redis
* BullMQ worker

No local Docker installation is required. Docker runs inside the Codespace.

---

## 1. Open the Repository in GitHub Codespaces

Open the repository:

**GitHub → Code → Codespaces → Create codespace on `main`**

The repository includes a development container configuration under:

```text
.devcontainer/
```

The Codespace provides:

* Node.js 20
* Docker
* Nested Docker support
* Project dependencies

After the Codespace finishes creating, open the terminal.

---

## 2. Start PostgreSQL and Redis

From the backend directory:

```bash
cd backend
```

Start the infrastructure:

```bash
docker compose up -d postgres redis
```

Verify:

```bash
docker compose ps
```

Expected:

```text
postgres   healthy
redis      healthy
```

You can verify PostgreSQL directly:

```bash
docker compose exec postgres pg_isready -U taskflow -d taskflow
```

Expected:

```text
accepting connections
```

Verify Redis:

```bash
docker compose exec redis redis-cli ping
```

Expected:

```text
PONG
```

---

## 3. Apply Database Migrations

Run Prisma migrations against the PostgreSQL container:

```bash
docker compose run --rm api npx prisma migrate deploy
```

Expected when migrations are already applied:

```text
No pending migrations to apply.
```

Check migration status:

```bash
docker compose run --rm api npx prisma migrate status
```

---

## 4. Seed the Database

Run:

```bash
docker compose run --rm api npm run prisma:seed
```

This creates the development/demo data required by the application.

---

## 5. Start the API and Worker

Start both services:

```bash
docker compose up -d api worker
```

Verify:

```bash
docker compose ps
```

You should see:

```text
postgres   healthy
redis      healthy
api        running
worker     running
```

Check the API logs:

```bash
docker compose logs --tail=50 api
```

Expected:

```text
TaskFlow API started
port: 3000
```

Check the worker:

```bash
docker compose logs --tail=50 worker
```

Expected:

```text
TaskFlow worker started, listening for task-assignment notifications
```

---

## 6. Verify the Backend

From the Codespace terminal:

```bash
curl http://localhost:3000/health
```

Expected:

```json
{
  "status": "ok",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

This verifies that the API can communicate with both PostgreSQL and Redis.

---

# 7. Frontend API URL in Codespaces

There is an important difference between local development and Codespaces.

When the React application runs in your browser, this:

```text
localhost:3000
```

refers to **your own computer**, not the Codespace.

The browser therefore needs to access the API through the Codespaces forwarded URL:

```text
https://<codespace-name>-3000.app.github.dev
```

The frontend environment should therefore contain:

```env
VITE_API_URL=https://<codespace-name>-3000.app.github.dev
```

The repository includes:

```text
scripts/setup-codespaces-env.sh
```

which can generate the Codespaces frontend API URL.

If necessary, regenerate it with:

```bash
npm run codespaces:env
```

---

# 8. Start the Frontend

From the repository root:

```bash
cd frontend
```

Install dependencies if required:

```bash
npm install
```

Start Vite:

```bash
npm run dev -- --host 0.0.0.0
```

The frontend listens on:

```text
5173
```

Codespaces should detect the port automatically.

Open the **Ports** panel and click the globe/open icon next to port `5173`.

---

# 9. Codespaces Port Configuration

The application uses:

|   Port | Service               | Browser Access |
| -----: | --------------------- | -------------- |
| `3000` | Fastify API + Swagger | Forwarded      |
| `5173` | React + Vite          | Forwarded      |
| `5432` | PostgreSQL            | Not forwarded  |
| `6379` | Redis                 | Not forwarded  |

Only the frontend and API need browser access.

PostgreSQL and Redis remain infrastructure services and should not be exposed to the browser.

---

# 10. Make Ports Public for a Reviewer

By default, Codespaces ports may be **Private**.

If an external reviewer needs to access the running application:

1. Open the **Ports** panel.
2. Find port `3000`.
3. Right-click it.
4. Select **Port Visibility → Public**.
5. Repeat for port `5173`.

The reviewer can then access:

```text
https://<codespace-name>-5173.app.github.dev
```

The frontend communicates with:

```text
https://<codespace-name>-3000.app.github.dev
```

Do **not** make PostgreSQL `5432` or Redis `6379` public.

---

# 11. Swagger / API Documentation

Swagger UI is available at:

```text
https://<codespace-name>-3000.app.github.dev/docs
```

For example:

```text
https://fuzzy-parakeet-wrv7rxxxv9939v5w-3000.app.github.dev/docs
```

Swagger provides an interactive interface for testing the backend API.

---

# 12. Verify the Complete Stack

Run:

```bash
docker compose ps
```

Then:

```bash
docker compose exec postgres pg_isready -U taskflow -d taskflow
```

Then:

```bash
docker compose exec redis redis-cli ping
```

Then:

```bash
curl http://localhost:3000/health
```

Then check the worker:

```bash
docker compose logs --tail=50 worker
```

Finally check Prisma:

```bash
docker compose run --rm api npx prisma migrate status
```

A healthy environment should have:

```text
PostgreSQL  → healthy
Redis       → healthy
API         → running
Worker      → running
Prisma      → no pending migrations
Health      → database: ok, redis: ok
Frontend    → port 5173
```

---

# 13. Useful Docker Commands

### View all services

```bash
docker compose ps
```

### View API logs

```bash
docker compose logs --tail=100 api
```

### Follow API logs

```bash
docker compose logs -f api
```

### View worker logs

```bash
docker compose logs --tail=100 worker
```

### Follow worker logs

```bash
docker compose logs -f worker
```

### Restart API

```bash
docker compose restart api
```

### Restart worker

```bash
docker compose restart worker
```

### Stop the stack

```bash
docker compose down
```

This does **not** remove the PostgreSQL volume.

### Stop and remove database volume

```bash
docker compose down -v
```

Use this only when you intentionally want to delete the local Docker PostgreSQL data.

---

# 14. Local Machine Compatibility

Codespaces does not change the application architecture.

The same Docker Compose setup can be run on a local machine with Docker installed:

```bash
docker compose up --build
```

The Codespaces-specific frontend configuration automatically uses the forwarded API URL when `CODESPACE_NAME` is available.

Outside Codespaces, the frontend falls back to:

```text
http://localhost:3000
```

Therefore the same codebase supports both:

```text
GitHub Codespaces
       │
       ├── Docker
       ├── PostgreSQL
       ├── Redis
       ├── API
       ├── Worker
       └── React
       
and

Local Docker
       │
       ├── PostgreSQL
       ├── Redis
       ├── API
       ├── Worker
       └── React
```

---

# 15. Recommended Startup Sequence

For a fresh Codespace:

```bash
cd backend
```

```bash
docker compose up -d postgres redis
```

```bash
docker compose run --rm api npx prisma migrate deploy
```

```bash
docker compose run --rm api npm run prisma:seed
```

```bash
docker compose up -d api worker
```

Verify:

```bash
docker compose ps
```

Then:

```bash
curl http://localhost:3000/health
```

Start the frontend:

```bash
cd ../frontend
npm install
npm run dev -- --host 0.0.0.0
```

Open the forwarded **5173** port in the browser.

---

# Summary

```text
                    GitHub Codespace
                           │
                    Docker Compose
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     Frontend              API              Worker
      :5173               :3000               │
        │                  │                  │
        │                  ├──── PostgreSQL ───┤
        │                  │       :5432       │
        │                  │                  │
        │                  └──── Redis ────────┘
        │                          :6379
        │
        └──────── Browser
```

Only **5173** and **3000** need to be forwarded to the browser. PostgreSQL and Redis remain internal infrastructure.
