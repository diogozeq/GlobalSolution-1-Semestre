"""Ingestion endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.ingestion.service import ADAPTERS, run_ingest
from app.models import IngestRun

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/run")
async def ingest_run(
    use_fixture: bool = Query(False, description="Force local fixtures (offline demo)"),
    days: int = Query(1, ge=1, le=10),
    bbox: str | None = Query(None, description="west,south,east,north"),
    sources: str | None = Query(
        None, description=f"Comma separated. Available: {','.join(ADAPTERS)}"
    ),
    session: Session = Depends(get_session),
) -> dict:
    src_list = [s.strip() for s in sources.split(",") if s.strip()] if sources else None
    runs = await run_ingest(
        session, src_list, use_fixture=use_fixture, bbox=bbox, days=days
    )
    return {"runs": runs}


@router.get("/runs")
def list_runs(session: Session = Depends(get_session)) -> list[IngestRun]:
    return session.exec(select(IngestRun).order_by(IngestRun.id.desc()).limit(50)).all()
