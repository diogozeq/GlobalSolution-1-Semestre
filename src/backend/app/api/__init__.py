"""Aggregate API router."""
from fastapi import APIRouter

from app.api import (
    alerts,
    chat,
    events,
    fires,
    health,
    ingest,
    ml,
    rag,
    regions,
    report,
    risk,
    sensor,
    weather,
)

api_router = APIRouter()
# Etapa 1 — foundation
api_router.include_router(health.router)
api_router.include_router(ingest.router)
api_router.include_router(regions.router)
api_router.include_router(fires.router)
api_router.include_router(weather.router)
api_router.include_router(events.router)
# Etapa 2 — intelligence
api_router.include_router(risk.router)
api_router.include_router(alerts.router)
api_router.include_router(report.router)
api_router.include_router(chat.router)
api_router.include_router(rag.router)
api_router.include_router(ml.router)
api_router.include_router(sensor.router)

__all__ = ["api_router"]
