"""Weather endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Region, WeatherReading

router = APIRouter(prefix="/weather", tags=["weather"])

_PREFERRED_SOURCE = "Open-Meteo"


def _latest_for_region(session: Session, region_id: int) -> WeatherReading | None:
    rows = session.exec(
        select(WeatherReading)
        .where(WeatherReading.region_id == region_id)
        .order_by(WeatherReading.timestamp.desc())
    ).all()
    if not rows:
        return None
    preferred = [r for r in rows if r.source == _PREFERRED_SOURCE]
    return preferred[0] if preferred else rows[0]


@router.get("")
def get_weather(
    region_id: int | None = None, session: Session = Depends(get_session)
):
    if region_id is not None:
        reading = _latest_for_region(session, region_id)
        if reading is None:
            raise HTTPException(status_code=404, detail="No weather for region")
        return reading
    # All regions: latest reading each
    regions = session.exec(select(Region)).all()
    out = []
    for region in regions:
        reading = _latest_for_region(session, region.id)
        if reading:
            out.append(reading)
    return out
