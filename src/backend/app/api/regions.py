"""Region endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Region

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("")
def list_regions(session: Session = Depends(get_session)) -> list[Region]:
    return session.exec(select(Region).order_by(Region.id)).all()


@router.get("/{region_id}")
def get_region(region_id: int, session: Session = Depends(get_session)) -> Region:
    region = session.get(Region, region_id)
    if region is None:
        raise HTTPException(status_code=404, detail="Region not found")
    return region
