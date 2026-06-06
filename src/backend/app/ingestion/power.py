"""NASA POWER daily ingestion adapter (historical weather enrichment).

Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
Stores an aggregated WeatherReading (source NASA_POWER) per region: accumulated
precipitation and average temp/humidity/wind over the requested window.
"""
from __future__ import annotations

import json

from sqlmodel import Session, delete, select

from app.core.http import ExternalAPIError, fetch_json
from app.ingestion.base import IngestResult, load_fixture, record_run
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
    precip = list(params.get("PRECTOTCORR", {}).values())
    temp = list(params.get("T2M", {}).values())
    humidity = list(params.get("RH2M", {}).values())
    wind = list(params.get("WS2M", {}).values())
    precip_clean = [v for v in precip if v is not None and v > -900]
    return {
        "temp": _avg(temp),
        "humidity": _avg(humidity),
        "precip": round(sum(precip_clean), 2) if precip_clean else None,
        "wind": _avg(wind),
        "timestamp": utcnow(),
    }


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 7,
) -> IngestResult:
    started = utcnow()
    regions = session.exec(select(Region)).all()
    error: str | None = None
    used_fixture = False
    status = "success"
    count = 0

    session.exec(delete(WeatherReading).where(WeatherReading.source == SOURCE_NAME))

    for region in regions:
        reading: dict | None = None
        if not use_fixture:
            try:
                payload = await fetch_json(
                    _BASE_URL,
                    params={
                        "parameters": _PARAMS,
                        "community": "AG",
                        "longitude": region.center_lon,
                        "latitude": region.center_lat,
                        "format": "JSON",
                    },
                )
                reading = parse_power(payload)
            except ExternalAPIError as exc:
                error = str(exc)
        if reading is None:
            reading = parse_power(json.loads(load_fixture(FIXTURE)))
            used_fixture = True
            status = "partial" if not use_fixture else "success"

        session.add(WeatherReading(source=SOURCE_NAME, region_id=region.id, **reading))
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
