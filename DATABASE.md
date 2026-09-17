# Database Design (MongoDB Atlas)

Connection string comes from `MONGODB_URI`; the database name from `MONGODB_DATABASE` (default `lms`). Connections are opened at startup, verified with `ping`, closed at shutdown, and exposed via health endpoints **without credentials**.

All indexes are created automatically by `app/database/mongo.py::ensure_indexes` on startup.

## Collections & access patterns

### Identity
| Collection | Purpose | Key indexes |
|---|---|---|
| `users` | Login accounts for every role | `email` (unique), `role`, `student_id` |
| `students` | Student records (course/branch/section/batch) | `email` (unique), `roll_number` (unique), course, branch, section, batch_id, academic_year_id, status |
| `roles` | Reserved for future dynamic roles | — |

Documents embed only what is read together; cross-references use ObjectId fields (`students.user_id`, `attendance_records.student_id`).

### Academics
| Collection | Purpose | Key indexes |
|---|---|---|
| `classes` | Scheduled class sessions | `date` desc, course/branch/section, academic_year_id, batch_id |
| `academic_years` | e.g. 2025-26 | `name` unique |
| `batches` | e.g. CSE 2026 | name, academic_year_id |

### Attendance
| Collection | Purpose | Key indexes |
|---|---|---|
| `attendance_sessions` | One per class that had attendance taken | `class_id` unique |
| `attendance_records` | One row per student per session; statuses: present / absent / late / leave | `(student_id, class_session_id)` unique compound, `student_id`, `date` |

Uniqueness of `(student_id, class_session_id)` is enforced with a bulk-upsert keyed on both fields — duplicate marking is impossible.

### Coding platforms
| Collection | Purpose | Key indexes |
|---|---|---|
| `coding_profiles` | username + sync status per platform per student | `(student_id, platform)` unique-ish upsert key, `platform`, `username` |
| `coding_statistics` | normalized stats + bounded raw payload | `(student_id, platform)` |
| `coding_sync_jobs` | job header: totals/status/error_summary | status, platform, created_at |
| `coding_sync_logs` | per-student per-job outcomes | job_id |

Raw platform payloads are stored only when serialized size < ~12 KB to keep documents small.

### Scoring
| Collection | Purpose | Key indexes |
|---|---|---|
| `leaderboard_scores` | Precomputed rows (`platform`: overall or specific) | `platform`+`score` desc, `student_id` |
| `streaks` | Optional materialized streak cache | `student_id` unique |
| `leaderboard_snapshots` | Timestamped snapshots incl. top-10 | created_at |

The scores collection is fully replaced on each recalculation (single writer, worker/API-triggered) so reads are always consistent snapshots.

### Platform / ops
| Collection | Purpose | Key indexes |
|---|---|---|
| `password_reset_tokens` | hashed token, single-use | `token_hash` unique, TTL on `expires_at` |
| `email_logs` | delivery tracking queued/sent/failed | status, created_at |
| `audit_logs` | action/entity/old/new/ip/user-agent | user_id, action, created_at |
| `settings` (+ `settings_history`) | app configuration & change history | `key` unique |
| `notifications` | future in-app notification channel | user_id, read, created_at |
| `import_previews` | short-lived bulk import staging (15 min) | expires naturally via confirm/delete |

## Modeling principles

1. **Access-pattern driven** — queries the UI makes (paginated students by filter, heatmap by date, leaderboard top-N) map directly to indexes above.
2. **Embed vs reference** — small immutable value data (statistics blobs) is embedded; anything referenced across features (students, classes) uses ObjectId references.
3. **No unbounded growth inside documents** — raw API payloads truncated, error summaries sliced (`$slice: -100`).
4. **TTL where appropriate** — password reset tokens expire server-side and via index.
