# Graph Report - thub_gu_lms  (2026-11-12)

## Corpus Check
- 180 files · ~118,481 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .example 1, .ini 1)

## Summary
- 1896 nodes · 4516 edges · 123 communities (73 shown, 50 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 641 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend API Client
- Student Admin API
- Monitoring & Leaderboard Hooks
- Dashboard & Reports Hooks
- Auth Hooks
- Log Scrubbing
- Auth Deps & Enums
- Batch & Import Hooks
- Email & WhatsApp Services
- Admin API Wiring
- Health & Worker Infra
- Form & Date Components
- Regression Tests
- Core Errors & Audit
- Attendance Classes API
- Batches API
- Auth Endpoints
- Adapter Tests
- Streak Engine
- Test Fixtures & Monitor Svc
- Student Portal API
- Report Service
- Analytics Service
- Invitation API
- Leaderboard Service
- Attendance Hooks
- WhatsApp Server Core
- Import Preview/Confirm
- MongoDB Connection
- Scoring Engine
- Profile & Heatmap UI
- WhatsApp Package Deps
- TypeScript Config
- Activity Time & Monitor API
- Health/Queue Tests
- Security Tokens
- Coding Repository
- Frontend Dev Deps
- Student Report Tests
- System Smoke Test
- Architecture Doc
- Codeforces & LeetCode Adapters
- Invitation Import Parsing
- Deployment Ops Doc
- Invitation Service & AppError
- Auth Service
- Student Repository
- Batch Service
- Attendance Roster Tests
- Frontend Runtime Deps
- Client Tests (JS)
- FastAPI Main App
- Auth Flow Tests
- run.py Launcher
- Security Tests & Middleware
- Container Starter
- Render Config
- App Settings Config
- Adapter Base Contract
- Audit Repo/Service
- User & Reset Token Repos
- Attendance Schemas
- Scoring & Features Docs
- Coding Integrations Doc
- Batch Repository
- CodeChef & GfG Adapters
- Unsupported Adapters
- Attendance Repository
- Import Tests
- Settings Service
- WhatsApp Startup Control
- Sync & Leaderboard Docs
- Frontend Mount & Helpers
- Leaderboard Repository
- Attendance Service
- Database Doc
- App Shell
- Analytics API
- Error Handlers
- WhatsApp Invitation Docs
- Batch Monitor Service
- Coding Sync Service
- Class Repository
- Sync Job Repository
- Class Service
- API Reference Doc
- Coding Schemas
- AtCoder Adapter
- GitHub Adapter
- Settings Repository
- Knowledge Graph & Test Docs
- Stack & Deps Docs
- Vite Build Tooling
- Hardware UI Widgets
- WhatsApp Mongo Session Store
- WhatsApp Remote Auth
- Sync Trigger API
- Contact API
- NPM Scripts
- Request Middleware
- Repository Base Helpers
- WhatsApp Client Init
- Small Cluster 103
- Small Cluster 106

## God Nodes (most connected - your core abstractions)
1. `AppError` - 53 edges
2. `errorMessage()` - 53 edges
3. `oid()` - 47 edges
4. `Button` - 47 edges
5. `Card()` - 42 edges
6. `react` - 40 edges
7. `EmptyState()` - 39 edges
8. `Input` - 36 edges
9. `AuthService` - 35 edges
10. `Badge()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `MongoDB Collection Nodes` --semantically_similar_to--> `Database Design Guide`  [INFERRED] [semantically similar]
  docs/KNOWLEDGE_GRAPH.md → DATABASE.md
- `UI Routes and API Groups` --references--> `API Reference`  [INFERRED]
  docs/KNOWLEDGE_GRAPH.md → API.md
- `System Graph (SPA, FastAPI, Render container)` --semantically_similar_to--> `Architecture Guide`  [INFERRED] [semantically similar]
  docs/KNOWLEDGE_GRAPH.md → ARCHITECTURE.md
- `Sync Completed Email Template` --conceptually_related_to--> `Coding Synchronization (CodingSyncService)`  [INFERRED]
  backend/app/templates/email/sync_completed.html → ARCHITECTURE.md
- `Coding Sync Sequence` --semantically_similar_to--> `Coding Synchronization (CodingSyncService)`  [INFERRED] [semantically similar]
  docs/KNOWLEDGE_GRAPH.md → ARCHITECTURE.md

## Import Cycles
- 2-file cycle: `frontend/src/components/ui/DatePicker.tsx -> frontend/src/components/ui/forms.tsx -> frontend/src/components/ui/DatePicker.tsx`

## Hyperedges (group relationships)
- **Coding Platform Adapters implementing the adapter contract** — coding_integrations_adapter_contract, coding_integrations_leetcode, coding_integrations_codeforces, coding_integrations_codechef, coding_integrations_atcoder, coding_integrations_github, coding_integrations_geeksforgeeks, coding_integrations_hackerrank_hackerearth [EXTRACTED 0.95]
- **WhatsApp Invitation Delivery Flow** — api_invitations_import_endpoints, deployment_whatsapp_service, docs_knowledge_graph_whatsapp_node_api, docs_knowledge_graph_whatsapp_outbox, docs_knowledge_graph_lazy_chromium, environment_whatsapp_variables [EXTRACTED 0.85]
- **Attendance/Coding to Streak, Score and Leaderboard Flow** — architecture_streak_engine, architecture_scoring_engine, architecture_leaderboard_pipeline, architecture_coding_synchronization, database_scoring_collections [EXTRACTED 0.85]

## Communities (123 total, 50 thin omitted)

### Community 0 - "Frontend API Client"
Cohesion: 0.05
Nodes (59): assignBatchStudents(), createBatch(), deleteBatch(), getBatches(), getBatchStudents(), removeBatchStudent(), tokenParam, updateBatch() (+51 more)

### Community 1 - "Student Admin API"
Cohesion: 0.05
Nodes (31): client_meta(), create_student(), delete_student(), export_students(), get_student(), list_students(), resend_invitation(), reset_account() (+23 more)

### Community 2 - "Monitoring & Leaderboard Hooks"
Cohesion: 0.11
Nodes (51): useAuditLogs(), useBatchMonitor(), useLeaderboard(), useRecalcLeaderboard(), useStudentLeaderboard(), useSyncJob(), useSyncJobs(), useTriggerSync() (+43 more)

### Community 3 - "Dashboard & Reports Hooks"
Cohesion: 0.08
Nodes (47): downloadReport(), downloadStudentReport(), StudentReport, useAdminDashboard(), useAnalytics(), useAttendanceRecords(), useCodingActivity(), useHeatmap() (+39 more)

### Community 4 - "Auth Hooks"
Cohesion: 0.10
Nodes (42): useAcceptInvitation(), useForceChangePassword(), useForgotPassword(), useLogin(), useLogout(), useResetPassword(), FormField(), Input (+34 more)

### Community 5 - "Log Scrubbing"
Cohesion: 0.07
Nodes (8): JsonFormatter, _scrub_embedded_json(), _scrub_embedded_json_object(), _scrub_message(), _scrub_value(), TestJsonFormatter, TestScrubMessage, TestScrubValue

### Community 6 - "Auth Deps & Enums"
Cohesion: 0.09
Nodes (22): update_settings(), _extract_token(), get_current_user(), get_current_user_optional(), require_admin(), require_roles(), checker(), require_staff() (+14 more)

### Community 7 - "Batch & Import Hooks"
Cohesion: 0.14
Nodes (36): api, errorMessage(), ImportPreviewData, StudentListParams, studentsQueryString(), useAssignBatchStudents(), useBatchStudents(), useCreateBatch() (+28 more)

### Community 8 - "Email & WhatsApp Services"
Cohesion: 0.09
Nodes (10): whatsapp_status(), get_logger(), EmailService, _env(), queue_email(), queue_whatsapp(), _headers(), _service_url() (+2 more)

### Community 9 - "Admin API Wiring"
Cohesion: 0.08
Nodes (4): audit_logs(), get_settings(), Message, PaginatedResponse

### Community 11 - "Health & Worker Infra"
Cohesion: 0.09
Nodes (6): setup_logging(), recalc_leaderboard_task(), run_coding_sync_task(), WorkerSettings, create_admin(), reset()

### Community 12 - "Form & Date Components"
Cohesion: 0.12
Nodes (22): useSandboxToken(), dateKey(), DatePicker(), DatePickerProps, parseDateLocal(), ButtonProps, inputClasses, Size (+14 more)

### Community 13 - "Regression Tests"
Cohesion: 0.07
Nodes (15): client(), staff(), test_attendance_override_updates_session_timestamp(), test_batch_monitor_excludes_rows_saved_in_a_different_timezone(), test_batch_pagination_rejects_invalid_values(), test_batch_upload_keeps_blank_header_column_positions(), test_changed_username_clears_old_platform_statistics(), test_class_date_filter_is_inclusive_and_bson_safe() (+7 more)

### Community 15 - "Attendance Classes API"
Cohesion: 0.11
Nodes (12): AttendanceRecordPatch, create_class(), delete_class(), duplicate_class(), edit_attendance_record(), get_attendance(), get_class(), list_classes() (+4 more)

### Community 16 - "Batches API"
Cohesion: 0.10
Nodes (14): assign_students(), create_batch(), delete_batch(), get_batch_students(), list_batches(), remove_batch_student(), update_batch(), upload_batch_students() (+6 more)

### Community 17 - "Auth Endpoints"
Cohesion: 0.18
Nodes (15): accept_invitation(), change_password(), _clear_auth_cookies(), force_change_password(), ForceChangePasswordRequest, forgot_password(), get_sandbox_token(), invitation_info() (+7 more)

### Community 18 - "Adapter Tests"
Cohesion: 0.10
Nodes (10): GeeksForGeeksAdapter, get_adapter(), test_codeforces_normalize_shape(), fake_request(), test_geeksforgeeks_fetch_uses_public_profile_json(), test_geeksforgeeks_normalize_maps_profile_metrics(), test_geeksforgeeks_rejects_empty_profile_payload(), test_github_normalize_rejects_missing_profile() (+2 more)

### Community 19 - "Streak Engine"
Cohesion: 0.15
Nodes (13): breaks_streak(), compute_streaks(), counts_toward_streak(), _normalize(), d(), test_absent_breaks_streak(), test_all_present(), test_dates_without_class_are_neutral() (+5 more)

### Community 20 - "Test Fixtures & Monitor Svc"
Cohesion: 0.10
Nodes (7): db(), event_loop(), _insert_user(), make_user(), test_batch_monitor_counts_only_current_active_roster_and_reports_unmarked(), test_batch_monitor_empty_batch_and_staff_route(), test_db()

### Community 21 - "Student Portal API"
Cohesion: 0.17
Nodes (13): coding_activity(), coding_profiles(), dashboard(), delete_coding_profile(), get_profile(), heatmap(), leaderboard(), my_attendance() (+5 more)

### Community 22 - "Report Service"
Cohesion: 0.17
Nodes (12): _report_response(), reports(), student_report_download(), _fmt_dt(), _fmt_pct(), rows_to_csv(), rows_to_pdf(), rows_to_xlsx() (+4 more)

### Community 23 - "Analytics Service"
Cohesion: 0.12
Nodes (3): dashboard(), AnalyticsService, _range()

### Community 24 - "Invitation API"
Cohesion: 0.14
Nodes (12): bulk_invite(), invite_student(), AcceptInvitationRequest, BulkInviteRequest, ChangePasswordRequest, ForgotPasswordRequest, InviteRecipient, InviteRequest (+4 more)

### Community 25 - "Leaderboard Service"
Cohesion: 0.13
Nodes (7): LeaderboardService, test_date_leaderboard_is_limited_to_current_batch(), test_leaderboard_routes_require_batch_and_student_cannot_override_scope(), test_db(), test_leaderboard_total_and_off_page_rank_match_tied_rows(), test_lifetime_batch_rank_uses_current_membership_without_recalculation(), test_rank_of_respects_filters_and_zero_score_ties()

### Community 26 - "Attendance Hooks"
Cohesion: 0.17
Nodes (21): invalidateMonitoring(), useBatches(), useClassDetail(), useClasses(), useClassSession(), useCreateClass(), useCreateStudent(), useDeleteClass() (+13 more)

### Community 27 - "WhatsApp Server Core"
Cohesion: 0.11
Nodes (20): authenticate(), backupSyncIntervalMs, { Client, RemoteAuth }, crypto, decryptMessage(), dotenv, encryptionKey(), encryptMessage() (+12 more)

### Community 28 - "Import Preview/Confirm"
Cohesion: 0.11
Nodes (6): confirm(), ImportConfirmRequest, preview(), AcademicRepository, _aiter(), ImportService

### Community 29 - "MongoDB Connection"
Cohesion: 0.10
Nodes (6): connect_to_mongo(), ensure_indexes(), get_client(), get_db(), main(), main()

### Community 30 - "Scoring Engine"
Cohesion: 0.14
Nodes (12): attendance_score(), compute_coding_score(), compute_overall(), normalize(), platform_coding_score(), streak_score(), test_attendance_score_bounds(), test_compute_coding_score_averages_platforms() (+4 more)

### Community 31 - "Profile & Heatmap UI"
Cohesion: 0.17
Nodes (19): useCodingProfiles(), useDeleteCodingProfile(), useSaveCodingProfile(), useStreak(), useStudentProfile(), useUpdateProfile(), HeatCell(), Heatmap() (+11 more)

### Community 32 - "WhatsApp Package Deps"
Cohesion: 0.12
Nodes (20): dotenv, express, mongodb, qrcode, whatsapp-web.js, dependencies, dotenv@16.4.7, express@4.21.2 (+12 more)

### Community 33 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 34 - "Activity Time & Monitor API"
Cohesion: 0.15
Nodes (7): student_coding_activity(), monitor_batch(), leaderboards(), activity_date_key(), get_activity_timezone(), CodingActivityService, normalize_activity_range()

### Community 35 - "Health/Queue Tests"
Cohesion: 0.15
Nodes (7): test_job_falls_back_inline_without_live_worker(), test_readiness_rejects_missing_mounted_spa_asset(), test_readiness_uses_http_503_when_database_is_unavailable(), unavailable(), test_ready_database_and_optional_inline_jobs(), healthy(), test_worker_heartbeat_uses_arq_context_pool()

### Community 36 - "Security Tokens"
Cohesion: 0.16
Nodes (7): create_access_token(), create_refresh_token(), _create_token(), decode_token(), generate_secure_token(), generate_temp_password(), hash_token()

### Community 38 - "Frontend Dev Deps"
Cohesion: 0.15
Nodes (17): devDependencies, autoprefixer@^10.4.20, postcss@^8.4.41, tailwindcss@^3.4.10, @types/react@^18.3.4, @types/react-dom@^18.3.0, typescript@^5.5.4, name (+9 more)

### Community 39 - "Student Report Tests"
Cohesion: 0.15
Nodes (5): _build_report_full(), _build_report_sync(), _seed_full(), test_student_report_low_attendance_flag(), test_student_report_service_returns_expected_sections()

### Community 40 - "System Smoke Test"
Cohesion: 0.14
Nodes (4): AssetParser, fetch(), main(), check()

### Community 41 - "Architecture Doc"
Cohesion: 0.16
Nodes (15): Auth Endpoints (/auth/*), JWT Authentication and Sessions, Consistency Model, Architecture Guide, Error Handling and 503 Behavior, First-login Temp Password Flow, Observability (structured logs, audit logs), Password Reset Flow (+7 more)

### Community 42 - "Codeforces & LeetCode Adapters"
Cohesion: 0.17
Nodes (5): activity_date(), today_in_timezone(), CodeforcesAdapter, LeetCodeAdapter, process()

### Community 43 - "Invitation Import Parsing"
Cohesion: 0.21
Nodes (7): _cell_at(), _cell_text(), _column_indexes(), _iso(), parse_invitation_upload(), pending_invitations(), _read_invitation_rows()

### Community 44 - "Deployment Ops Doc"
Cohesion: 0.19
Nodes (14): ARQ Worker and Redis Queue, create_admin Bootstrap Script, Deployment Guide, Nginx Reverse Proxy Config, Operations Checklist, systemd Units (lms-api, lms-worker), Nginx + uvicorn + ARQ Topology, Application Variables (APP_ENV, APP_URL, API_URL) (+6 more)

### Community 45 - "Invitation Service & AppError"
Cohesion: 0.23
Nodes (7): AppError, ConflictError, _app_url(), InvitationService, _utcnow(), test_invitation_roll_conflict_leaves_no_orphan_account(), test_registration_rolls_back_user_when_student_write_fails()

### Community 49 - "Attendance Roster Tests"
Cohesion: 0.32
Nodes (12): student(), test_accepted_invitation_creates_an_explicitly_active_student(), test_attendance_save_rejects_partial_duplicate_and_other_batch_rosters(), test_batch_counts_follow_students_when_reassigned(), test_batch_roster_includes_every_eligible_member_across_groups(), test_explicit_include_inactive_retains_existing_repository_behavior(), test_legacy_attendance_can_be_assigned_only_to_its_students_batch(), test_remove_and_readd_batch_student_preserves_profile_and_attendance() (+4 more)

### Community 50 - "Frontend Runtime Deps"
Cohesion: 0.13
Nodes (15): dependencies, axios@^1.7.4, clsx@^2.1.1, date-fns@^3.6.0, @hookform/resolvers@^3.9.0, lucide-react@^0.441.0, react@^18.3.1, react-hook-form@^7.52.2 (+7 more)

### Community 51 - "Client Tests (JS)"
Cohesion: 0.13
Nodes (7): assert, axios, fs, path, test, ts, vm

### Community 52 - "FastAPI Main App"
Cohesion: 0.15
Nodes (3): _resolve_frontend_dist(), root(), spa_fallback()

### Community 53 - "Auth Flow Tests"
Cohesion: 0.22
Nodes (6): auth(), test_create_student_generates_hashed_temp_password(), test_force_password_change_flow(), test_forgot_reset_flow_single_use_tokens(), test_login_success_and_failure(), test_token_invalidation_on_logout()

### Community 54 - "run.py Launcher"
Cohesion: 0.19
Nodes (6): _kill_tree(), _load_dotenv_value(), _port_in_use(), start_whatsapp_api(), shutdown(), supervise()

### Community 56 - "Container Starter"
Cohesion: 0.20
Nodes (4): ensure_internal_secret(), main(), signal_process_group(), stop_processes()

### Community 57 - "Render Config"
Cohesion: 0.14
Nodes (13): generateValue, key, sync, value, services, autoDeploy, env, envVars (+5 more)

### Community 60 - "Audit Repo/Service"
Cohesion: 0.18
Nodes (3): AuditRepository, AuditService, _scrub()

### Community 62 - "Attendance Schemas"
Cohesion: 0.24
Nodes (8): AttendanceMarkRequest, AttendanceRecordInput, AttendanceSessionOut, AttendanceStudentEntry, ClassCreate, ClassListResponse, ClassOut, ClassUpdate

### Community 63 - "Scoring & Features Docs"
Cohesion: 0.20
Nodes (12): Student Portal Endpoints (/student/*), Scoring Engine, Streak Engine, BatchMonitorService, Learning, Attendance and Scoring Graph, C4 Predictive At-risk Analytics, B9 Auto-sync Schedule, D. DevOps and Quality (CI, Docker, Vitest, Playwright) (+4 more)

### Community 64 - "Coding Integrations Doc"
Cohesion: 0.17
Nodes (11): Sync Completed Email Template, CodingPlatformAdapter Contract, AtCoder Adapter, CodeChef Adapter, Codeforces Adapter, GeeksforGeeks Adapter, GitHub Adapter, HackerRank / HackerEarth (AdapterNotConfigured) (+3 more)

### Community 67 - "Unsupported Adapters"
Cohesion: 0.24
Nodes (3): AdapterNotConfigured, HackerEarthAdapter, HackerRankAdapter

### Community 69 - "Import Tests"
Cohesion: 0.23
Nodes (8): parse_xlsx(), validate_rows(), _build_workbook(), test_empty_file_rejected(), test_parse_rejects_missing_columns(), test_parse_valid_workbook(), test_validate_against_existing_db_records(), test_validate_catches_bad_rows()

### Community 71 - "WhatsApp Startup Control"
Cohesion: 0.21
Nodes (12): clearRestartTimer(), clearStartupTimer(), containerMemoryMb(), express, handleStartupTimeout(), main(), normalizePhone(), requestWhatsAppInitialization() (+4 more)

### Community 72 - "Sync & Leaderboard Docs"
Cohesion: 0.25
Nodes (9): Coding Sync Endpoints, Leaderboards Endpoints, Coding Synchronization (CodingSyncService), Leaderboard Pipeline, Adding a New Platform Procedure, Coding Sync Data Flow, Coding Platform Integrations Guide, Coding Sync Sequence (+1 more)

### Community 76 - "Database Doc"
Cohesion: 0.29
Nodes (10): Per-platform Daily Activity Measures, Academics Collections (classes, academic_years, batches), Attendance Collections (attendance_sessions, attendance_records), Coding Collections (profiles, statistics, activity, sync jobs/logs), Database Design Guide, ensure_indexes (database/mongo.py), Identity Collections (users, students, roles), MongoDB Atlas (+2 more)

### Community 77 - "App Shell"
Cohesion: 0.24
Nodes (8): react-dom@^18.3.1, setUnauthorizedHandler(), App(), queryClient, ToastProvider(), AuthProvider(), router, react-dom

### Community 78 - "Analytics API"
Cohesion: 0.24
Nodes (5): analytics(), _collect_report(), _name_of(), student_analytics(), test_low_attendance_export_includes_percentage_and_student_fields()

### Community 80 - "WhatsApp Invitation Docs"
Cohesion: 0.25
Nodes (7): Invitations and Bulk Import Endpoints, WhatsApp Invitation Service, WhatsApp Startup Diagnostics and 150s Timeout, Identity, Invitation and Reset Graph, Embedded whatsapp-web.js Node API, Encrypted WhatsApp Outbox, WhatsApp Variables (API_URL, TOKEN, OUTBOX_KEY)

### Community 81 - "Batch Monitor Service"
Cohesion: 0.28
Nodes (3): _attendance_counts(), _attendance_view(), BatchMonitorService

### Community 82 - "Coding Sync Service"
Cohesion: 0.31
Nodes (3): get_job(), list_jobs(), CodingSyncService

### Community 86 - "API Reference Doc"
Cohesion: 0.25
Nodes (8): Admin Students Endpoints, Analytics and Reports Endpoints, Cookie/Bearer Authentication, Classes and Attendance Endpoints, API Reference, API Error Format and Status Codes, Settings and Audit Endpoints, C5 QR Code Attendance

### Community 87 - "Coding Schemas"
Cohesion: 0.39
Nodes (5): CodingProfileInput, CodingProfileOut, LeaderboardEntry, LeaderboardResponse, SyncJobOut

### Community 91 - "Knowledge Graph & Test Docs"
Cohesion: 0.29
Nodes (7): MongoDB Collection Nodes, LMS Codebase Knowledge Graph, knowledge-graph.json, Tests Connected to the Graph, UI Routes and API Groups, LMS System Test Report, Verification Limits

### Community 92 - "Stack & Deps Docs"
Cohesion: 0.33
Nodes (6): Health and Ready Endpoints, Backend Dev/Test Dependencies, Backend Runtime Dependencies, Frontend SPA Entry (index.html), Technology Stack (React, FastAPI, MongoDB, ARQ), Test Results (83 pytest, 12/12 smoke, 64 indexes)

### Community 93 - "Vite Build Tooling"
Cohesion: 0.33
Nodes (4): vite@^5.4.2, @vitejs/plugin-react@^4.3.1, vite, @vitejs/plugin-react

### Community 97 - "Sync Trigger API"
Cohesion: 0.70
Nodes (3): client_meta(), recalc_leaderboard(), trigger_sync()

### Community 99 - "NPM Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

### Community 102 - "WhatsApp Client Init"
Cohesion: 0.50
Nodes (3): delay(), initializeWhatsAppClient(), ResilientClient

## Knowledge Gaps
- **26 isolated node(s):** `Cookie/Bearer Authentication`, `Admin Students Endpoints`, `Analytics and Reports Endpoints`, `Settings and Audit Endpoints`, `API Error Format and Status Codes` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 606 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Quick Start` connect `Deployment Ops Doc` to `System Smoke Test`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 45 inferred relationships involving `AppError` (e.g. with `update_batch()` and `upload_batch_students()`) actually correct?**
  _`AppError` has 45 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Cookie/Bearer Authentication`, `Admin Students Endpoints`, `Analytics and Reports Endpoints` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend API Client` be split into smaller, more focused modules?**
  _Cohesion score 0.05336538461538461 - nodes in this community are weakly interconnected._
- **Why does `LMS README` connect `Deployment Ops Doc` to `Sync & Leaderboard Docs`, `Architecture Doc`, `Database Doc`, `API Reference Doc`, `Knowledge Graph & Test Docs`, `Stack & Deps Docs`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `oid()` (e.g. with `.count_student_stats()` and `.create_session()`) actually correct?**
  _`oid()` has 43 INFERRED edges - model-reasoned connections that need verification._
- **Should `Student Admin API` be split into smaller, more focused modules?**
  _Cohesion score 0.053410893707033315 - nodes in this community are weakly interconnected._