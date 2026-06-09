"""Risk endpoints."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Region, RiskAssessment
from app.risk.engine import latest_assessments, recalculate_all

router = APIRouter(prefix="/risk", tags=["risk"])


def _to_item(session: Session, a: RiskAssessment) -> dict:
    region = session.get(Region, a.region_id)
    return {
        "region_id": a.region_id,
        "name": region.name if region else f"Região {a.region_id}",
        "state": region.state if region else "",
        "center_lat": region.center_lat if region else None,
        "center_lon": region.center_lon if region else None,
        "score": a.score,
        "level": a.level,
        "explanation": a.explanation,
        "features": json.loads(a.features_json or "{}"),
        "created_at": a.created_at.isoformat(),
    }


@router.post("/recalculate")
def recalculate(session: Session = Depends(get_session)) -> dict:
    return {"assessed": recalculate_all(session)}


@router.get("")
def list_risk(session: Session = Depends(get_session)) -> list[dict]:
    rows = latest_assessments(session)
    items = [_to_item(session, a) for a in rows]
    items.sort(key=lambda x: x["score"], reverse=True)
    return items


@router.get("/{region_id}/history")
def get_region_risk_history(
    region_id: int,
    limit: int = Query(40, ge=2, le=200),
    session: Session = Depends(get_session),
) -> list[dict]:
    """Histórico de avaliações de risco da região (mais antigo → mais recente)."""
    rows = session.exec(
        select(RiskAssessment)
        .where(RiskAssessment.region_id == region_id)
        .order_by(RiskAssessment.id.desc())
        .limit(limit)
    ).all()
    return [
        {"score": r.score, "level": r.level, "created_at": r.created_at.isoformat()}
        for r in reversed(rows)
    ]


@router.get("/{region_id}")
def get_region_risk(region_id: int, session: Session = Depends(get_session)) -> dict:
    rows = latest_assessments(session)
    for a in rows:
        if a.region_id == region_id:
            return _to_item(session, a)
    raise HTTPException(status_code=404, detail="Sem avaliação de risco para a região")
