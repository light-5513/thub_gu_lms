"""API router aggregation."""

from fastapi import APIRouter

from app.api.v1 import auth, contact, health, student
from app.api.v1.admin import (
    analytics,
    batches,
    classes,
    dashboard,
    imports,
    invitations,
    settings_audit,
    students,
    sync_leaderboard,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(contact.router)
api_router.include_router(auth.router)
api_router.include_router(student.router)
api_router.include_router(dashboard.router)
api_router.include_router(students.router)
api_router.include_router(invitations.router)
api_router.include_router(imports.router)
api_router.include_router(classes.router)
api_router.include_router(sync_leaderboard.router)
api_router.include_router(analytics.router)
api_router.include_router(settings_audit.router)
api_router.include_router(batches.router)
