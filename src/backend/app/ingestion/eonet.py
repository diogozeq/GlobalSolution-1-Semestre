"""NASA EONET v3 ingestion adapter (recent natural events).

Docs: https://eonet.gsfc.nasa.gov/docs/v3

Resilience policy: if the live API is unreachable for any reason (DNS,
timeout, HTTP error) the adapter automatically falls back to the bundled
fixture so the dashboard never shows empty data.  The result will carry
used_fixture=True and the original error message for observability.
"""
from __future__ import annotations

import json
from datetime import datetime

from sqlmodel import Session, delete

from app.core.http import ExternalAPIError, fetch_json
from app.ingestion.base import IngestResult, fixture_exists, load_fixture, parse_bbox, record_run
from app.ingestion.brazil import BR_BBOX_W_S_E_N, in_brazil
from app.models import NaturalEvent, utcnow

SOURCE_NAME = "EONET"
FIXTURE = "eonet_sample.json"
_BASE_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"
# EONET v3 category IDs we care about for Brazil risk monitoring
_CATEGORIES = {"wildfires", "severeStorms", "floods", "drought", "landslides"}


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
    live_error: str | None = None
    used_fixture = False
    payload: dict | None = None

    if not use_fixture:
        # EONET v3 bbox: minLon,minLat,maxLon,maxLat  (west,south,east,north)
        try:
            if bbox:
                west, south, east, north = parse_bbox(bbox)
                bbox_api = f"{west},{south},{east},{north}"
            else:
                bbox_api = BR_BBOX_W_S_E_N
            params: dict = {
                "status": "open",
                "limit": 100,
                "category": ",".join(sorted(_CATEGORIES)),
                "bbox": bbox_api,
            }
            if days < 10:
                params["days"] = days
            payload = await fetch_json(_BASE_URL, params=params)
        except (ExternalAPIError, OSError, ValueError) as exc:
            live_error = str(exc)

    # ── Fallback chain ────────────────────────────────────────────────────────
    if payload is None:
        if use_fixture or fixture_exists(FIXTURE):
            # Auto-fallback: never leave the dashboard empty
            payload = json.loads(load_fixture(FIXTURE))
            used_fixture = True
        else:
            # No fixture available: preserve existing DB rows, report partial
            result = IngestResult(
                source=SOURCE_NAME,
                status="partial",
                records_count=0,
                error=live_error or "EONET indisponível e fixture ausente",
                used_fixture=False,
            )
            record_run(session, result, started)
            return result

    events = [
        e for e in parse_eonet(payload)
        if e["category"] in _CATEGORIES and in_brazil(e["lat"], e["lon"])
    ]

    session.exec(delete(NaturalEvent).where(NaturalEvent.source == SOURCE_NAME))
    for e in events:
        session.add(NaturalEvent(**e))
    session.commit()

    result = IngestResult(
        source=SOURCE_NAME,
        status="success",
        records_count=len(events),
        error=live_error,          # preserva o erro original para observabilidade
        used_fixture=used_fixture,
    )
    record_run(session, result, started)
    return result
