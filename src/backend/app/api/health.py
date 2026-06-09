"""Health check endpoint."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import settings
from app.rag.index import current_mode

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
        "firms_configured": bool(settings.firms_map_key),
        "llm_enabled": settings.llm_enabled,
        "rag_mode": current_mode(),
        "time": datetime.now(timezone.utc).isoformat(),
    }
