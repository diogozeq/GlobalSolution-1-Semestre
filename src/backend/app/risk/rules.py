"""Configurable thresholds and weights for the risk engine.

Weights come from settings (.env). Sub-score normalization constants live here
so the scoring stays explainable and tunable.
"""
from __future__ import annotations

from app.core.config import settings

# Fire activity normalization
COUNT_CAP = 20.0           # foci in 24h that already mean "max" fire count
DENSITY_CAP = 0.5          # foci per 1000 km2 (24h) considered "max" density
BRIGHT_MIN = 300.0         # K — below this brightness contributes ~0
BRIGHT_RANGE = 60.0        # K — span to reach max brightness score

# Weather stress normalization
TEMP_MIN = 25.0            # °C — below this temp contributes ~0
TEMP_RANGE = 15.0          # °C — span to reach max temp score (25->40)
HUMIDITY_HIGH = 60.0       # % — at/above this humidity contributes ~0
HUMIDITY_RANGE = 45.0      # % — span to reach max dryness (60%->15%)
PRECIP_CAP = 5.0           # mm — recent precip that neutralizes dryness

# Spread
WIND_CAP = 30.0            # km/h — wind that already means "max" spread potential

# Sub-weights for fire_activity composite
FIRE_W_COUNT = 0.60
FIRE_W_DENSITY = 0.10
FIRE_W_BRIGHT = 0.15
FIRE_W_CONF = 0.15

# Sub-weights for weather_stress composite
WEATHER_W_TEMP = 0.40
WEATHER_W_HUMIDITY = 0.40
WEATHER_W_PRECIP = 0.20

WEATHER_MISSING_BASELINE = 40.0  # used if a region has no weather reading


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def classify(score: float) -> str:
    if score < 25:
        return "Baixo"
    if score < 50:
        return "Moderado"
    if score < 75:
        return "Alto"
    return "Critico"


def top_weights() -> dict[str, float]:
    return {
        "fire": settings.risk_w_fire,
        "weather": settings.risk_w_weather,
        "spread": settings.risk_w_spread,
        "trend": settings.risk_w_trend,
    }
