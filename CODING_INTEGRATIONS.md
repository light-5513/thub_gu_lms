# Coding Platform Integrations

The system never talks to platforms directly from feature code. Each platform implements the adapter contract in `backend/app/integrations/base.py`:

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
| **GeeksforGeeks** | `authapi.geeksforgeeks.org/api-get/user-profile-info/` | undocumented | none | Public solved count and score/streak fields; endpoint may change without notice |
| **HackerRank** | — | n/a | n/a | No usable public API → adapter raises `AdapterNotConfigured`; skipped by sync jobs |
| **HackerEarth** | — | n/a | n/a | Same as above |

> GeeksforGeeks does not document a developer API. Its public profile JSON endpoint currently provides solved counts and score/streak fields; the integration validates responses so failures are visible instead of saving empty statistics.

## Per-platform statistics and daily history

Current totals remain separate by platform in `coding_statistics`. Daily rows are stored independently in `coding_activity` with a unique `(student_id, platform, date)` key. The portal lets a user choose a start/end date and inspect one platform's own daily measure at a time.

| Platform | Current profile detail | Daily measure | Coverage limits |
|---|---|---|---|
| LeetCode | Easy/medium/hard solved, total submissions, contest rating/rank/count, reputation, active days and streak | Submissions (all verdicts) | `userCalendar` is from LeetCode's undocumented GraphQL schema; its daily count is not accepted problems |
| Codeforces | Current/peak rating, rank title, contribution, friends, contest count, accepted problems, submission count and acceptance rate | Unique accepted problems, accepted submissions, or submissions | Derived from the latest 10,000 submissions; requests are serialized with a two-second interval |
| CodeChef | Solved total, current/peak rating, stars, global/country rank and rating-history count | Increase in solved total detected between syncs | Not the exact solve date; run this sync daily for a daily estimate |
| AtCoder | Accepted total/rank, current/peak rating and rated contest count | Unique accepted problems, accepted submissions, or submissions | Last 365 days, capped at 500 submissions by the community API |
| GeeksforGeeks | Solved total, score, monthly score, current/longest streak and articles | Increase in solved total detected between syncs | Not the exact solve date; run this sync daily for a daily estimate |
| GitHub | Public repositories, followers/following, gists, recent commits, pushes, pull requests and public events | Public commits, pushes, pull requests or public events | Public events API returns at most 300 recent events; private contributions are not included |
| HackerRank / HackerEarth | No fetched stats | Not available | No usable unauthenticated public API is configured |

Daily challenge counts use each platform's accepted-problem records where available. CodeChef and GeeksforGeeks provide only totals, so the app records the increase between syncs on the day of the later sync; those dates are estimates, not source-provided solve timestamps. The UI labels LeetCode as submissions and GitHub as public activity so neither appears as problems solved. The admin per-student report and student Coding Stats page use the same activity endpoint and retain the soft neumorphic portal styling.


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

1. Create `backend/app/integrations/<platform>.py` implementing the three methods.
2. Register it in `backend/app/integrations/__init__.py::_REGISTRY`.
3. Add the platform slug to the frontend `PLATFORM_META` map (student profile card).
4. If it needs credentials, add an env var in `.env.example`/`config.py` and read it via `settings`.

## Rate-limit etiquette

Keep `concurrency ≤ 4` and `request_delay_ms ≥ 200` for unofficial endpoints. For Codeforces prefer running syncs spaced out (the official API allows roughly one call per second). GitHub should always use a dedicated PAT owned by the institution, not a personal account.
