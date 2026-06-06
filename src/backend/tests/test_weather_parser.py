from app.ingestion.weather import parse_openmeteo

PAYLOAD = {
    "current": {
        "time": "2026-06-06T18:00",
        "temperature_2m": 34.0,
        "relative_humidity_2m": 28,
        "precipitation": 0.2,
        "wind_speed_10m": 16.0,
    }
}


def test_parse_openmeteo_fields():
    reading = parse_openmeteo(PAYLOAD)
    assert reading["temp"] == 34.0
    assert reading["humidity"] == 28
    assert reading["precip"] == 0.2
    assert reading["wind"] == 16.0
    assert reading["timestamp"].year == 2026


def test_parse_openmeteo_empty():
    reading = parse_openmeteo({})
    assert reading["temp"] is None
    assert reading["timestamp"] is not None
