"""Coding profile synchronization engine.

Runs as a background worker task: iterates students, calls platform adapters
with rate limiting/concurrency control, normalizes statistics into MongoDB,
updates job progress and queues a leaderboard recalculation at the end.
One student's failure never stops the batch.
"""

import asyncio
import logging
import time
from datetime import datetime, timezone

from app.core.errors import NotFoundError
from app.integrations import get_adapter
from app.integrations.activity_time import get_activity_timezone, today_in_timezone
from app.models.enums import AuditAction, JobStatus
from app.repositories.coding import CodingProfileRepository, SyncJobRepository
from app.repositories.users import StudentRepository
from app.services.audit_service import AuditService
from app.services.settings_service import SettingsService

logger = logging.getLogger(__name__)


class CodingSyncService:
    def __init__(self, db):
        self.db = db
        self.profiles = CodingProfileRepository(db)
        self.jobs = SyncJobRepository(db)
        self.students = StudentRepository(db)
        self.audit = AuditService(db)

    async def start_job(self, platform: str, requested_by: dict, ip=None) -> dict:
        """Create a queued sync job for a platform ('all' = every platform)."""
        if platform == "all":
            platforms = [
                "leetcode",
                "codechef",
                "codeforces",
                "atcoder",
                "github",
                "geeksforgeeks",
            ]
            total = 0
            for p in platforms:
                total += await self.db.coding_profiles.count_documents(
                    {"platform": p, "username": {"$nin": [None, ""]}}
                )
        else:
            platforms = [platform]
            total = await self.db.coding_profiles.count_documents(
                {"platform": platform, "username": {"$nin": [None, ""]}}
            )

        job = await self.jobs.create_job(platform, str(requested_by["_id"]), total)
        await self.audit.log(
            AuditAction.CODING_SYNC_STARTED,
            user_id=str(requested_by["_id"]),
            role=requested_by["role"],
            entity="coding_sync_job",
            entity_id=str(job["_id"]),
            new_data={"platform": platform, "total": total},
            ip_address=ip,
        )

        from app.database.redis import enqueue_job

        enqueued = await enqueue_job(
            "run_coding_sync_task", job_id=str(job["_id"]), platform=platform
        )
        if not enqueued:
            # No worker available: run inline in a background asyncio task so the
            # HTTP request returns immediately with the job id.
            asyncio.create_task(self.run_sync(str(job["_id"]), platform))
        return job

    async def run_sync(self, job_id: str, platform: str) -> None:
        started = time.time()
        await self.jobs.update_progress(
            job_id,
            status=JobStatus.RUNNING.value,
            started_at=datetime.now(timezone.utc),
        )
        settings_svc = SettingsService(self.db)
        cfg = await settings_svc.sync_settings()
        activity_timezone = get_activity_timezone(
            await settings_svc.get("timezone", "Asia/Kolkata")
        ).key
        cfg["activity_timezone"] = activity_timezone

        platforms = (
            ["leetcode", "codechef", "codeforces", "atcoder", "github", "geeksforgeeks"]
            if platform == "all"
            else [platform]
        )

        success = failed = 0
        error_messages = []
        delay_ms = float(cfg.get("request_delay_ms", 250)) / 1000.0
        concurrency = max(1, int(cfg.get("concurrency", 4)))
        sem = asyncio.Semaphore(concurrency)

        for plat in platforms:
            profiles = await self.profiles.profiles_with_username(plat)
            try:
                adapter = get_adapter(plat, cfg)
            except KeyError:
                continue

            async def process(profile_doc):
                nonlocal success, failed
                async with sem:
                    student_id = str(profile_doc["student_id"])
                    username = profile_doc["username"]
                    ok = False
                    message = None
                    try:
                        stats = await adapter.get_stats(username)
                        daily_activity = stats.pop("_daily_activity", [])
                        activity_metadata = stats.pop("_activity_metadata", {})
                        previous_snapshot = await self.profiles.get_statistics(
                            student_id, plat
                        )
                        previous_metadata = (previous_snapshot or {}).get(
                            "activity_metadata"
                        ) or {}
                        activity_history_rebuilt = bool(
                            previous_snapshot
                            and previous_metadata.get("activity_timezone")
                            != activity_timezone
                        )
                        if (
                            activity_history_rebuilt
                        ):
                            # Older rows were bucketed in UTC. Drop them so a
                            # resync rebuilds the timeline in the configured
                            # institutional timezone instead of mixing dates.
                            await self.profiles.clear_activity(student_id, plat)
                            previous_metadata = {}
                        snapshot_metric = activity_metadata.pop("snapshot_delta_key", None)
                        if snapshot_metric:
                            previous_stats = (previous_snapshot or {}).get("statistics") or {}
                            previous_value = (
                                None
                                if activity_history_rebuilt
                                else previous_stats.get(snapshot_metric)
                            )
                            current_value = stats.get(snapshot_metric)
                            today = today_in_timezone(activity_timezone).isoformat()
                            if previous_value is not None and current_value is not None:
                                sync_time = datetime.now(timezone.utc)
                                previous_day = await self.profiles.get_activity_day(
                                    student_id, plat, today
                                )
                                already_detected = int(
                                    ((previous_day or {}).get("metrics") or {}).get(
                                        "problems_solved_delta", 0
                                    )
                                    or 0
                                )
                                interval_start = (previous_day or {}).get("interval_start")
                                if not interval_start:
                                    previous_fetched_at = (previous_snapshot or {}).get(
                                        "fetched_at"
                                    )
                                    if isinstance(previous_fetched_at, datetime):
                                        if previous_fetched_at.tzinfo is None:
                                            previous_fetched_at = previous_fetched_at.replace(
                                                tzinfo=timezone.utc
                                            )
                                        interval_start = previous_fetched_at.isoformat()
                                delta = max(0, int(current_value) - int(previous_value))
                                activity_metadata.update(
                                    {
                                        "available": True,
                                        "metric_key": "problems_solved_delta",
                                        "metric_label": "New problems detected between syncs",
                                        "fill_gaps": False,
                                        "note": (
                                            "This is the increase in the platform's solved total since the previous sync, recorded on today's sync date. "
                                            "Exact solve dates are not available; sync daily for a daily estimate."
                                        ),
                                        "coverage_start": previous_metadata.get(
                                            "coverage_start"
                                        ) or today,
                                        "coverage_end": today,
                                    }
                                )
                                daily_activity = [
                                    {
                                        "date": today,
                                        "metrics": {
                                            "problems_solved_delta": already_detected + delta
                                        },
                                        "interval_start": interval_start,
                                        "interval_end": sync_time.isoformat(),
                                        "estimated": True,
                                    }
                                ]
                            else:
                                activity_metadata["note"] = (
                                    f"{activity_metadata.get('note', '')} The first sync establishes a baseline; the next sync can begin tracking changes."
                                ).strip()
                        await self.profiles.upsert_profile(student_id, plat, username)
                        activity_metadata["activity_timezone"] = activity_timezone
                        await self.profiles.save_statistics(
                            student_id,
                            plat,
                            stats,
                            {"stats": stats},
                            daily_activity=daily_activity,
                            activity_metadata=activity_metadata,
                        )
                        await self.profiles.mark_sync_status(
                            student_id, plat, "success"
                        )
                        await self.profiles.set_profile_url(
                            student_id, plat, adapter.profile_url(username)
                        )
                        ok = True
                        success += 1
                    except Exception as exc:
                        message = f"{username}: {exc}"
                        logger.warning("Sync failure %s/%s: %s", plat, username, exc)
                        failed += 1
                        error_messages.append(message)
                        try:
                            await self.profiles.mark_sync_status(
                                student_id, plat, "failed", message
                            )
                        except Exception:
                            pass
                    try:
                        await self.jobs.add_log(job_id, student_id, plat, ok, message)
                    except Exception:
                        pass
                    try:
                        await self.jobs.increment_job(
                            job_id,
                            success=1 if ok else 0,
                            failed=0 if ok else 1,
                        )
                    except Exception:
                        pass
                    await asyncio.sleep(delay_ms)

            tasks = [process(p) for p in profiles]
            await asyncio.gather(*tasks)

        status = (
            JobStatus.COMPLETED.value
            if failed == 0
            else (
                JobStatus.FAILED.value
                if success == 0 and failed > 0
                else JobStatus.PARTIAL.value
            )
        )
        summary = error_messages[-10:]
        await self.jobs.update_progress(
            job_id, error_summary=[{"message": m} for m in summary] or None
        )
        await self.jobs.finish_job(job_id, status)

        requested_by = (await self.jobs.get_job(job_id) or {}).get("requested_by")
        actor_role = None
        user = (
            await self.db.users.find_one(
                {"_id": __import__("bson").ObjectId(requested_by)}
            )
            if requested_by
            else None
        )
        if user:
            actor_role = user.get("role")
        await self.audit.log(
            AuditAction.CODING_SYNC_COMPLETED,
            user_id=requested_by,
            role=actor_role,
            entity="coding_sync_job",
            entity_id=job_id,
            new_data={"status": status, "successful": success, "failed": failed},
        )

        # Queue leaderboard recalc after coding stats change.
        from app.services.email_service import EmailService
        from app.services.leaderboard_service import LeaderboardService

        svc = LeaderboardService(self.db)
        try:
            await svc.recalculate()
        except Exception as exc:
            logger.error("Leaderboard recalculation after sync failed: %s", exc)

        # Notify the requesting admin of the sync outcome.
        if user and user.get("email"):
            try:
                email_svc = EmailService(self.db)
                await email_svc.send_sync_completed_email(
                    recipient=user["email"],
                    platform=platform,
                    total=success + failed,
                    successful=success,
                    failed=failed,
                )
            except Exception as exc:
                logger.error("Failed to send sync completion email: %s", exc)

        logger.info(
            "Coding sync job %s finished in %.1fs (%d ok / %d failed)",
            job_id,
            time.time() - started,
            success,
            failed,
        )

    async def job_view(self, job_id: str) -> dict:
        job = await self.jobs.get_job(job_id)
        if not job:
            raise NotFoundError("Job not found")
        remaining = max(0, int(job.get("total", 0)) - int(job.get("processed", 0)))
        return {
            "job_id": str(job["_id"]),
            "platform": job["platform"],
            "requested_by": job.get("requested_by"),
            "started_at": job["started_at"].isoformat()
            if isinstance(job.get("started_at"), datetime)
            else None,
            "completed_at": job["completed_at"].isoformat()
            if isinstance(job.get("completed_at"), datetime)
            else None,
            "total": job.get("total", 0),
            "processed": job.get("processed", 0),
            "successful": job.get("successful", 0),
            "failed": job.get("failed", 0),
            "remaining": remaining,
            "status": job.get("status"),
            "error_summary": [
                e["message"] if isinstance(e, dict) else str(e)
                for e in (job.get("error_summary") or [])
            ][-10:],
        }
