def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "time" in data


def test_regions_seeded(client):
    resp = client.get("/regions")
    assert resp.status_code == 200
    regions = resp.json()
    assert len(regions) >= 5
    assert any(r["name"] == "Amazônia Legal" for r in regions)
