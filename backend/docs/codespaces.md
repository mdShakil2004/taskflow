# Running TaskFlow in GitHub Codespaces

This covers running the **entire project — API, worker, Postgres, Redis, and
the React frontend — in GitHub Codespaces (or an equivalent cloud dev
environment)**, with nothing installed on your laptop except a browser (and
optionally VS Code, if you prefer the desktop app connected to the Codespace
instead of the browser-based editor).

Docker is still a hard requirement of the assignment and is still fully
present in this repo (`Dockerfile`, `docker-compose.yml`) — the only thing
that changes is *where* `docker compose up` runs: inside the cloud
container, not on your machine. See `.devcontainer/devcontainer.json`, which
gives the Codespace its own nested Docker daemon
(`docker-in-docker` devcontainer feature) specifically so that command works.

## 1. Open the repository in a Codespace

On GitHub: **Code → Codespaces → Create codespace on main**. The devcontainer
build takes a minute or two the first time (it installs Node 20 + Docker,
then `postCreateCommand` runs `npm install` for both the API and the
frontend, and generates `frontend/.env` automatically — see step 3).

## 2. Start the backend infrastructure

In the Codespace terminal:

```bash
docker compose up --build
```

This starts `postgres`, `redis`, `api`, and `worker` — identical to running
it locally, just executed on GitHub's infrastructure instead of yours.

In a second terminal, run migrations and seed data (only needed once per
fresh database):

```bash
npm run db:setup
```

Watch for the "TaskFlow API started" log line, and confirm:

```bash
curl http://localhost:3000/health
```

This `curl` works from *inside* the Codespace terminal because the terminal
shares the container's network — this is different from the browser, see
step 4.

## 3. Frontend API URL — why it isn't just `localhost:3000`

This is the one genuinely different thing about cloud development, so it's
worth explaining rather than hand-waving:

When you open the frontend in your browser, the React/Vite JavaScript runs
**in your own browser on your own machine** — it is not "inside" the
Codespace. Your browser has no route to `localhost:3000`, because that
`localhost` refers to the Codespace's cloud VM, not your laptop. Instead,
the browser must call the API's **forwarded** URL, which GitHub generates
per-Codespace and looks like:

```
https://<codespace-name>-3000.app.github.dev
```

`postCreateCommand` already ran `scripts/setup-codespaces-env.sh`, which
detects it's running in Codespaces (via the `CODESPACE_NAME` environment
variable GitHub injects automatically) and writes the correct URL into
`frontend/.env` for you — nothing to hand-copy. If you ever need to
regenerate it (e.g. after significant devcontainer changes):

```bash
npm run codespaces:env
```

## 4. Start the frontend

```bash
cd frontend
npm run dev
```

VS Code / the Codespaces browser UI will prompt to open the forwarded
`5173` port — accept it, or open the **Ports** tab and click the globe icon
next to `5173`.

## 5. Port visibility

By default, Codespaces forwards ports as **Private** — reachable only when
you're browsing while signed into the same GitHub account that owns the
Codespace. That's sufficient for your own testing. If you need someone else
(e.g. a reviewer) to open the running app directly:

1. Open the **Ports** tab in the Codespace.
2. Right-click port `3000` (API) → **Port Visibility → Public**.
3. Do the same for port `5173` (frontend).

Only `3000` and `5173` should ever need to be forwarded or made public.
`5432` (Postgres) and `6379` (Redis) are bound to `127.0.0.1` in
`docker-compose.yml` specifically so they never show up as forwardable in
the first place — the frontend talks to the API only, never to the database
or queue directly, matching the assignment's security model.

## 6. Swagger / API docs

Once the API is running, Swagger UI is at the forwarded `3000` URL + `/docs`,
e.g. `https://<codespace-name>-3000.app.github.dev/docs`.

## Summary of ports

| Port | What | Forwarded? |
|---|---|---|
| 3000 | API + Swagger (`/docs`) | Yes |
| 5173 | Frontend (Vite dev server) | Yes |
| 5432 | Postgres | No — loopback only |
| 6379 | Redis | No — loopback only |

## Going back to a plain local machine later

Nothing here is Codespaces-specific at the application level — the same
`docker compose up --build` and `npm run dev` commands work identically on a
laptop with Docker Desktop installed. `scripts/setup-codespaces-env.sh`
automatically falls back to `VITE_API_URL=http://localhost:3000` when
`CODESPACE_NAME` isn't set, so the same script works in both environments.
