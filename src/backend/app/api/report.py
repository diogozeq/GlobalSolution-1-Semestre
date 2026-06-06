"""AI report endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db.session import get_session
from app.llm.reports import generate_report
from app.llm.schemas import ReportResult

router = APIRouter(tags=["report"])


@router.post("/report/{region_id}", response_model=ReportResult)
def make_report(region_id: int, session: Session = Depends(get_session)) -> ReportResult:
    return generate_report(session, region_id)
