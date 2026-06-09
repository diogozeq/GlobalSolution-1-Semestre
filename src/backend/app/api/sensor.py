"""Ground sensor endpoints (ESP32/Wokwi simulation — IoT/Edge layer).

Cruza "satélite + solo": leituras de solo complementam os focos orbitais.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db.session import get_session
from app.models import Region, SensorReading

router = APIRouter(prefix="/sensor", tags=["sensor"])


class SensorPayload(BaseModel):
    region_id: int | None = None
    device_id: str = Field(default="esp32-sim", max_length=64)
    temperature: float | None = Field(default=None, ge=-50, le=80)
    humidity: float | None = Field(default=None, ge=0, le=100)
    smoke: float | None = Field(default=None, ge=0, le=1000)
    soil_moisture: float | None = Field(default=None, ge=0, le=100)


@router.post("/readings")
def create_reading(
    body: SensorPayload, session: Session = Depends(get_session)
) -> SensorReading:
    reading = SensorReading(**body.model_dump())
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading


@router.get("/readings")
def list_readings(
    region_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    session: Session = Depends(get_session),
) -> list[SensorReading]:
    query = select(SensorReading)
    if region_id is not None:
        query = query.where(SensorReading.region_id == region_id)
    return session.exec(query.order_by(SensorReading.id.desc()).limit(limit)).all()


@router.get("/latest")
def latest_reading(
    region_id: int | None = Query(None), session: Session = Depends(get_session)
) -> SensorReading | None:
    query = select(SensorReading)
    if region_id is not None:
        query = query.where(SensorReading.region_id == region_id)
    return session.exec(query.order_by(SensorReading.id.desc())).first()


@router.get("/regions-latest")
def latest_per_region(session: Session = Depends(get_session)) -> list[dict]:
    """Latest sensor reading for every region (for the IoT dashboard)."""
    regions = session.exec(select(Region).order_by(Region.id)).all()
    out: list[dict] = []
    for region in regions:
        reading = session.exec(
            select(SensorReading)
            .where(SensorReading.region_id == region.id)
            .order_by(SensorReading.id.desc())
        ).first()
        out.append(
            {
                "region_id": region.id,
                "region_name": region.name,
                "reading": reading,
            }
        )
    return out
