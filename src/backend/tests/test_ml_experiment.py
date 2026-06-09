def test_risk_logreg_experiment_returns_confusion_matrix(client):
    client.post("/ingest/run?use_fixture=true&sources=firms,weather,eonet,inpe")
    for _ in range(3):
        client.post("/risk/recalculate")

    resp = client.post("/ml/risk-logreg")
    assert resp.status_code == 200
    data = resp.json()
    assert data["available"] is True
    assert data["model"] == "sklearn LogisticRegression"
    assert data["sample_count"] >= 18
    assert len(data["labels"]) >= 2
    assert len(data["confusion_matrix"]) == len(data["labels"])
    assert "balanced_accuracy" in data["metrics"]
    assert data["temporal_validation"]
    assert data["temporal_validation"]["fold_count"] >= 1
    assert "macro_f1" in data["temporal_validation"]["metrics_mean"]
    assert data["warnings"]
