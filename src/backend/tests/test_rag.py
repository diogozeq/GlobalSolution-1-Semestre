"""RAG retrieval + chat agent (TF-IDF fallback, no LLM key in tests)."""


def test_reindex(client):
    resp = client.post("/rag/reindex")
    assert resp.status_code == 200
    data = resp.json()
    assert data["indexed_chunks"] > 0
    assert data["docs"] >= 5


def test_chat_returns_sources(client):
    client.post("/rag/reindex")
    resp = client.post("/chat", json={"question": "Qual a diferença entre FIRMS e EONET?"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["answer"], str) and len(data["answer"]) > 0
    assert len(data["sources"]) > 0
    assert all("title" in s for s in data["sources"])


def test_chat_accepts_short_operator_greeting(client):
    resp = client.post("/chat", json={"question": "OI", "region_id": 1})
    assert resp.status_code == 200
    assert resp.json()["answer"]


def test_chat_uses_region_tools(client):
    client.post("/ingest/run?use_fixture=true&sources=firms,weather,eonet")
    client.post("/risk/recalculate")
    resp = client.post("/chat", json={"question": "Por que o Pará está em risco alto?"})
    assert resp.status_code == 200
    data = resp.json()
    # region detected -> live-data tools used
    assert "get_fires" in data["used_tools"]


def test_generic_para_does_not_detect_para_region(client):
    client.post("/ingest/run?use_fixture=true&sources=firms,weather,eonet")
    client.post("/risk/recalculate")
    resp = client.post(
        "/chat",
        json={"question": "O que posso fazer para reduzir risco de queimadas?"},
    )
    assert resp.status_code == 200
    assert "get_fires" not in resp.json()["used_tools"]
