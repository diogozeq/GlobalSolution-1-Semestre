"""NASA FIRMS ingestion adapter (active fire foci, area CSV endpoint).

Docs: https://firms.modaps.eosdis.nasa.gov/api/area/csv
Endpoint shape:
  /api/area/csv/{MAP_KEY}/{SOURCE}/{west,south,east,north}/{day_range}/{date}
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from sqlmodel import Session, delete, select

from app.core.config import settings
from app.core.http import ExternalAPIError, fetch_text
from app.ingestion.base import (
    IngestResult,
    load_fixture,
    record_run,
    region_for_point,
)
from app.models import FireFocus, Region, utcnow

SOURCE_NAME = "FIRMS"
FIXTURE = "fires_sample.csv"
DEFAULT_SATELLITE_SOURCE = "VIIRS_SNPP_NRT"
_BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

# VIIRS confidence letters -> normalized 0-100
_CONF_LETTER = {"l": 25.0, "n": 60.0, "h": 90.0}


def _normalize_confidence(raw: str | None) -> float | None:
    if raw is None or raw == "":
        return None
    raw = raw.strip()
    if raw.lower() in _CONF_LETTER:
        return _CONF_LETTER[raw.lower()]
    try:
        return float(raw)
    except ValueError:
        return None


def _to_float(raw: str | None) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _parse_acq_datetime(acq_date: str, acq_time: str) -> datetime:
    """Combine FIRMS acq_date (YYYY-MM-DD) and acq_time (HHMM) into UTC datetime."""
    try:
        time_str = (acq_time or "0").zfill(4)
        hour, minute = int(time_str[:2]), int(time_str[2:])
        d = datetime.strptime(acq_date, "%Y-%m-%d")
        return d.replace(hour=hour, minute=minute, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return utcnow()


def parse_firms_csv(text: str, source: str = SOURCE_NAME) -> list[dict]:
    """Parse a FIRMS area CSV (MODIS or VIIRS) into normalized fire-focus dicts.

    Pure function — used by both the live adapter and the unit tests.
    """
    reader = csv.DictReader(io.StringIO(text.strip()))
    foci: list[dict] = []
    for row in reader:
        lat = _to_float(row.get("latitude"))
        lon = _to_float(row.get("longitude"))
        if lat is None or lon is None:
            continue
        brightness = (
            _to_float(row.get("brightness"))
            or _to_float(row.get("bright_ti4"))
            or _to_float(row.get("frp"))
        )
        foci.append(
            {
                "source": source,
                "lat": lat,
                "lon": lon,
                "brightness": brightness,
                "confidence": _normalize_confidence(row.get("confidence")),
                "acq_datetime": _parse_acq_datetime(
                    row.get("acq_date", ""), row.get("acq_time", "")
                ),
                "satellite": (row.get("satellite") or row.get("instrument") or "").strip()
                or None,
            }
        )
    return foci


async def _fetch_live(bbox: str, days: int, satellite_source: str) -> str:
    url = (
        f"{_BASE_URL}/{settings.firms_map_key}/{satellite_source}/"
        f"{bbox}/{max(1, min(days, 10))}"
    )
    return await fetch_text(url)


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 1,
    satellite_source: str = DEFAULT_SATELLITE_SOURCE,
) -> IngestResult:
    """Ingest fire foci. Falls back to fixture if live fetch is unavailable."""
    started = utcnow()
    regions = session.exec(select(Region)).all()
    bbox = bbox or "-74,-34,-34,6"  # Brazil-wide default

    text: str | None = None
    error: str | None = None
    used_fixture = False
    status = "success"

    if not use_fixture and settings.firms_map_key:
        try:
            text = await _fetch_live(bbox, days, satellite_source)
            # FIRMS may return an HTML/text error instead of CSV
            if "latitude" not in (text.splitlines()[0].lower() if text else ""):
                raise ExternalAPIError("FIRMS returned non-CSV payload")
        except ExternalAPIError as exc:
            error = str(exc)

    if text is None:
        text = load_fixture(FIXTURE)
        used_fixture = True
        status = "partial" if (not use_fixture and settings.firms_map_key) else "success"

    foci = parse_firms_csv(text, SOURCE_NAME)

    # Replace previous FIRMS foci to keep the dataset fresh for the demo.
    session.exec(delete(FireFocus).where(FireFocus.source == SOURCE_NAME))
    for f in foci:
        f["region_id"] = region_for_point(regions, f["lat"], f["lon"])
        session.add(FireFocus(**f))
    session.commit()

    result = IngestResult(
        source=SOURCE_NAME,
        status=status,
        records_count=len(foci),
        error=error,
        used_fixture=used_fixture,
    )
    record_run(session, result, started)
    return result
