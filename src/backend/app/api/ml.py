"""Experimental ML endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db.session import get_session
from app.ml.experimental import run_risk_logreg_experiment

router = APIRouter(prefix="/ml", tags=["ml"])


@router.post("/risk-logreg")
def risk_logreg(
    history_limit: int = Query(500, ge=20, le=5000),
    test_size: float = Query(0.34, ge=0.2, le=0.5),
    session: Session = Depends(get_session),
) -> dict:
    return run_risk_logreg_experiment(
        session,
        history_limit=history_limit,
        test_size=test_size,
    )
