"""Structured schema for AI-generated technical reports."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ReportDoc(BaseModel):
    title: str
    risk_level: str
    summary: str
    evidence: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    limitations: str = (
        "Estimativa do OrbitGuard AI (POC acadêmica). Não substitui órgãos oficiais."
    )


class ReportResult(BaseModel):
    available: bool
    report: ReportDoc | None = None
    model: str | None = None
    error: str | None = None
