"""Admin coding sync triggers + job monitoring, and leaderboard management."""

from fastapi import APIRouter, Depends, Query, Request

from app.core.deps import get_db, require_admin, require_staff
from app.core.errors import AppError
from app.services.coding_sync_service import CodingSyncService
from app.services.leaderboard_service import LeaderboardService

router = APIRouter(prefix="/admin", tags=["admin-sync"])


def client_meta(request: Request):
    from app.core.rate_limit import client_ip

    return {"ip": client_ip(request)}


@router.post("/coding-sync/{platform}")
async def trigger_sync(
    platform: str, request: Request, user=Depends(require_admin), db=Depends(get_db)
):
    valid = {
        "leetcode",
        "codechef",
        "codeforces",
        "atcoder",
        "github",
        "geeksforgeeks",
        "all",
    }
    if platform not in valid:
        raise AppError(f"Unknown platform '{platform}'", 400)
    meta = client_meta(request)
    service = CodingSyncService(db)
    job = await service.start_job(platform, user, ip=meta["ip"])
    view = await service.job_view(str(job["_id"]))
    return {"message": f"Synchronization started for {platform}", "job": view}


@router.get("/coding-sync/jobs")
async def list_jobs(user=Depends(require_staff), db=Depends(get_db)):
    service = CodingSyncService(db)
    jobs = await service.jobs.list_jobs()
    out = []
    for job in jobs:
        try:
            out.append(await service.job_view(str(job["_id"])))
        except Exception:
            continue
    return {"items": out}


@router.get("/coding-sync/jobs/{job_id}")
async def get_job(job_id: str, user=Depends(require_staff), db=Depends(get_db)):
    service = CodingSyncService(db)
    return await service.job_view(job_id)


@router.post("/leaderboards/recalculate")
async def recalc_leaderboard(
    request: Request, user=Depends(require_admin), db=Depends(get_db)
):
    from app.models.enums import AuditAction

    meta = client_meta(request)
    service = LeaderboardService(db)
    result = await service.recalculate()
    from app.services.audit_service import AuditService

    await AuditService(db).log(
        AuditAction.LEADERBOARD_RECALCULATED,
        user_id=str(user["_id"]),
        role=user["role"],
        entity="leaderboard",
        ip_address=meta["ip"],
        new_data={"recalculated": result["recalculated"]},
    )
    return result


@router.get("/leaderboards")
async def leaderboards(
    tab: str = Query(default="overall"),
    course: str | None = None,
    branch: str | None = None,
    section: str | None = None,
    batch_id: str | None = None,
    academic_year_id: str | None = None,
    user=Depends(require_staff),
    db=Depends(get_db),
):
    service = LeaderboardService(db)
    filters = {
        "course": course,
        "branch": branch,
        "section": section,
        "batch_id": batch_id,
        "academic_year_id": academic_year_id,
    }
    return await service.get_leaderboard(tab, filters)
