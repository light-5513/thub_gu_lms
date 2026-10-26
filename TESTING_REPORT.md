# LMS system test report

**Run date:** 2026-10-26
**Application:** FastAPI and React monolith at `http://127.0.0.1:8000`

## Results

| Check | Result | Evidence |
|---|---|---|
| Backend test suite | Pass | 83 pytest tests passed, including batch-scoped leaderboard cases |
| Frontend production build | Pass | Final TypeScript check and Vite build completed with `npm.cmd run build` |
| Live system smoke | Pass | 12 of 12 checks passed after the final restart |
| MongoDB connection | Pass | `/api/ready` returned HTTP 200 and `{"ready":true}`; `/api/health` reported database healthy |
| MongoDB indexes | Pass | Read-only audit found 64 expected indexes across 24 collections |
| API route contract | Pass | 58 registered paths and 45 statically identified frontend API references reviewed; no confirmed mismatch |
| Anonymous route sweep | Pass | All 28 GET operations under `/api/admin/` and `/api/student/` returned HTTP 401 |

The live smoke checked the root, admin, and student SPA routes; all five JS/CSS
assets referenced by `index.html`; database readiness and health; and anonymous
access to two protected API endpoints. Both protected endpoints returned HTTP
401. The asset checks require the correct JS or CSS MIME type, so an HTML SPA
fallback cannot hide a missing bundle.

## Fixes covered by this run

- `/api/ready` returns HTTP 503 when MongoDB is unavailable, and Render now
  uses that endpoint for its health check. The unavailable-database case is
  covered by a focused backend test; the live check confirmed the healthy case.
- Redis worker connection settings now preserve credentials and TLS from the
  configured Redis URL. Without Redis, the current app uses its inline job
  fallback; `/api/health` reports Redis unavailable and worker status accordingly.
- Frontend API error states, attendance pagination, date pickers, modal focus,
  and keyboard access were reviewed and built successfully.
- Leaderboards now start with an admin batch choice and rank only members of
  that batch. Student rankings and dashboard rank use the student's own batch.
  Lifetime and date-based results use live batch membership, so moving or
  removing a student updates their leaderboard scope without recalculation.
- The repository keeps application code in `backend/app` and `frontend/src`,
  backend tests in `backend/tests`, documentation in the root and `docs`, and a
  read-only smoke command in `scripts/system_smoke.py`.

## Verification limits

- The browser UI was reviewed through source and build checks. An authenticated
  browser session was unavailable for screenshot-level visual checks.
- Live third-party coding-platform sync, SMTP delivery, and a durable Redis
  worker were not exercised by this run. Their availability depends on external
  services and configuration.
- The MongoDB audit only inspected connection and indexes; it did not alter
  attendance, students, or other application records.
- Date-based activity is grouped by current batch membership. Historical batch
  rosters were not recorded, so a student's older activity follows their
  current batch rather than the batch they belonged to on the activity date.

## Run again

From the repository root on Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe -m pytest -c backend\pytest.ini backend\tests -q
```

Stop the running monolith before replacing `frontend/dist` on Windows, then:

```powershell
Set-Location frontend
npm.cmd run build
Set-Location ..
.\.venv\Scripts\python.exe run.py --host 127.0.0.1 --port 8000
```

In a separate terminal after the app is ready:

```powershell
.\.venv\Scripts\python.exe scripts\system_smoke.py
```
