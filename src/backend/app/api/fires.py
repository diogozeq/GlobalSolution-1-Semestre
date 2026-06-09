"""Fire-foci endpoints (map data)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.ingestion.base import parse_bbox
from app.models import FireFocus

router = APIRouter(prefix="/fires", tags=["fires"])


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Data invalida: {value}") from None


@router.get("/cross-validation")
def cross_validation(
    grid: float = Query(0.1, ge=0.01, le=1.0, description="Tamanho da célula (graus) p/ confirmação"),
    session: Session = Depends(get_session),
) -> dict:
    """Compara focos FIRMS (satélite NASA) x INPE (oficial BR).

    Conta quantas células espaciais foram detectadas pelas duas fontes
    (validação cruzada) — Extra A de pódio: reforça confiança e contexto Brasil.
    """
    firms = session.exec(select(FireFocus).where(FireFocus.source == "FIRMS")).all()
    inpe = session.exec(select(FireFocus).where(FireFocus.source == "INPE")).all()

    def cells(rows) -> set[tuple[int, int]]:
        return {
            (round(r.lat / grid), round(r.lon / grid)) for r in rows
        }

    firms_cells = cells(firms)
    inpe_cells = cells(inpe)
    confirmed = firms_cells & inpe_cells
    denom = min(len(firms_cells), len(inpe_cells))
    rate = round(len(confirmed) / denom * 100, 1) if denom else 0.0

    return {
        "firms_foci": len(firms),
        "inpe_foci": len(inpe),
        "firms_cells": len(firms_cells),
        "inpe_cells": len(inpe_cells),
        "confirmed_cells": len(confirmed),
        "only_firms_cells": len(firms_cells - inpe_cells),
        "only_inpe_cells": len(inpe_cells - firms_cells),
        "confirmation_rate": rate,
        "grid_deg": grid,
    }


@router.get("")
def list_fires(
    bbox: str | None = Query(None, description="west,south,east,north"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    source: str | None = Query(None),
    limit: int = Query(2000, ge=1, le=10000),
    session: Session = Depends(get_session),
) -> list[dict]:
    query = select(FireFocus)
    if source:
        query = query.where(FireFocus.source == source)
    df, dt = _parse_date(date_from), _parse_date(date_to)
    if df:
        query = query.where(FireFocus.acq_datetime >= df)
    if dt:
        query = query.where(FireFocus.acq_datetime <= dt)
    rows = session.exec(query.limit(limit)).all()

    if bbox:
        try:
            west, south, east, north = parse_bbox(bbox)
            rows = [
                r for r in rows if west <= r.lon <= east and south <= r.lat <= north
            ]
        except ValueError:
            raise HTTPException(status_code=400, detail=f"bbox invalido: {bbox}") from None

    return [
        {
            "id": r.id,
            "lat": r.lat,
            "lon": r.lon,
            "brightness": r.brightness,
            "frp": r.frp,
            "confidence": r.confidence,
            "acq_datetime": r.acq_datetime.isoformat() if r.acq_datetime else None,
            "satellite": r.satellite,
            "source": r.source,
            "region_id": r.region_id,
        }
        for r in rows
    ]
