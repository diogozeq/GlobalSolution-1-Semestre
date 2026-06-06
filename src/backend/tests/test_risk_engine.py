from app.risk.engine import score_region
from app.risk.rules import classify

LOW = {
    "foci_24h": 0, "foci_7d": 0, "density_24h": 0.0,
    "avg_brightness": None, "avg_confidence": None,
    "temp": 20, "humidity": 85, "precip": 12, "wind": 4, "has_weather": True,
}

CRITICAL = {
    "foci_24h": 25, "foci_7d": 25, "density_24h": 1.0,
    "avg_brightness": 355, "avg_confidence": 95,
    "temp": 38, "humidity": 12, "precip": 0, "wind": 25, "has_weather": True,
}


def test_low_case_is_baixo():
    result = score_region(LOW)
    assert result["level"] == "Baixo"
    assert result["score"] < 25


def test_critical_case_is_critico():
    result = score_region(CRITICAL)
    assert result["level"] == "Critico"
    assert result["score"] >= 75


def test_components_present():
    result = score_region(CRITICAL)
    comp = result["components"]
    assert {"fire_activity", "weather_stress", "spread_potential", "trend"} <= comp.keys()


def test_classify_thresholds():
    assert classify(10) == "Baixo"
    assert classify(40) == "Moderado"
    assert classify(60) == "Alto"
    assert classify(90) == "Critico"
