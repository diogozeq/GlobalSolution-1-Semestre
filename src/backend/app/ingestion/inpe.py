"""INPE Queimadas ingestion adapter (Brazilian active fire foci).

Docs: https://data.inpe.br/queimadas/dados-abertos/
Live path uses the official daily CSV directory for Brazil.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone

from sqlmodel import Session, delete, select

from app.core.http import ExternalAPIError, fetch_text
from app.ingestion.base import (
    IngestResult,
    fixture_exists,
    load_fixture,
    parse_bbox,
    record_run,
    region_for_point,
)
from app.models import FireFocus, Region, utcnow

SOURCE_NAME = "INPE"
FIXTURE = "inpe_sample.csv"
_INDEX_URL = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil/"
_FILE_RE = re.compile(r'href="(?P<name>focos_diario_br_\d{8}\.csv)"')


def _to_float(raw: str | None) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        return float(str(raw).strip())
    except ValueError:
        return None


def _parse_dt(raw: str | None) -> datetime | None:
    if not raw:
        return None
    value = raw.replace("Z", "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _row(row: dict) -> dict:
    return {
        str(k or "").strip().lstrip("\ufeff").lower(): (v.strip() if isinstance(v, str) else v)
        for k, v in row.items()
    }


def _confidence(row: dict) -> float | None:
    raw = row.get("confidence") or row.get("confianca") or row.get("risco_fogo")
    value = _to_float(raw)
    if value is None:
        return None
    if 0 <= value <= 1:
        return round(value * 100, 2)
    return value


def _inside_bbox(lat: float, lon: float, bbox: str | None) -> bool:
    if not bbox:
        return True
    west, south, east, north = parse_bbox(bbox)
    return west <= lon <= east and south <= lat <= north


def parse_inpe_csv(text: str) -> list[dict]:
    """Parse an INPE Queimadas CSV into normalized fire-focus dicts."""
    reader = csv.DictReader(io.StringIO(text.strip()))
    foci: list[dict] = []
    for raw_row in reader:
        row = _row(raw_row)
        lat = _to_float(row.get("latitude") or row.get("lat"))
        lon = _to_float(row.get("longitude") or row.get("lon"))
        if lat is None or lon is None:
            continue
        acq_datetime = _parse_dt(
            row.get("data_hora_gmt") or row.get("datahora") or row.get("acq_date")
        )
        if acq_datetime is None:
            continue
        foci.append(
            {
                "source": SOURCE_NAME,
                "lat": lat,
                "lon": lon,
                "brightness": _to_float(row.get("brightness")),
                "frp": _to_float(row.get("frp")),
                "confidence": _confidence(row),
                "acq_datetime": acq_datetime,
                "satellite": (row.get("satelite") or row.get("satellite") or "").strip()
                or None,
            }
        )
    return foci


def _latest_files(index_html: str, days: int) -> list[str]:
    names = sorted(set(_FILE_RE.findall(index_html)))
    return names[-max(1, min(days, 10)) :]


async def _fetch_live(days: int) -> str:
    index_html = await fetch_text(_INDEX_URL)
    files = _latest_files(index_html, days)
    if not files:
        raise ExternalAPIError("INPE directory returned no daily CSV files")

    parts: list[str] = []
    header: str | None = None
    for name in files:
        text = await fetch_text(f"{_INDEX_URL}{name}")
        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            continue
        if header is None:
            header = lines[0]
            parts.append(header)
        parts.extend(lines[1:] if lines[0] == header else lines)

    if len(parts) <= 1:
        raise ExternalAPIError("INPE daily CSV files contain no rows")
    return "\n".join(parts)


async def run(
    session: Session,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 1,
) -> IngestResult:
    started = utcnow()
    regions = session.exec(select(Region)).all()
    used_fixture = False

    live_error: str | None = None
    try:
        if use_fixture:
            text = load_fixture(FIXTURE)
            used_fixture = True
        else:
            text = await _fetch_live(days)
    except (ExternalAPIError, OSError, ValueError) as exc:
        live_error = str(exc)
        if fixture_exists(FIXTURE):
            text = load_fixture(FIXTURE)
            used_fixture = True
        else:
            result = IngestResult(
                source=SOURCE_NAME,
                status="partial",
                records_count=0,
                error=live_error or "INPE indisponível e fixture ausente",
                used_fixture=False,
            )
            record_run(session, result, started)
            return result

    foci = [
        f
        for f in parse_inpe_csv(text)
        if _inside_bbox(f["lat"], f["lon"], bbox)
    ]

    session.exec(delete(FireFocus).where(FireFocus.source == SOURCE_NAME))
    for f in foci:
        f["region_id"] = region_for_point(regions, f["lat"], f["lon"])
        session.add(FireFocus(**f))
    session.commit()

    result = IngestResult(
        source=SOURCE_NAME,
        status="success",
        records_count=len(foci),
        error=live_error,
        used_fixture=used_fixture,
    )
    record_run(session, result, started)
    return result
