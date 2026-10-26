"""ARQ worker: background jobs for email, coding sync, imports and leaderboards.

Run with:  arq app.workers.worker.WorkerSettings
"""

from datetime import datetime, timezone

from bson import ObjectId

from app.core.logging import setup_logging
from app.database import mongo
from app.database.redis import set_worker_heartbeat


async def startup(ctx):
    setup_logging()
    if not await mongo.connect_to_mongo():
        raise RuntimeError("MongoDB unavailable for background worker")
    ctx["db"] = mongo.get_db()
    import uuid

    ctx["worker_id"] = f"worker-{uuid.uuid4().hex[:8]}"
    await heartbeat(ctx)


async def shutdown(ctx):
    if mongo.get_client():
        await mongo.close_mongo()


async def heartbeat(ctx):
    await set_worker_heartbeat(ctx.get("worker_id", "worker"), redis=ctx.get("redis"))


# ------------------------------------------------------------------ tasks
async def send_email_task(ctx, kind: str, **payload):
    """Send an email (invitation / password reset / notification)."""
    db = ctx.get("db")
    if db is None:
        return
    from app.services.email_service import EmailService

    service = EmailService(db)
    try:
        if kind == "invitation":
            return await service.send_invitation_email(
                payload["student_name"], payload["email"], payload["temporary_password"], phone=payload.get("phone")
            )
        if kind == "invitation_link":
            invitation_id = payload.get("invitation_id")
            invitation_doc = None
            if invitation_id:
                try:
                    invitation_doc = await db.invitations.find_one(
                        {
                            "_id": ObjectId(invitation_id),
                            "used": False,
                            "expires_at": {
                                "$gt": datetime.now(timezone.utc).replace(tzinfo=None)
                            },
                        },
                        {"_id": 1},
                    )
                except Exception:
                    invitation_doc = None
                if not invitation_doc:
                    return False

            try:
                sent = await service.send_invitation_link_email(
                    payload["email"], payload["setup_url"]
                )
            except Exception as exc:
                from app.core.logging import get_logger

                get_logger(__name__).error("Invitation email delivery failed: %s", exc)
                sent = False
            if invitation_id:
                try:
                    await db.invitations.update_one(
                        {"_id": ObjectId(invitation_id)},
                        {
                            "$set": {
                                "email_status": "sent" if sent else "failed",
                                "email_error": None
                                if sent
                                else "Email delivery failed; check email_logs.",
                                "email_updated_at": datetime.now(timezone.utc),
                            }
                        }
                    )
                except Exception as exc:
                    from app.core.logging import get_logger

                    get_logger(__name__).error(
                        "Could not update invitation email status: %s", exc
                    )
            return sent
        if kind == "password_reset":
            return await service.send_password_reset_email(
                payload["student_name"], payload["email"], payload["reset_token"], phone=payload.get("phone")
            )
        if kind == "notification":
            return await service.send_notification_email(
                payload["email"],
                payload.get("subject", "Notification"),
                payload.get("body", ""),
                phone=payload.get("phone"),
            )
    except Exception as exc:
        from app.core.logging import get_logger

        get_logger(__name__).error("Email task failed (%s): %s", kind, exc)
        return False


async def run_coding_sync_task(ctx, job_id: str, platform: str):
    db = ctx.get("db")
    if db is None:
        return
    from app.services.coding_sync_service import CodingSyncService

    service = CodingSyncService(db)
    await service.run_sync(job_id, platform)


async def recalc_leaderboard_task(ctx):
    db = ctx.get("db")
    if db is None:
        return
    from app.services.leaderboard_service import LeaderboardService

    service = LeaderboardService(db)
    return await service.recalculate()


class WorkerSettings:
    functions = [send_email_task, run_coding_sync_task, recalc_leaderboard_task]
    on_startup = startup
    on_shutdown = shutdown
    # Heartbeat every 30s so /api/health can report worker status.
    from arq import cron

    cron_jobs = [cron(heartbeat, second={0, 30}, unique=False)]
    keep_result = 3600
    max_jobs = 10
    job_timeout = 1800
