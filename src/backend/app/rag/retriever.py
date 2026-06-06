"""Thin retrieval wrapper over the knowledge index."""
from __future__ import annotations

from app.rag.index import get_index


def retrieve(query: str, k: int = 4) -> list[dict]:
    return get_index().search(query, k)
