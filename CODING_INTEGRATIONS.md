# Coding Platform Integrations

The system never talks to platforms directly from feature code. Each platform implements the adapter contract in `app/integrations/base.py`:

```python
class CodingPlatformAdapter:
    async def fetch_profile(self, username) -> raw payload
    async def normalize(self, raw) -> standardized statistics dict
    def profile_url(self, username) -> str
```

`get_stats(username)` composes fetch → normalize with shared retry/backoff behavior.

## Shared behavior (all adapters)

- Configurable `timeout`, `max_retries`, `retry_delay`, `request_delay_ms`, `concurrency` — all stored in MongoDB settings (`/admin/settings`) and applied per job.
- **Retries**: 429 and 5xx are retried with exponential backoff (`delay * 2^attempt`). 404 fails fast as "profile not found". Timeouts and transport errors also retry.
- **Failure isolation**: a student whose profile fails is marked `failed` with the error; the batch continues.
- Statistics are normalized into a common vocabulary: `problems_solved`, `rating`, `max_rating`, `contributions`, `public_repos`, `followers`, `contests`, `rank`… (platform-dependent subset).

## Platform status

| Platform | API used | Official? | Auth | Notes |
|---|---|---|---|---|
| **Codeforces** | `codeforces.com/api/user.info` + `user.status` | ✅ official | none | ~1 req/sec per IP; solved counts computed from unique accepted problems |
| **GitHub** | REST `/users/{u}` + `/users/{u}/events` | ✅ official | optional PAT | Without `GITHUB_API_TOKEN`: 60 req/hr core limit. With token: 5,000/hr |
| **LeetCode** | `leetcode.com/graphql` (public query endpoint) | ❌ unofficial | none | Public profiles only; can change without notice |
| **CodeChef** | Profile page HTML scrape of embedded rating data | ❌ unofficial | none | No public API exists; parser fails gracefully if layout changes |
| **AtCoder** | kenkoooo AtCoder Problems API + `atcoder.jp/history/json` | ❌ community | none | AC count + rating history |
| **HackerRank** | — | n/a | n/a | No usable public API → adapter raises `AdapterNotConfigured`; skipped by sync jobs |
| **HackerEarth** | — | n/a | n/a | Same as above |

> The spec's rule is respected: no invented APIs. Platforms without legal/technical access paths implement the interface but explicitly report "not configured" instead of pretending to work.

## Data flow

```
POST /api/admin/coding-sync/leetcode        (admin)
   └─► coding_sync_jobs document created (status=queued, total=N)
        └─► ARQ task run_coding_sync_task
             ├─ load students' leetcode usernames
             ├─ semaphore(concurrency) + request_delay_ms pacing
             ├─ adapter.get_stats(username)   ← retries/backoff inside
             ├─ upsert coding_profiles (+sync_status)
             ├─ save coding_statistics (+bounded raw)
             ├─ increment job progress       ← admin UI polls live
             └─ on finish: leaderboard recalculation + audit log
```

## Adding a new platform

1. Create `app/integrations/<platform>.py` implementing the three methods.
2. Register it in `app/integrations/__init__.py::_REGISTRY`.
3. Add the platform slug to the frontend `PLATFORM_META` map (student profile card).
4. If it needs credentials, add an env var in `.env.example`/`config.py` and read it via `settings`.

## Rate-limit etiquette

Keep `concurrency ≤ 4` and `request_delay_ms ≥ 200` for unofficial endpoints. For Codeforces prefer running syncs spaced out (the official API allows roughly one call per second). GitHub should always use a dedicated PAT owned by the institution, not a personal account.
