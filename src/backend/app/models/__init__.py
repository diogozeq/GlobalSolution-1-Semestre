"""SQLModel ORM models for OrbitGuard AI.

All tables defined in one module to keep foreign keys and metadata coherent.
JSON-ish payloads (bbox, features_json, raw_json) are stored as TEXT and
(de)serialized in application code.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Region(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    state: str = ""
    center_lat: float
    center_lon: float
    bbox: str  # "minlon,minlat,maxlon,maxlat" (west,south,east,north)
    area_km2: float = 0.0


class IngestRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    source: str = Field(index=True)
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = None
    status: str = "success"  # success | partial | failed
    error: str | None = None
    records_count: int = 0
    used_fixture: bool = False


class FireFocus(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    source: str = Field(index=True)
    lat: float
    lon: float
    brightness: float | None = None
    frp: float | None = None
    confidence: float | None = None  # normalized 0-100
    acq_datetime: datetime
    satellite: str | None = None
    region_id: int | None = Field(default=None, foreign_key="region.id", index=True)


class WeatherReading(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    source: str
    region_id: int | None = Field(default=None, foreign_key="region.id", index=True)
    temp: float | None = None
    humidity: float | None = None
    precip: float | None = None
    wind: float | None = None
    timestamp: datetime = Field(default_factory=utcnow)


class NaturalEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    source: str = "EONET"
    category: str = ""
    title: str = ""
    lat: float | None = None
    lon: float | None = None
    started_at: datetime | None = None
    raw_json: str = "{}"


class RiskAssessment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    region_id: int = Field(foreign_key="region.id", index=True)
    score: float = 0.0
    level: str = "Baixo"  # Baixo | Moderado | Alto | Critico
    features_json: str = "{}"
    explanation: str = ""
    created_at: datetime = Field(default_factory=utcnow)


class Alert(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    region_id: int = Field(foreign_key="region.id", index=True)
    severity: str = "Alto"  # Alto | Critico
    reason: str = ""
    status: str = "open"  # open | ack | closed
    score: float = 0.0
    report_text: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class KnowledgeDocument(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    source_url: str = ""
    kind: str = "reference"
    indexed_at: datetime = Field(default_factory=utcnow)


class SensorReading(SQLModel, table=True):
    """Ground sensor reading (ESP32/Wokwi simulation) — IoT/Edge layer."""
    id: int | None = Field(default=None, primary_key=True)
    region_id: int | None = Field(default=None, foreign_key="region.id", index=True)
    device_id: str = "esp32-sim"
    temperature: float | None = None   # °C
    humidity: float | None = None      # %
    smoke: float | None = None         # índice 0-100 (sensor de fumaça)
    soil_moisture: float | None = None # %
    created_at: datetime = Field(default_factory=utcnow)


__all__ = [
    "Region",
    "IngestRun",
    "FireFocus",
    "WeatherReading",
    "NaturalEvent",
    "RiskAssessment",
    "Alert",
    "KnowledgeDocument",
    "SensorReading",
    "utcnow",
]
