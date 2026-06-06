"""Risk recalculation creates alerts and does not duplicate them."""


def _setup(client):
    client.post("/ingest/run?use_fixture=true&sources=firms,weather,eonet,inpe")
    client.post("/risk/recalculate")


def test_risk_levels_make_sense(client):
    _setup(client)
    risk = client.get("/risk").json()
    assert len(risk) >= 5
    levels = {r["name"]: r["level"] for r in risk}
    # Amazônia Legal should be the highest-risk region (Alto or Critico)
    top = max(risk, key=lambda r: r["score"])
    assert top["level"] in ("Alto", "Critico")
    assert any(lvl in ("Alto", "Critico") for lvl in levels.values())


def test_alert_dedup(client):
    _setup(client)
    first = [a for a in client.get("/alerts").json() if a["status"] == "open"]
    # recalc again — must NOT duplicate open alerts per region
    client.post("/risk/recalculate")
    second = [a for a in client.get("/alerts").json() if a["status"] == "open"]
    assert len(first) > 0
    assert len(second) == len(first)
    region_ids = [a["region_id"] for a in second]
    assert len(region_ids) == len(set(region_ids))  # one open alert per region


def test_alert_status_patch(client):
    _setup(client)
    alerts = [a for a in client.get("/alerts").json() if a["status"] == "open"]
    if alerts:
        aid = alerts[0]["id"]
        resp = client.patch(f"/alerts/{aid}/status", json={"status": "ack"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ack"
