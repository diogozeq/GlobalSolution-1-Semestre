"""Tests for the dashboard-enrichment endpoints (sensor, cross-validation, history)."""


def _setup(client):
    client.post("/ingest/run?use_fixture=true&sources=firms,weather,eonet,inpe")
    client.post("/risk/recalculate")


def test_health_reports_rag_mode(client):
    data = client.get("/health").json()
    assert data["rag_mode"] in ("chroma", "tfidf", "hybrid")


def test_region_detection_synonym_and_flagship(client):
    _setup(client)
    # Flagship demo question (accented) must fire the live-data tools
    r1 = client.post("/chat", json={"question": "Por que o Pará está em risco alto?"})
    assert "get_fires" in r1.json()["used_tools"]
    # Biome synonym ("sertão" -> Caatinga) should also detect a region
    r2 = client.post("/chat", json={"question": "Qual o risco no sertão nordestino?"})
    assert "get_fires" in r2.json()["used_tools"]
    # Preposition "para" must NOT be mistaken for the Pará region
    r3 = client.post("/chat", json={"question": "O que fazer para reduzir queimadas?"})
    assert "get_fires" not in r3.json()["used_tools"]


def test_sensor_create_and_latest(client):
    payload = {"region_id": 1, "temperature": 38.5, "humidity": 14, "smoke": 120, "soil_moisture": 8}
    created = client.post("/sensor/readings", json=payload)
    assert created.status_code == 200
    assert created.json()["temperature"] == 38.5

    latest = client.get("/sensor/latest", params={"region_id": 1}).json()
    assert latest is not None
    assert latest["smoke"] == 120

    per_region = client.get("/sensor/regions-latest").json()
    assert isinstance(per_region, list) and len(per_region) >= 5


def test_sensor_validation_rejects_bad_values(client):
    resp = client.post("/sensor/readings", json={"humidity": 250})
    assert resp.status_code == 422


def test_fires_cross_validation(client):
    _setup(client)
    data = client.get("/fires/cross-validation").json()
    assert data["firms_foci"] > 0
    assert data["inpe_foci"] > 0
    assert "confirmed_cells" in data
    assert 0 <= data["confirmation_rate"] <= 100


def test_risk_history(client):
    _setup(client)
    client.post("/risk/recalculate")  # second point
    history = client.get("/risk/1/history").json()
    assert isinstance(history, list)
    assert len(history) >= 2
    assert all("score" in h and "created_at" in h for h in history)
