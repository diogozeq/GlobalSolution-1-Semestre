def test_fires_rejects_invalid_bbox(client):
    resp = client.get("/fires?bbox=bad")
    assert resp.status_code == 400


def test_fires_rejects_invalid_date(client):
    resp = client.get("/fires?date_from=not-a-date")
    assert resp.status_code == 400
