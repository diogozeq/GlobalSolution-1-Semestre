"""Alert endpoints."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


class StatusUpdate(BaseModel):
    status: Literal["open", "ack", "closed"]


@router.get("")
def list_alerts(session: Session = Depends(get_session)) -> list[Alert]:
    return session.exec(select(Alert).order_by(Alert.id.desc()).limit(100)).all()


@router.patch("/{alert_id}/status")
def update_status(
    alert_id: int, body: StatusUpdate, session: Session = Depends(get_session)
) -> Alert:
    alert = session.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alerta nao encontrado")

    if body.status == "open":
        active = session.exec(
            select(Alert).where(
                Alert.region_id == alert.region_id,
                Alert.id != alert.id,
                Alert.status.in_(["open", "ack"]),
            )
        ).first()
        if active:
            raise HTTPException(status_code=409, detail="Ja existe alerta ativo para a regiao")

    alert.status = body.status
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert
