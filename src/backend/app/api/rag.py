"""RAG management endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db.session import get_session
from app.core.config import settings
from app.rag.index import reindex

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/reindex")
def rag_reindex(session: Session = Depends(get_session)) -> dict:
    if settings.environment != "development":
        raise HTTPException(status_code=403, detail="Reindexacao disponivel apenas em development")
    return reindex(session)
