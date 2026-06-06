"""End-to-end fixture ingestion (offline demo path)."""


def test_ingest_fixture_populates_fires(client):
    resp = client.post("/ingest/run?use_fixture=true&sources=firms,weather,eonet,inpe")
    assert resp.status_code == 200
    runs = resp.json()["runs"]
    sources = {r["source"]: r for r in runs}
    assert sources["FIRMS"]["records_count"] > 0
    assert sources["FIRMS"]["used_fixture"] is True

    fires = client.get("/fires").json()
    assert len(fires) > 0
    assert all("lat" in f and "lon" in f for f in fires)

    # FIRMS foci should be assigned to regions by bbox
    assigned = [f for f in fires if f["region_id"] is not None]
    assert len(assigned) > 0


def test_ingest_fixture_weather_and_events(client):
    client.post("/ingest/run?use_fixture=true&sources=weather,eonet")
    weather = client.get("/weather").json()
    assert isinstance(weather, list) and len(weather) > 0
    events = client.get("/events").json()
    assert len(events) >= 4
