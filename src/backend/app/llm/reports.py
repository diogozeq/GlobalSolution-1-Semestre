"""Generate explainable technical reports (LLM with deterministic fallback)."""
from __future__ import annotations

import json

from sqlmodel import Session, select

from app.llm.router import LLMUnavailable, chat_completion
from app.llm.schemas import ReportDoc, ReportResult
from app.models import Alert, Region, RiskAssessment
from app.risk.engine import assess_region
from app.risk.features import reference_time

_SYSTEM = (
    "Você é um analista técnico de monitoramento ambiental do OrbitGuard AI. "
    "Gere um laudo curto em português do Brasil usando APENAS os dados fornecidos. "
    "Não invente valores; se um dado faltar, declare a limitação. "
    "Deixe claro que é uma estimativa de apoio à decisão e não substitui órgãos oficiais. "
    'Responda SOMENTE em JSON com as chaves: "summary" (string), '
    '"evidence" (lista de strings), "recommended_actions" (lista de strings).'
)


def _latest_assessment(session: Session, region_id: int) -> RiskAssessment | None:
    return session.exec(
        select(RiskAssessment)
        .where(RiskAssessment.region_id == region_id)
        .order_by(RiskAssessment.id.desc())
    ).first()


def _evidence_from_features(f: dict) -> list[str]:
    ev: list[str] = [
        f"{f.get('foci_24h', 0)} focos de calor nas últimas 24h "
        f"({f.get('foci_7d', 0)} nos últimos 7 dias)."
    ]
    if f.get("avg_brightness"):
        ev.append(f"Brilho médio dos focos: {f['avg_brightness']} K.")
    if f.get("avg_confidence"):
        ev.append(f"Confiança média de detecção: {f['avg_confidence']}%.")
    if f.get("humidity") is not None:
        ev.append(f"Umidade relativa do ar em {f['humidity']}%.")
    if f.get("wind") is not None:
        tend = "favorece propagação" if (f["wind"] or 0) >= 15 else "baixa propagação"
        ev.append(f"Vento a {f['wind']} km/h ({tend}).")
    if f.get("precip") is not None:
        ev.append(f"Precipitação recente de {f['precip']} mm.")
    return ev


_ACTIONS = {
    "Critico": [
        "Acionamento imediato do Corpo de Bombeiros no setor afetado.",
        "Notificar propriedades rurais no raio de 20 km.",
        "Mobilizar brigadas de incêndio locais e Defesa Civil.",
    ],
    "Alto": [
        "Elevar nível de monitoramento da região.",
        "Pré-posicionar brigadas e recursos de combate.",
        "Alertar a Defesa Civil municipal.",
    ],
    "Moderado": [
        "Monitorar a evolução nas próximas 24h.",
        "Revisar focos com alta confiança de detecção.",
    ],
    "Baixo": ["Manter monitoramento de rotina."],
}


def _rule_based(region: Region, assessment: RiskAssessment, f: dict) -> ReportDoc:
    return ReportDoc(
        title=f"Laudo de Risco — {region.name}",
        risk_level=assessment.level,
        summary=assessment.explanation,
        evidence=_evidence_from_features(f),
        recommended_actions=_ACTIONS.get(assessment.level, _ACTIONS["Baixo"]),
    )


def generate_report(session: Session, region_id: int) -> ReportResult:
    region = session.get(Region, region_id)
    if region is None:
        return ReportResult(available=False, error="Região não encontrada")

    assessment = _latest_assessment(session, region_id)
    if assessment is None:
        ref = reference_time(session)
        assessment = assess_region(session, region, ref)
        session.commit()
        session.refresh(assessment)

    features = json.loads(assessment.features_json or "{}")

    doc: ReportDoc
    model: str
    try:
        user_payload = {
            "regiao": region.name,
            "estado": region.state,
            "classificacao": assessment.level,
            "score": assessment.score,
            "features": features,
        }
        content, model = chat_completion(
            "report",
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            json_mode=True,
        )
        data = json.loads(content)
        doc = ReportDoc(
            title=f"Laudo de Risco — {region.name}",
            risk_level=assessment.level,
            summary=str(data.get("summary") or assessment.explanation),
            evidence=[str(x) for x in (data.get("evidence") or _evidence_from_features(features))],
            recommended_actions=[
                str(x) for x in (data.get("recommended_actions") or _ACTIONS.get(assessment.level, []))
            ],
        )
    except (LLMUnavailable, json.JSONDecodeError, KeyError, TypeError):
        doc = _rule_based(region, assessment, features)
        model = "fallback (regras)"

    # Persist report text on an open alert, if any
    open_alert = session.exec(
        select(Alert).where(Alert.region_id == region_id, Alert.status == "open")
    ).first()
    if open_alert:
        open_alert.report_text = doc.summary
        session.add(open_alert)
        session.commit()

    return ReportResult(available=True, report=doc, model=model)
