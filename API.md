# API Reference

Base URL: `http://localhost:8000/api` (dev). Interactive Swagger docs at `/api/docs` in development only.

**Authentication** — HttpOnly cookies (`access_token`, `refresh_token`) are set by login/refresh. `Authorization: Bearer <token>` is accepted equivalently. Role requirements are noted per endpoint; the backend enforces authorization on every request.

---

## Health

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Component status: `api`, `database`, `redis`, `worker` — no credentials returned |
| GET | `/ready` | `{ready}` true when the database responds |

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | Rate limited 10/5min per IP. Returns `{role, must_change_password, redirect}` + sets cookies |
| GET | `/auth/me` | — | Current session summary |
| POST | `/auth/logout` | — | Revokes all tokens for the user |
| POST | `/auth/refresh` | — | Uses refresh cookie; rotates access token |
| POST | `/auth/forgot-password` | `{email}` | Always returns a generic message |
| POST | `/auth/reset-password` | `{token, new_password}` | Single-use hashed token, 30 min expiry |
| POST | `/auth/change-password` | `{current_password, new_password}` | Authenticated |
| POST | `/auth/force-change-password` | `{new_password}` | Only while `must_change_password=true` |

## Student portal — role STUDENT

| Method | Path | Description |
|---|---|---|
| GET | `/student/dashboard` | Welcome info, attendance totals vs threshold, streaks, coding score, component scores, overall rank |
| GET | `/student/profile` | Own profile + field permissions (email always read-only) |
| PUT | `/student/profile` | Update permitted fields only (first/last name, phone; academic fields if admin-enabled) |
| GET | `/student/attendance?year=` | Full attendance history with class subject/topic |
| GET | `/student/heatmap?year=` | Per-day status for the year; days without class are absent from the payload |
| GET | `/student/streak` | Current/longest streak, totals, percentage |
| GET | `/student/leaderboard?tab=&course=&branch=…` | Ranked entries + `me` rank highlight |
| GET | `/student/coding-profiles` | Connected platforms with stats & sync state |
| POST | `/student/coding-profiles` | `{platform, username}` connect/update |
| DELETE | `/student/coding-profiles/{platform}` | Disconnect |

## Admin — roles ADMIN / SUPER_ADMIN / TEACHER (staff)

### Dashboard
- `GET /admin/dashboard` — KPIs (totals, avg attendance vs threshold, low-attendance count, classes today, sync stats), 30-day attendance trend, platform distribution, top performers.

### Students
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/students` | Server-side search/sort/filter/pagination. Params: page, page_size, search, course, branch, section, batch_id, academic_year_id, status, sort_by, sort_dir |
| GET | `/admin/students/{id}` | Detail incl. attendance %, profiles, overall score |
| POST | `/admin/students` | Create + queue invitation email (temp password never returned) |
| PUT | `/admin/students/{id}` | Update / deactivate via `status` |
| DELETE | `/admin/students/{id}` | Deactivate account |
| POST | `/admin/students/{id}/resend-invitation` | New temp password emailed |
| POST | `/admin/students/{id}/reset-account` | Same as resend, forces change at next login |

Admin-only actions above may be restricted to ADMIN/SUPER_ADMIN by swapping `require_staff` → `require_admin`.

### Invitations & bulk import
| Method | Path | Description |
|---|---|---|
| POST | `/admin/invitations` | Invite one student (same as create) |
| POST | `/admin/invitations/bulk/preview` | Upload `.xlsx` (≤10 MB) → per-row validation report + import token |
| POST | `/admin/invitations/bulk/confirm` | Import validated rows; emails queued |

Preview response contains `total_records`, `valid_records`, `invalid_records`, `duplicate_records` and row-level errors like `Row 17: Invalid Email`. One bad row never aborts the import.

### Classes & attendance
| Method | Path | Description |
|---|---|---|
| GET / POST | `/admin/classes` | List (filterable, paginated) / create |
| GET / PUT / DELETE | `/admin/classes/{id}` | Manage; DELETE also removes its attendance |
| POST | `/admin/classes/{id}/duplicate` | Clone class |
| GET | `/admin/classes/{id}/attendance` | Roster (course/branch/section/batch/year matched) with saved statuses or unmarked |
| POST | `/admin/classes/{id}/attendance` | Save records `[{student_id, status}]`; statuses present/absent/late/leave; unique student+session enforced |

Every attendance edit writes an audit entry (before → after).

### Coding synchronization
| Method | Path | Description |
|---|---|---|
| POST | `/admin/coding-sync/{leetcode\|codechef\|codeforces\|atcoder\|github\|all}` | Queue background job (ADMIN) |
| GET | `/admin/coding-sync/jobs` | Recent jobs |
| GET | `/admin/coding-sync/jobs/{id}` | Live progress: total/processed/successful/failed/remaining/status/error_summary |

### Leaderboards
| Method | Path | Description |
|---|---|---|
| GET | `/admin/leaderboards?tab=overall\|leetcode\|…&course=&branch=&section=` | Snapshot-backed rankings |
| POST | `/admin/leaderboards/recalculate` | Recompute all scores (ADMIN) |

### Analytics & reports
| Method | Path | Description |
|---|---|---|
| GET | `/admin/analytics?days=7..365` | Trends, breakdowns by course/branch/section, distribution, attendance-vs-coding scatter data, perfect/low attendance lists, platform distribution |
| GET | `/admin/analytics/student/{id}?days=` | Per-student trend |
| GET | `/admin/reports?type=students\|attendance\|leaderboard\|coding&format=csv\|xlsx\|pdf` | File download |

### Settings & audit
| Method | Path | Description |
|---|---|---|
| GET / PUT | `/admin/settings` | Institution, threshold, weights, streak rules, sync tuning, timezone (ADMIN). Changes audited |
| GET | `/admin/audit-logs?page=&action=&user_id=` | Paginated audit trail |

## Error format

```json
{ "detail": "Human-readable message" }
```

Status codes: 400 validation/business rule, 401 unauthenticated/expired, 403 wrong role, 404 missing, 409 duplicates, 422 schema validation, 429 rate-limited, 503 database temporarily unavailable.
