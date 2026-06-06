"""RAG agent: combines the knowledge base with live system data (tools)."""
from __future__ import annotations

import re
import unicodedata
from datetime import timedelta, timezone

from sqlmodel import Session, select

from app.llm.router import LLMUnavailable, chat_completion
from app.models import FireFocus, Region, RiskAssessment, WeatherReading
from app.rag.retriever import retrieve
from app.risk.features import reference_time

_WORD = re.compile(r"[a-z0-9]+")


def _norm_tokens(text: str) -> set[str]:
    """Lowercase, accent-stripped whole-word tokens (so 'Pará' == 'para')."""
    stripped = "".join(
        c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c)
    )
    return set(_WORD.findall(stripped))

_SYSTEM = (
    "Você é o agente analítico do OrbitGuard AI. Responda em português do Brasil, "
    "de forma objetiva, usando o CONTEXTO fornecido (documentação + dados vivos). "
    "Cite que se trata de estimativa de apoio à decisão, não alerta oficial. "
    "Se o contexto não cobrir a pergunta, diga isso. Não invente números."
)


def _region_keywords(region: Region) -> set[str]:
    """Accent-insensitive distinctive tokens (name words >3 chars + state codes).

    Favors recall: typing 'Para' or 'Pará' both detect the Pará region. A rare
    false match on the preposition 'para' only attaches that region's live data
    to the context, which is low-harm for the POC.
    """
    kws = {w for w in _norm_tokens(region.name) if len(w) > 3}
    kws |= {s for s in _norm_tokens(region.state) if len(s) >= 2}
    return kws


def detect_region(session: Session, question: str) -> Region | None:
    qwords = _norm_tokens(question)
    regions = session.exec(select(Region)).all()
    for region in regions:
        if _region_keywords(region) & qwords:
            return region
    return None


# ---- internal tools ----
def get_risk(session: Session, region: Region) -> dict | None:
    row = session.exec(
        select(RiskAssessment)
        .where(RiskAssessment.region_id == region.id)
        .order_by(RiskAssessment.id.desc())
    ).first()
    if not row:
        return None
    return {"score": row.score, "level": row.level, "explanation": row.explanation}


def get_fires(session: Session, region: Region) -> dict:
    ref = reference_time(session)
    fires = session.exec(
        select(FireFocus).where(FireFocus.region_id == region.id)
    ).all()
    last24 = [f for f in fires if f.acq_datetime and _aware(f.acq_datetime) >= ref - timedelta(hours=24)]
    return {"total": len(fires), "last_24h": len(last24)}


def get_weather(session: Session, region: Region) -> dict | None:
    row = session.exec(
        select(WeatherReading)
        .where(WeatherReading.region_id == region.id)
        .order_by(WeatherReading.timestamp.desc())
    ).first()
    if not row:
        return None
    return {"temp": row.temp, "humidity": row.humidity, "precip": row.precip, "wind": row.wind}


def _aware(dt):
    from datetime import timezone

    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _dedup_sources(chunks: list[dict]) -> list[dict]:
    seen: set[str] = set()
    sources: list[dict] = []
    for c in chunks:
        title = c.get("title", "")
        if title and title not in seen:
            seen.add(title)
            sources.append({"title": title, "source_url": c.get("source_url", "")})
    return sources


def _fallback_answer(region, tool_lines, chunks) -> str:
    parts: list[str] = []
    if region and tool_lines:
        parts.append(" ".join(tool_lines))
    if chunks:
        parts.append("Segundo a base de conhecimento: " + chunks[0]["text"][:320])
    if not parts:
        parts.append("Não encontrei contexto suficiente na base para responder com segurança.")
    parts.append("(Resposta composta sem LLM — estimativa de apoio à decisão.)")
    return " ".join(parts)


def run(session: Session, question: str, region_id: int | None = None) -> dict:
    region = session.get(Region, region_id) if region_id else detect_region(session, question)
    used_tools: list[str] = []
    tool_lines: list[str] = []

    if region:
        risk = get_risk(session, region)
        if risk:
            used_tools.append("get_risk")
            tool_lines.append(
                f"{region.name} está em risco {risk['level']} (score {risk['score']}/100): {risk['explanation']}"
            )
        fires = get_fires(session, region)
        used_tools.append("get_fires")
        tool_lines.append(f"Focos em {region.name}: {fires['last_24h']} em 24h, {fires['total']} no total.")
        weather = get_weather(session, region)
        if weather:
            used_tools.append("get_weather")
            tool_lines.append(
                f"Clima em {region.name}: {weather['temp']}°C, umidade {weather['humidity']}%, vento {weather['wind']} km/h."
            )

    chunks = retrieve(question, k=4)
    sources = _dedup_sources(chunks)
    context = "\n".join(
        ["[DADOS VIVOS]", *tool_lines, "", "[DOCUMENTAÇÃO]", *[f"- {c['text']}" for c in chunks]]
    )

    try:
        answer, _model = chat_completion(
            "agent",
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": f"Pergunta: {question}\n\nCONTEXTO:\n{context}"},
            ],
        )
        available = True
    except LLMUnavailable:
        answer = _fallback_answer(region, tool_lines, chunks)
        available = False

    return {
        "answer": answer,
        "sources": sources,
        "used_tools": used_tools,
        "available": available,
    }
