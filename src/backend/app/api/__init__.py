"""Aggregate API router (Etapa 1 — foundation)."""
from fastapi import APIRouter

from app.api import events, fires, health, ingest, regions, weather

api_router = APIRouter()
# Etapa 1 — foundation
api_router.include_router(health.router)
api_router.include_router(ingest.router)
api_router.include_router(regions.router)
api_router.include_router(fires.router)
api_router.include_router(weather.router)
api_router.include_router(events.router)

__all__ = ["api_router"]
