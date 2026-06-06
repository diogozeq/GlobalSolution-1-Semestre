"""Pytest fixtures. Uses an isolated test database."""
from __future__ import annotations

import os
import pathlib

os.environ["DATABASE_URL"] = "sqlite:///./test_orbitguard.db"
os.environ["EMBEDDINGS_PROVIDER"] = "none"
os.environ["OPENROUTER_API_KEY"] = ""
os.environ["FIRMS_MAP_KEY"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

_DB = pathlib.Path("test_orbitguard.db")


@pytest.fixture(scope="session")
def client():
    if _DB.exists():
        _DB.unlink()
    from app.main import app

    with TestClient(app) as c:
        yield c
    if _DB.exists():
        try:
            _DB.unlink()
        except PermissionError:
            pass
