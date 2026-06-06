"""INPE Queimadas ingestion adapter (Brazilian fire foci — cross validation).

Docs: https://data.inpe.br/queimadas/dados-abertos/
The public endpoint layout changes often, so this adapter defaults to the local
fixture and is used as a FIRMS x INPE comparison source.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from sqlmodel import Session, delete, select

from app.ingestion.base import (
    IngestResult,
    load_fixture,
    record_run,
    region_for_point,
)
from app.models import FireFocus, Region, utcnow

SOURCE_NAME = "INPE"
FIXTURE = "inpe_sample.csv"


def _to_float(raw: str | None) -> float | None:
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _parse_dt(raw: str | None) -> datetime:
    if not raw:
        return utcnow()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw.replace("Z", "").strip(), fmt).replace(
                tzinfo=timezone.utc
            )
        except ValueError:
            continue
    return utcnow()


def parse_inpe_csv(text: str) -> list[dict]:
    """Parse an INPE Queimadas CSV into normalized fire-focus dicts."""
    reader = csv.DictReader(io.StringIO(text.strip()))
    foci: list[dict] = []
    for row in reader:
        lat = _to_float(row.get("latitude") or row.get("lat"))
        lon = _to_float(row.get("longitude") or row.get("lon"))
        if lat is None or lon is None:
            continue
        foci.append(
            {
                "source": SOURCE_NAME,
                "lat": lat,
                "lon": lon,
                "brightness": _to_float(row.get("frp") or row.get("brightness")),
                "confidence": _to_float(row.get("confidence") or row.get("confianca")),
                "acq_datetime": _parse_dt(
                    row.get("data_hora_gmt") or row.get("datahora") or row.get("acq_date")
                ),
                "satellite": (row.get("satelite") or row.get("satellite") or "").strip()
                or None,
            }
        )
    return foci


async def run(
    session: Session,
    *,
    use_fixture: bool = True,
    bbox: str | None = None,
    days: int = 1,
) -> IngestResult:
    started = utcnow()
    regions = session.exec(select(Region)).all()
    text = load_fixture(FIXTURE)
    foci = parse_inpe_csv(text)

    session.exec(delete(FireFocus).where(FireFocus.source == SOURCE_NAME))
    for f in foci:
        f["region_id"] = region_for_point(regions, f["lat"], f["lon"])
        session.add(FireFocus(**f))
    session.commit()

    result = IngestResult(
        source=SOURCE_NAME,
        status="success",
        records_count=len(foci),
        used_fixture=True,
    )
    record_run(session, result, started)
    return result
