"""Ingestion orchestrator: runs the requested source adapters."""
from __future__ import annotations

from sqlmodel import Session

from app.ingestion import eonet, firms, inpe, power, weather
from app.ingestion.base import IngestResult, record_run
from app.models import utcnow

ADAPTERS = {
    "firms": firms,
    "weather": weather,
    "eonet": eonet,
    "power": power,
    "inpe": inpe,
}

DEFAULT_SOURCES = ["firms", "weather", "eonet"]


async def run_ingest(
    session: Session,
    sources: list[str] | None = None,
    *,
    use_fixture: bool = False,
    bbox: str | None = None,
    days: int = 1,
) -> list[dict]:
    """Run each requested adapter, isolating failures so one bad source
    never blocks the others. Returns a per-source summary."""
    selected = [s.lower() for s in (sources or DEFAULT_SOURCES)]
    results: list[dict] = []

    for name in selected:
        adapter = ADAPTERS.get(name)
        if adapter is None:
            results.append(
                IngestResult(source=name, status="failed", error="unknown source").to_dict()
            )
            continue
        started = utcnow()
        try:
            res = await adapter.run(
                session, use_fixture=use_fixture, bbox=bbox, days=days
            )
        except Exception as exc:  # noqa: BLE001 - isolate adapter failure
            session.rollback()
            res = IngestResult(
                source=getattr(adapter, "SOURCE_NAME", name),
                status="failed",
                error=str(exc),
            )
            record_run(session, res, started)
        results.append(res.to_dict())

    return results
