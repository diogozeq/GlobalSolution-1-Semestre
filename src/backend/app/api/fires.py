"""Fire-foci endpoints (map data)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.ingestion.base import parse_bbox
from app.models import FireFocus

router = APIRouter(prefix="/fires", tags=["fires"])


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@router.get("")
def list_fires(
    bbox: str | None = Query(None, description="west,south,east,north"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    source: str | None = Query(None),
    limit: int = Query(2000, ge=1, le=10000),
    session: Session = Depends(get_session),
) -> list[dict]:
    query = select(FireFocus)
    if source:
        query = query.where(FireFocus.source == source)
    df, dt = _parse_date(date_from), _parse_date(date_to)
    if df:
        query = query.where(FireFocus.acq_datetime >= df)
    if dt:
        query = query.where(FireFocus.acq_datetime <= dt)
    rows = session.exec(query.limit(limit)).all()

    if bbox:
        try:
            west, south, east, north = parse_bbox(bbox)
            rows = [
                r for r in rows if west <= r.lon <= east and south <= r.lat <= north
            ]
        except ValueError:
            pass

    return [
        {
            "id": r.id,
            "lat": r.lat,
            "lon": r.lon,
            "brightness": r.brightness,
            "confidence": r.confidence,
            "acq_datetime": r.acq_datetime.isoformat() if r.acq_datetime else None,
            "satellite": r.satellite,
            "source": r.source,
            "region_id": r.region_id,
        }
        for r in rows
    ]
