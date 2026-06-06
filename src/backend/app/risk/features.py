"""Aggregate per-region features from raw ingested data.

Recency windows are measured relative to the most recent fire acquisition in the
dataset (data-relative "now"), so results are deterministic regardless of the
machine clock — important for the fixture-based demo.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.models import FireFocus, Region, WeatherReading

_PREFERRED_WEATHER = "Open-Meteo"


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def reference_time(session: Session) -> datetime:
    """Most recent fire acquisition across all sources (fallback: now)."""
    fires = session.exec(select(FireFocus)).all()
    times = [_as_utc(f.acq_datetime) for f in fires if f.acq_datetime]
    return max(times) if times else datetime.now(timezone.utc)


def _latest_weather(session: Session, region_id: int) -> WeatherReading | None:
    rows = session.exec(
        select(WeatherReading)
        .where(WeatherReading.region_id == region_id)
        .order_by(WeatherReading.timestamp.desc())
    ).all()
    if not rows:
        return None
    preferred = [r for r in rows if r.source == _PREFERRED_WEATHER]
    return preferred[0] if preferred else rows[0]


def compute_features(session: Session, region: Region, ref: datetime) -> dict:
    """Return the raw feature dict used by the scoring engine."""
    fires = session.exec(
        select(FireFocus).where(FireFocus.region_id == region.id)
    ).all()
    win_24h = ref - timedelta(hours=24)
    win_7d = ref - timedelta(days=7)

    recent_24h = [f for f in fires if _as_utc(f.acq_datetime) and _as_utc(f.acq_datetime) >= win_24h]
    recent_7d = [f for f in fires if _as_utc(f.acq_datetime) and _as_utc(f.acq_datetime) >= win_7d]

    bright_vals = [f.brightness for f in recent_7d if f.brightness is not None]
    conf_vals = [f.confidence for f in recent_7d if f.confidence is not None]

    area_units = max((region.area_km2 or 1.0) / 1000.0, 1.0)
    density_24h = len(recent_24h) / area_units

    weather = _latest_weather(session, region.id)

    return {
        "foci_24h": len(recent_24h),
        "foci_7d": len(recent_7d),
        "density_24h": round(density_24h, 4),
        "avg_brightness": round(sum(bright_vals) / len(bright_vals), 1) if bright_vals else None,
        "avg_confidence": round(sum(conf_vals) / len(conf_vals), 1) if conf_vals else None,
        "temp": weather.temp if weather else None,
        "humidity": weather.humidity if weather else None,
        "precip": weather.precip if weather else None,
        "wind": weather.wind if weather else None,
        "has_weather": weather is not None,
    }
