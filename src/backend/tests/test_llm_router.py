from app.llm import router


def test_model_pool_rotates_and_keeps_stable_fallbacks(monkeypatch):
    monkeypatch.setattr(router.settings, "llm_report_models", "a,b,c")
    monkeypatch.setattr(router.settings, "llm_fallback_models", "c,d")
    router._rotation_offsets["report"] = 0

    assert router._models_for("report") == ["a", "b", "c", "d"]
    assert router._models_for("report") == ["b", "c", "a", "d"]
    assert router._models_for("report") == ["c", "a", "b", "d"]
