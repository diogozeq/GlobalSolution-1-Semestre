"""Configurable thresholds and weights for the risk engine."""
from __future__ import annotations

from app.core.config import settings

# Fire activity normalization
COUNT_CAP = 20.0
DENSITY_CAP = 0.5
BRIGHT_MIN = 300.0
BRIGHT_RANGE = 60.0
FRP_CAP = 80.0

# Weather stress normalization
TEMP_MIN = 25.0
TEMP_RANGE = 15.0
HUMIDITY_HIGH = 60.0
HUMIDITY_RANGE = 45.0
PRECIP_CAP = 5.0

# Spread
WIND_CAP = 30.0

# Sub-weights for fire_activity composite
FIRE_W_COUNT = 0.60
FIRE_W_DENSITY = 0.10
FIRE_W_BRIGHT = 0.10
FIRE_W_FRP = 0.05
FIRE_W_CONF = 0.15

# Sub-weights for weather_stress composite
WEATHER_W_TEMP = 0.40
WEATHER_W_HUMIDITY = 0.40
WEATHER_W_PRECIP = 0.20

WEATHER_MISSING_BASELINE = 40.0


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
    weights = {
        "fire": settings.risk_w_fire,
        "weather": settings.risk_w_weather,
        "spread": settings.risk_w_spread,
        "trend": settings.risk_w_trend,
    }
    if any(v < 0 for v in weights.values()):
        return {"fire": 0.40, "weather": 0.30, "spread": 0.15, "trend": 0.15}
    total = sum(weights.values()) or 1.0
    return {k: v / total for k, v in weights.items()}
