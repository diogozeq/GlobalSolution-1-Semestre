"""NASA EONET v3 ingestion adapter (recent natural events).

Docs: https://eonet.gsfc.nasa.gov/docs/v3
"""
from __future__ import annotations

import json
from datetime import datetime

from sqlmodel import Session, delete

from app.core.http import ExternalAPIError, fetch_json
from app.ingestion.base import IngestResult, load_fixture, record_run
from app.models import NaturalEvent, utcnow

SOURCE_NAME = "EONET"
FIXTURE = "eonet_sample.json"
_BASE_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
_CATEGORIES = {"wildfires", "severeStorms", "floods", "drought"}


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def parse_eonet(payload: dict) -> list[dict]:
    """Parse an EONET events payload into NaturalEvent dicts."""
    events: list[dict] = []
    for ev in payload.get("events", []) or []:
        categories = ev.get("categories", []) or []
        cat_id = categories[0].get("id") if categories else ""
        cat_title = categories[0].get("title", "") if categories else ""
        geometry = ev.get("geometry", []) or []
        lat = lon = None
        started_at = None
        if geometry:
            geo = geometry[-1]
            coords = geo.get("coordinates")
            if isinstance(coords, list) and len(coords) >= 2:
                lon, lat = coords[0], coords[1]
            started_at = _parse_date(geo.get("date"))
        events.append(
            {
                "source": SOURCE_NAME,
                "category": cat_id or cat_title,
                "title": ev.get("title", ""),
                "lat": lat,
                "lon": lon,
                "started_at": started_at,
                "raw_json": json.dumps(ev)[:4000],
            }
        )
    return events


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 30,
) -> IngestResult:
    started = utcnow()
    error: str | None = None
    used_fixture = False
    status = "success"
    payload: dict | None = None

    if not use_fixture:
        try:
            payload = await fetch_json(
                _BASE_URL, params={"status": "open", "limit": 100, "days": days}
            )
        except ExternalAPIError as exc:
            error = str(exc)

    if payload is None:
        payload = json.loads(load_fixture(FIXTURE))
        used_fixture = True
        status = "partial" if not use_fixture else "success"

    events = [e for e in parse_eonet(payload) if e["category"] in _CATEGORIES or True]

    session.exec(delete(NaturalEvent).where(NaturalEvent.source == SOURCE_NAME))
    for e in events:
        session.add(NaturalEvent(**e))
    session.commit()

    result = IngestResult(
        source=SOURCE_NAME,
        status=status,
        records_count=len(events),
        error=error,
        used_fixture=used_fixture,
    )
    record_run(session, result, started)
    return result
