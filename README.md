# LMS — Learning Management System

A production-oriented LMS with two portals — **Student** and **Teacher/Admin** — featuring attendance with streaks & heatmaps, coding-platform synchronization (LeetCode, Codeforces, CodeChef, AtCoder, GitHub), configurable scoring, leaderboards, analytics, reports and full audit trails.

| Layer    | Technology |
|----------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + React Hook Form + Zod + Recharts + Lucide |
| Backend  | Python 3.10+ / FastAPI / Pydantic v2 / Motor (async MongoDB) |
| Database | MongoDB Atlas (mandatory primary datastore) |
| Jobs     | Redis + ARQ worker (email queue, bulk import emails, coding sync, leaderboard recalculation) — **optional** in monolithic mode |
| Email    | Gmail SMTP with App Password (HTML templates + retries + delivery logs) — **optional** in monolithic mode |
| Invitations | Email and WhatsApp links; scan a QR once to link the sender account for WhatsApp |

> **New: monolithic mode.** A single `python run.py` command now serves the
> entire app (API + built frontend) on one port. No Docker, no separate
> frontend dev server, no Redis, no separate worker process required.
> See [Quick start](#quick-start).
> The Render Docker image starts the WhatsApp API in the same container as the
> LMS, on an internal loopback port.

---

## Repository layout

```
├── backend/
│   ├── app/              FastAPI app, API, services, repositories, integrations
│   ├── scripts/          Admin and database maintenance commands
│   ├── tests/            Pytest suite (mock MongoDB; no Atlas needed)
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/             React SPA (src/, public/, Vite config)
├── whatsapp-api/         Private WhatsApp Web client API for invitations
├── docs/                 Codebase knowledge graph and project guides
├── .env.example
├── Dockerfile
└── run.py                One-command API + built frontend launcher
```

## Quick start

### Prerequisites

- Python 3.10+
- Node.js 20+ — needed to build the frontend and run the WhatsApp invitation service
- A MongoDB Atlas cluster (free M0 tier works)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env: set MONGODB_URI, JWT_SECRET, SECRET_KEY,
# SMTP_USERNAME/SMTP_PASSWORD (Gmail App Password), and WhatsApp service keys.
```

To send invitations locally, start the Node service in `whatsapp-api/` with the
same MongoDB connection, set `WHATSAPP_API_URL=http://localhost:10000`, a
matching `WHATSAPP_API_TOKEN`, and a private `WHATSAPP_OUTBOX_KEY` in `.env`,
then click **Connect WhatsApp** on Admin → Invitations and scan the QR. See [Environment variables](ENVIRONMENT.md) and the
[deployment guide](DEPLOYMENT.md) for the Render setup.

`.env` is git-ignored and must never be committed.

### 2. Install dependencies

```bash
# Backend
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt     # Windows
# source .venv/bin/activate && pip install -r backend/requirements.txt  # macOS/Linux

# Frontend (only needed for the first build)
cd frontend && npm install && cd ..
```

### 3. Build the frontend (one-time, repeat after UI changes)

```bash
cd frontend && npm run build && cd ..
# → produces frontend/dist/
```

On Windows PowerShell, use `npm.cmd run build` if script execution blocks
`npm.ps1`. Stop the running monolith before rebuilding on Windows; Vite replaces
files in `frontend/dist`, and a running server can keep them locked. Restart
`python run.py` after a successful build.

### 4. Run everything with one command

```bash
python run.py
# → open http://localhost:8000
```

A single `uvicorn` process now serves **both the React SPA and the FastAPI
API on port 8000** — no Docker, no separate frontend dev server, no Redis,
no separate ARQ worker. All background jobs (emails, coding sync, leaderboard
recalculation) run inline via `asyncio.create_task`. Optional flags:

```bash
python run.py --port 9000          # custom port
python run.py --host 127.0.0.1     # localhost only
python run.py --reload             # dev: hot-reload backend code
python run.py --workers 4          # multi-worker (production)
```

> **Want the dev-mode experience** (live HMR on the frontend)? Run `npm run dev`
> in `frontend/` and `uvicorn app.main:app --reload --port 8000 --app-dir backend`
> from the repository root. Vite proxies `/api` to the backend on port 8000.
>
> **Want durable background jobs?** Add Redis and start the ARQ worker
> alongside the monolith (from the repository root):
> ```bash
> PYTHONPATH=backend arq app.workers.worker.WorkerSettings
> ```
> The API will automatically use it for emails/sync/recalculation so jobs
> survive process restarts. Without Redis, jobs run inline and die with
> the process — fine for small workloads.

### 5. Create the first super admin

The database starts empty; there is no web registration flow for the first
super admin. From the `backend/` directory, run
`python -m scripts.create_admin EMAIL PASSWORD` with real values to create
that account. No demo data is seeded. The
`backend/scripts/reset_db.py` maintenance command deletes all application
collections, so it is not part of normal setup.

## Running the test suites

```bash
# backend (mongomock; no Atlas needed)
.venv\Scripts\python.exe -m pytest -c backend\pytest.ini backend\tests -q

# frontend
cd frontend && npm run build   # strict TypeScript check + Vite build
```

With the app running, check database readiness, SPA pages, built assets, and
anonymous API guards without changing data:

```bash
python scripts/system_smoke.py
```

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system design, request flows, consistency model
- [`DATABASE.md`](DATABASE.md) — collections, indexes, access patterns
- [`API.md`](API.md) — endpoint reference
- [`ENVIRONMENT.md`](ENVIRONMENT.md) — every variable explained
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — production deployment without Docker
- [`CODING_INTEGRATIONS.md`](CODING_INTEGRATIONS.md) — adapter architecture, platform APIs, limits
- [`docs/KNOWLEDGE_GRAPH.md`](docs/KNOWLEDGE_GRAPH.md) — codebase map and machine-readable graph

## Security highlights

- Argon2 password hashing; only hashes stored, never plaintext or temp passwords echoed
- JWT access + refresh tokens in HttpOnly, SameSite=Lax cookies; token-version invalidation on logout/password change
- Per-user forced password change (`must_change_password`) after admin invitations
- Single-use, hashed (SHA-256), 30-minute password-reset tokens
- Login/reset rate limiting (Redis-backed, in-memory fallback)
- Role-based authorization enforced server-side on every endpoint
- Security headers, CORS allow-list, structured logs that never contain secrets
