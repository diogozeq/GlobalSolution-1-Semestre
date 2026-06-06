"""RAG management endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db.session import get_session
from app.rag.index import reindex

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/reindex")
def rag_reindex(session: Session = Depends(get_session)) -> dict:
    return reindex(session)
