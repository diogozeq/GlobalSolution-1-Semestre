"""Natural-events endpoints (EONET)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import NaturalEvent

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
def list_events(
    category: str | None = Query(None),
    session: Session = Depends(get_session),
) -> list[NaturalEvent]:
    query = select(NaturalEvent)
    if category:
        query = query.where(NaturalEvent.category == category)
    return session.exec(query.order_by(NaturalEvent.id.desc()).limit(200)).all()
