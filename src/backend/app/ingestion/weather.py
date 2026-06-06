"""Open-Meteo ingestion adapter (current weather per region center).

Docs: https://open-meteo.com/en/docs  (no API key required)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlmodel import Session, delete, select

from app.core.http import ExternalAPIError, fetch_json
from app.ingestion.base import IngestResult, load_fixture, record_run
from app.models import Region, WeatherReading, utcnow

SOURCE_NAME = "Open-Meteo"
FIXTURE = "weather_sample.json"
_BASE_URL = "https://api.open-meteo.com/v1/forecast"
_CURRENT_FIELDS = "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"


def parse_openmeteo(payload: dict) -> dict:
    """Parse an Open-Meteo forecast response (current block) into a reading dict."""
    current = payload.get("current", {}) or {}
    ts = current.get("time")
    try:
        timestamp = (
            datetime.fromisoformat(ts).replace(tzinfo=timezone.utc) if ts else utcnow()
        )
    except (ValueError, TypeError):
        timestamp = utcnow()
    return {
        "temp": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "precip": current.get("precipitation"),
        "wind": current.get("wind_speed_10m"),
        "timestamp": timestamp,
    }


def _vary(reading: dict, idx: int) -> dict:
    """Deterministic per-region variation so the fixture demo shows differences."""
    out = dict(reading)
    if out.get("temp") is not None:
        out["temp"] = round(out["temp"] + (idx % 5) * 1.7 - 2, 1)
    if out.get("humidity") is not None:
        out["humidity"] = max(5, min(100, round(out["humidity"] - (idx % 4) * 6)))
    if out.get("wind") is not None:
        out["wind"] = round(out["wind"] + (idx % 3) * 3.0, 1)
    if out.get("precip") is not None:
        out["precip"] = round(max(0.0, out["precip"] - (idx % 3) * 0.4), 1)
    return out


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 1,
) -> IngestResult:
    """Collect current weather for every monitored region."""
    started = utcnow()
    regions = session.exec(select(Region)).all()

    error: str | None = None
    used_fixture = False
    status = "success"
    count = 0

    # Refresh: drop previous Open-Meteo readings
    session.exec(delete(WeatherReading).where(WeatherReading.source == SOURCE_NAME))

    fixture_reading: dict | None = None
    if use_fixture:
        fixture_reading = parse_openmeteo(json.loads(load_fixture(FIXTURE)))
        used_fixture = True

    for idx, region in enumerate(regions):
        reading: dict | None = None
        if not use_fixture:
            try:
                payload = await fetch_json(
                    _BASE_URL,
                    params={
                        "latitude": region.center_lat,
                        "longitude": region.center_lon,
                        "current": _CURRENT_FIELDS,
                        "timezone": "UTC",
                    },
                )
                reading = parse_openmeteo(payload)
            except ExternalAPIError as exc:
                error = str(exc)
        if reading is None:
            if fixture_reading is None:
                fixture_reading = parse_openmeteo(json.loads(load_fixture(FIXTURE)))
                used_fixture = True
                status = "partial" if not use_fixture else "success"
            reading = _vary(fixture_reading, idx)

        session.add(
            WeatherReading(source=SOURCE_NAME, region_id=region.id, **reading)
        )
        count += 1

    session.commit()
    result = IngestResult(
        source=SOURCE_NAME,
        status=status,
        records_count=count,
        error=error,
        used_fixture=used_fixture,
    )
    record_run(session, result, started)
    return result
