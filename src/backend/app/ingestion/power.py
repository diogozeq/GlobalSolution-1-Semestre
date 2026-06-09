"""NASA POWER daily ingestion adapter (historical weather enrichment).

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
Stores one aggregated WeatherReading (source NASA_POWER) per region.
All per-region API calls are parallelised with asyncio.gather so the full
6-region ingest takes ~3 s instead of ~18 s.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, delete, select

from app.core.http import ExternalAPIError, fetch_json
from app.ingestion.base import IngestResult, fixture_exists, load_fixture, record_run
from app.models import Region, WeatherReading, utcnow

SOURCE_NAME = "NASA_POWER"
FIXTURE = "power_sample.json"
_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
_PARAMS = "PRECTOTCORR,T2M,RH2M,WS2M"


def _avg(values: list[float]) -> float | None:
    clean = [v for v in values if v is not None and v > -900]
    return round(sum(clean) / len(clean), 2) if clean else None


def parse_power(payload: dict) -> dict:
    """Aggregate a POWER daily response into a single reading dict."""
    params = (payload.get("properties", {}) or {}).get("parameter", {}) or {}
    precip    = list(params.get("PRECTOTCORR", {}).values())
    temp      = list(params.get("T2M", {}).values())
    humidity  = list(params.get("RH2M", {}).values())
    wind      = list(params.get("WS2M", {}).values())
    precip_clean = [v for v in precip if v is not None and v > -900]
    keys = sorted(
        {str(k) for series in params.values() for k in getattr(series, "keys", lambda: [])()}
    )
    timestamp = utcnow()
    if keys:
        try:
            timestamp = datetime.strptime(keys[-1], "%Y%m%d").replace(tzinfo=timezone.utc)
        except Exception:
            pass
    return {
        "temp":      _avg(temp),
        "humidity":  _avg(humidity),
        "precip":    round(sum(precip_clean), 2) if precip_clean else None,
        "wind":      _avg(wind),
        "timestamp": timestamp,
    }


async def _fetch_one(
    region: Region, start: str, end: str
) -> dict:
    """Fetch POWER data for a single region. Raises ExternalAPIError on failure."""
    payload = await fetch_json(
        _BASE_URL,
        params={
            "parameters":    _PARAMS,
            "community":     "AG",
            "longitude":     region.center_lon,
            "latitude":      region.center_lat,
            "format":        "JSON",
            "start":         start,
            "end":           end,
            "time-standard": "UTC",
        },
    )
    return parse_power(payload)


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 7,
) -> IngestResult:
    started  = utcnow()
    regions  = session.exec(select(Region)).all()
    error: str | None = None
    used_fixture = False
    status = "success"

    end_d   = (utcnow() - timedelta(days=1)).date()
    start_d = end_d - timedelta(days=max(1, days) - 1)
    start_s = start_d.strftime("%Y%m%d")
    end_s   = end_d.strftime("%Y%m%d")

    readings: list[tuple[int | None, dict]] = []

    if use_fixture:
        fixture_reading = parse_power(json.loads(load_fixture(FIXTURE)))
        readings = [(r.id, fixture_reading) for r in regions]
        used_fixture = True
    else:
        # Fetch all regions in parallel
        tasks = [_fetch_one(r, start_s, end_s) for r in regions]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        fallback_reading: dict | None = None
        for region, result in zip(regions, results):
            if isinstance(result, Exception):
                error = str(result)
                if fallback_reading is None and fixture_exists(FIXTURE):
                    fallback_reading = parse_power(json.loads(load_fixture(FIXTURE)))
                    used_fixture = True
                if fallback_reading is not None:
                    readings.append((region.id, fallback_reading))
                else:
                    status = "partial"
            else:
                readings.append((region.id, result))

    if not readings:
        result_obj = IngestResult(
            source=SOURCE_NAME,
            status="partial",
            records_count=0,
            error=error or "NASA POWER indisponível — nenhuma região respondeu",
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
