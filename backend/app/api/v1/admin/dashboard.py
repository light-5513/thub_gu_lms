"""Admin dashboard KPIs."""

from fastapi import APIRouter, Depends

from app.core.deps import get_db, require_staff
from app.services.analytics_service import AnalyticsService

router = APIRouter(tags=["admin"])


@router.get("/admin/dashboard")
async def dashboard(user=Depends(require_staff), db=Depends(get_db)):
    return await AnalyticsService(db).admin_dashboard()
