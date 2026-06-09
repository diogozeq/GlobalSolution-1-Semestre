"""Open-Meteo ingestion adapter (current weather per region center).

Docs: https://open-meteo.com/en/docs  (no API key required)
All per-region API calls are parallelised with asyncio.gather.
Fixture fallback uses biome-aware regional variation so each region shows
climatologically plausible weather for Brazil's June dry season.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from sqlmodel import Session, delete, select

from app.core.http import ExternalAPIError, fetch_json
from app.ingestion.base import IngestResult, fixture_exists, load_fixture, record_run
from app.models import Region, WeatherReading, utcnow

SOURCE_NAME = "Open-Meteo"
FIXTURE = "weather_sample.json"
_BASE_URL = "https://api.open-meteo.com/v1/forecast"
_CURRENT_FIELDS = "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"

# Biome-specific deltas applied on top of the Cerrado baseline fixture.
# Tuple: (delta_temp °C, delta_humidity %, delta_precip mm, delta_wind km/h)
# Values reflect typical June (dry season) conditions in Brazil.
_BIOME_DELTA: dict[str, tuple[float, int, float, float]] = {
    "Amazônia":      (+2.5, +52,  +2.0, -3.0),   # hot + humid
    "Cerrado":       (  0,   0,    0.0,  0.0),   # baseline
    "Pantanal":      (+1.0, +12,  -0.1, +2.0),   # warm, moderate
    "Caatinga":      (+5.0, -22,  -0.2, +4.5),   # hottest + driest
    "Pará":          (+3.0, +42,  +1.5, -2.0),   # hot + humid (Amazon fringe)
    "Mato Grosso":   (+2.0,  -8,  -0.1, +1.5),   # hot, dry savanna
}


def _biome_delta(region: Region) -> tuple[float, int, float, float]:
    name = region.name or ""
    for key, delta in _BIOME_DELTA.items():
        if key.lower() in name.lower():
            return delta
    return (0, 0, 0.0, 0.0)


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
        "temp":      current.get("temperature_2m"),
        "humidity":  current.get("relative_humidity_2m"),
        "precip":    current.get("precipitation"),
        "wind":      current.get("wind_speed_10m"),
        "timestamp": timestamp,
    }


def _vary(reading: dict, region: Region) -> dict:
    """Apply biome-specific deltas for realistic per-region fixture data."""
    dt, dh, dp, dw = _biome_delta(region)
    out = dict(reading)
    if out.get("temp")     is not None: out["temp"]     = round(out["temp"]     + dt, 1)
    if out.get("humidity") is not None: out["humidity"] = max(5, min(100, round(out["humidity"] + dh)))
    if out.get("precip")   is not None: out["precip"]   = round(max(0.0, out["precip"] + dp), 1)
    if out.get("wind")     is not None: out["wind"]     = round(max(0.0, out["wind"]   + dw), 1)
    # Use current time so the reading is never stale
    out["timestamp"] = utcnow()
    return out


async def _fetch_one(region: Region) -> dict:
    """Fetch current weather for a single region. Raises ExternalAPIError on failure."""
    payload = await fetch_json(
        _BASE_URL,
        params={
            "latitude":  region.center_lat,
            "longitude": region.center_lon,
            "current":   _CURRENT_FIELDS,
            "timezone":  "UTC",
        },
    )
    return parse_openmeteo(payload)


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 1,
) -> IngestResult:
    """Collect current weather for every monitored region (parallel)."""
    started  = utcnow()
    regions  = session.exec(select(Region)).all()

    error: str | None = None
    used_fixture = False
    status = "success"

    readings: list[tuple[int | None, dict]] = []

    if use_fixture:
        base = parse_openmeteo(json.loads(load_fixture(FIXTURE)))
        readings = [(r.id, _vary(base, r)) for r in regions]
        used_fixture = True
    else:
        tasks = [_fetch_one(r) for r in regions]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        base_fixture: dict | None = None
        for region, result in zip(regions, results):
            if isinstance(result, Exception):
                error = str(result)
                if base_fixture is None and fixture_exists(FIXTURE):
                    base_fixture = parse_openmeteo(json.loads(load_fixture(FIXTURE)))
                    used_fixture = True
                if base_fixture is not None:
                    readings.append((region.id, _vary(base_fixture, region)))
                else:
                    status = "partial"
            else:
                readings.append((region.id, result))

    if not readings:
        result_obj = IngestResult(
            source=SOURCE_NAME,
            status="partial",
            records_count=0,
            error=error or "Open-Meteo indisponível — nenhuma região respondeu",
            used_fixture=False,
        )
        record_run(session, result_obj, started)
        return result_obj

    session.exec(delete(WeatherReading).where(WeatherReading.source == SOURCE_NAME))
    for region_id, reading in readings:
        session.add(WeatherReading(source=SOURCE_NAME, region_id=region_id, **reading))
    session.commit()

    result_obj = IngestResult(
        source=SOURCE_NAME,
        status=status,
        records_count=len(readings),
        error=error,
        used_fixture=used_fixture,
    )
    record_run(session, result_obj, started)
    return result_obj
