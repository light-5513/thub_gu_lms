# Architecture

## High-level

```
┌──────────────┐        ┌─────────────────────┐
│  React SPA   │  HTTP  │      FastAPI         │
│ (student /   │◄──────►│  api/v1 routers      │
│  admin)      │ cookies│  ├─ auth             │
└──────────────┘        │  ├─ student          │
       ▲                │  ├─ admin/*          │
       │ /api proxy     │  └─ health           │
       │ (vite dev)     └─────────┬───────────┘
       │                          │ repositories
       │                  ┌───────▼───────────┐        ┌──────────────┐
       │                  │  services layer    │──────►│ MongoDB Atlas │
       │                  │  streaks/scoring/  │ Motor  └──────────────┘
       │                  │  sync/analytics…   │
       │                  └───────┬───────────┘
       │                          │ enqueue (ARQ)
       │                  ┌───────▼───────────┐
       │                  │   Redis queue      │
       │                  └───────┬───────────┘
       │                          │
       │                  ┌───────▼───────────┐   HTTPS    ┌──────────────┐
       └──────────────────│   ARQ worker      │───────────►│ Coding APIs  │
          email (SMTP)    │  email/sync/recalc│            └──────────────┘
                          └───────┬───────────┘
                                  │ SMTP (TLS)
                            ┌─────▼─────┐
                            │ Gmail App │
                            └───────────┘
```

## Backend layering

| Layer | Responsibility | Rule of thumb |
|---|---|---|
| `api/v1` | HTTP concerns: validation, status codes, auth deps | No business logic |
| `services` | Business rules: streak engine, scoring, sync, invitations | Framework-agnostic where possible |
| `repositories` | Mongo queries, index-friendly filters, serialization | Only place that talks to drivers |
| `integrations` | External coding-platform adapters with retries/backoff | One class per platform |

### Authentication & sessions

- Login issues a **15–30 min access JWT** and a **7-day refresh JWT**, both stored in **HttpOnly** cookies (refresh scoped to `/api/auth`). `Authorization: Bearer` is also accepted for API clients/tests.
- Every user has a monotonically increasing `token_version`. Logout and password changes bump it — all previously issued tokens die instantly.
- Claims include role + version; `get_current_user` re-checks the version against the DB so revocation is immediate.
- Route protection exists in the frontend for UX only; **the backend is the source of truth** (`require_student`, `require_staff`, `require_admin`).

### First-login flow (admin-created students)

```
admin creates student → random temp password generated
  → stored ONLY as Argon2 hash, must_change_password=true
  → invitation email queued on worker
student logs in with temp password → frontend redirects to /force-change-password
  → POST /api/auth/force-change-password clears the flag,
    bumps token_version and issues fresh cookies.
```

### Password reset flow

Opaque `secrets.token_urlsafe` token → SHA-256 hash stored with expiry (30 min TTL index) → emailed link `/reset-password?token=…` → validated single-use → password replaced, token consumed. The API always answers generically to avoid account enumeration.

## Streak engine

Pure functions in `services/streak_service.py` receive an ordered list of attendance records plus rule configuration from the settings collection:

- dates without scheduled classes never enter the computation → **no-class days can't count as absences**
- `absent_breaks_streak`, `leave_breaks_streak`, `late_counts_as_present` are configurable
- current streak = trailing run of attended sessions; longest = max historical run

Streaks are computed server-side only; the UI renders values.

## Scoring engine

`services/scoring_engine.py`:

- `attendance_score` = attendance percentage clamped to [0,100]
- `coding_score` = mean of per-platform normalized scores (`PLATFORM_MAXES` ceilings)
- `streak_score` = current streak ÷ configurable cap
- overall = weighted sum with weights from MongoDB settings, defensively normalized if they don't sum to 1.

Weights/thresholds/rules live in the `settings` collection (`/admin/settings`) — nothing hardcoded in business logic.

## Leaderboard pipeline

1. Triggers: coding sync completion, attendance change, manual recalculation, scoring-config change.
2. Worker/API runs `LeaderboardService.recalculate()` → recomputes overall + per-platform rows for all active students into `leaderboard_scores`.
3. A `leaderboard_snapshots` document records top-10 + timestamp.
4. Read paths query the precomputed scores collection — O(log n) reads, no heavy aggregation on page views.

## Coding synchronization

`CodingSyncService.start_job()` creates a job document (`coding_sync_jobs`) then enqueues `run_coding_sync_task` on ARQ. If Redis is unavailable the job executes as a background asyncio task instead, so local development still works.

Per-student processing:

- bounded concurrency via `asyncio.Semaphore(concurrency)` (settings)
- inter-request delay (`request_delay_ms`) for rate-limit friendliness
- adapter-level retries with exponential backoff for 429/5xx/timeouts/network errors
- failure isolation: one student's failure marks only that profile failed and continues the batch
- progress persisted incrementally (`processed/successful/failed/error_summary`) so the admin UI polls live status
- after completion the leaderboard recalculation is triggered automatically

## Consistency model

Attendance save → upsert records (unique student+session) → audit entry → streak/scores recomputed lazily by next recalculation. Coding stats update → scores recalculated at end of job → snapshot. Frontend never performs business calculations.

## Error handling

- Domain errors raise typed exceptions (`AuthError`, `ConflictError`, …) mapped to clean JSON responses.
- Unhandled exceptions log internally (with request-id) and return a generic human-readable message; stack traces never reach clients.
- Database-down returns **503** with a friendly message; health endpoint reports component status without credentials.

## Observability

Structured JSON logs with timestamp/level/request-id (+ user_id where relevant). Sensitive values (passwords, tokens, SMTP creds, Mongo URI) are filtered and never logged. Audit logs provide an application-level trail of every important admin action.
