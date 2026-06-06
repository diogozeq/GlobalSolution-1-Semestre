"""Shared helpers for ingestion adapters."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from sqlmodel import Session

from app.models import IngestRun, Region, utcnow

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures"


@dataclass
class IngestResult:
    source: str
    status: str = "success"  # success | partial | failed
    records_count: int = 0
    error: str | None = None
    used_fixture: bool = False
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "status": self.status,
            "records_count": self.records_count,
            "error": self.error,
            "used_fixture": self.used_fixture,
            **({"details": self.details} if self.details else {}),
        }


def record_run(session: Session, result: IngestResult, started_at: datetime) -> IngestRun:
    """Persist an IngestRun row for observability."""
    run = IngestRun(
        source=result.source,
        started_at=started_at,
        finished_at=utcnow(),
        status=result.status,
        error=result.error,
        records_count=result.records_count,
        used_fixture=result.used_fixture,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    return run


def parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    """Parse 'west,south,east,north' into floats."""
    west, south, east, north = (float(x) for x in bbox.split(","))
    return west, south, east, north


def region_for_point(regions: list[Region], lat: float, lon: float) -> int | None:
    """Return the id of the most specific (smallest-area) region whose bbox
    contains the point. Smaller regions win over large overlapping ones
    (e.g. 'Pará Sul' nested inside 'Amazônia Legal')."""
    best_id: int | None = None
    best_area = float("inf")
    for region in regions:
        try:
            west, south, east, north = parse_bbox(region.bbox)
        except (ValueError, AttributeError):
            continue
        if west <= lon <= east and south <= lat <= north:
            area = region.area_km2 or float("inf")
            if area < best_area:
                best_area = area
                best_id = region.id
    return best_id


def load_fixture(name: str) -> str:
    """Read a fixture file's text content."""
    path = FIXTURES_DIR / name
    return path.read_text(encoding="utf-8")


def fixture_exists(name: str) -> bool:
    return (FIXTURES_DIR / name).exists()
