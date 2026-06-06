"""Initial seed of monitored Brazilian regions.

bbox is "minlon,minlat,maxlon,maxlat" (west,south,east,north) used directly
by the NASA FIRMS area endpoint.
"""
from __future__ import annotations

from sqlmodel import Session, select

from app.models import Region

REGIONS: list[dict] = [
    {
        "name": "Amazônia Legal",
        "state": "AM/PA/MT",
        "center_lat": -5.0,
        "center_lon": -58.0,
        "bbox": "-62,-10,-50,0",
        "area_km2": 5217423.0,
    },
    {
        "name": "Cerrado / Planalto Central",
        "state": "GO/DF",
        "center_lat": -15.78,
        "center_lon": -47.93,
        "bbox": "-50,-18,-46,-13",
        "area_km2": 2036448.0,
    },
    {
        "name": "Pantanal",
        "state": "MS/MT",
        "center_lat": -18.0,
        "center_lon": -56.5,
        "bbox": "-58,-20,-55,-16",
        "area_km2": 150355.0,
    },
    {
        "name": "Caatinga",
        "state": "BA/PE",
        "center_lat": -9.5,
        "center_lon": -40.5,
        "bbox": "-43,-12,-38,-7",
        "area_km2": 844453.0,
    },
    {
        "name": "Pará Sul (Novo Progresso)",
        "state": "PA",
        "center_lat": -7.0,
        "center_lon": -55.4,
        "bbox": "-58,-9,-53,-5",
        "area_km2": 320000.0,
    },
    {
        "name": "Mato Grosso Central",
        "state": "MT",
        "center_lat": -12.6,
        "center_lon": -55.7,
        "bbox": "-58,-15,-53,-10",
        "area_km2": 410000.0,
    },
]


def seed_regions(session: Session) -> int:
    """Insert seed regions if the table is empty. Returns number inserted."""
    if session.exec(select(Region)).first() is not None:
        return 0
    for data in REGIONS:
        session.add(Region(**data))
    session.commit()
    return len(REGIONS)
