"""ARQ worker: background jobs for email, coding sync, imports and leaderboards.

Run with:  arq app.workers.worker.WorkerSettings
"""

from app.core.logging import setup_logging
from app.database import mongo
from app.database.redis import set_worker_heartbeat


async def startup(ctx):
    setup_logging()
    await mongo.connect_to_mongo()
    ctx["db"] = mongo.get_db() if mongo.get_client() else None
    import uuid

    ctx["worker_id"] = f"worker-{uuid.uuid4().hex[:8]}"


async def shutdown(ctx):
    if mongo.get_client():
        mongo.close_mongo()


async def heartbeat(ctx):
    await set_worker_heartbeat(ctx.get("worker_id", "worker"))


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
            return await service.send_invitation_link_email(
                payload["email"], payload["setup_url"], phone=payload.get("phone")
            )
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
