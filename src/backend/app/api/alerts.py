"""Alert endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])

_VALID = {"open", "ack", "closed"}


class StatusUpdate(BaseModel):
    status: str


@router.get("")
def list_alerts(session: Session = Depends(get_session)) -> list[Alert]:
    return session.exec(select(Alert).order_by(Alert.id.desc()).limit(100)).all()


@router.patch("/{alert_id}/status")
def update_status(
    alert_id: int, body: StatusUpdate, session: Session = Depends(get_session)
) -> Alert:
    if body.status not in _VALID:
        raise HTTPException(status_code=400, detail=f"status inválido: {body.status}")
    alert = session.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    alert.status = body.status
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert
