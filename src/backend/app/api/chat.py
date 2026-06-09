"""RAG chat endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.db.session import get_session
from app.rag import agent

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1200)
    region_id: int | None = None


@router.post("/chat")
def chat(body: ChatRequest, session: Session = Depends(get_session)) -> dict:
    return agent.run(session, body.question, body.region_id)
