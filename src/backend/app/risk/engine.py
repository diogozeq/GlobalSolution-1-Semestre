"""Risk scoring engine + alert management (explainable, rules-based v1)."""
from __future__ import annotations

import json

from sqlmodel import Session, select

from app.models import Alert, Region, RiskAssessment, utcnow
from app.risk import rules
from app.risk.features import compute_features, reference_time


def _fire_activity(f: dict) -> tuple[float, dict]:
    count = rules.clamp(f["foci_24h"] / rules.COUNT_CAP * 100)
    density = rules.clamp(f["density_24h"] / rules.DENSITY_CAP * 100)
    bright = rules.clamp(
        ((f["avg_brightness"] or rules.BRIGHT_MIN) - rules.BRIGHT_MIN)
        / rules.BRIGHT_RANGE
        * 100
    )
    frp = rules.clamp((f.get("avg_frp") or 0.0) / rules.FRP_CAP * 100)
    conf = rules.clamp(f["avg_confidence"] or 0.0)
    value = (
        rules.FIRE_W_COUNT * count
        + rules.FIRE_W_DENSITY * density
        + rules.FIRE_W_BRIGHT * bright
        + rules.FIRE_W_FRP * frp
        + rules.FIRE_W_CONF * conf
    )
    return value, {"count": round(count, 1), "density": round(density, 1),
                   "brightness": round(bright, 1), "frp": round(frp, 1),
                   "confidence": round(conf, 1)}


def _weather_stress(f: dict) -> tuple[float, dict]:
    if not f["has_weather"]:
        return rules.WEATHER_MISSING_BASELINE, {"note": "sem leitura climática"}
    temp = rules.clamp(((f["temp"] or rules.TEMP_MIN) - rules.TEMP_MIN) / rules.TEMP_RANGE * 100)
    humidity = rules.clamp((rules.HUMIDITY_HIGH - (f["humidity"] if f["humidity"] is not None else rules.HUMIDITY_HIGH)) / rules.HUMIDITY_RANGE * 100)
    precip = rules.clamp((rules.PRECIP_CAP - (f["precip"] if f["precip"] is not None else rules.PRECIP_CAP)) / rules.PRECIP_CAP * 100)
    value = (
        rules.WEATHER_W_TEMP * temp
        + rules.WEATHER_W_HUMIDITY * humidity
        + rules.WEATHER_W_PRECIP * precip
    )
    return value, {"temp": round(temp, 1), "humidity": round(humidity, 1), "precip": round(precip, 1)}


def _spread(f: dict) -> float:
    return rules.clamp((f["wind"] or 0.0) / rules.WIND_CAP * 100)


def _trend(f: dict) -> float:
    if f["foci_7d"] <= 0:
        return 0.0
    previous = max(f["foci_7d"] - f["foci_24h"], 0)
    baseline = max(previous / 6, 1.0)
    return rules.clamp((f["foci_24h"] / baseline) * 25)


def score_region(features: dict) -> dict:
    fa, fa_parts = _fire_activity(features)
    ws, ws_parts = _weather_stress(features)
    spread = _spread(features)
    trend = _trend(features)
    w = rules.top_weights()
    score = w["fire"] * fa + w["weather"] * ws + w["spread"] * spread + w["trend"] * trend
    score = round(rules.clamp(score), 1)
    return {
        "score": score,
        "level": rules.classify(score),
        "components": {
            "fire_activity": round(fa, 1),
            "weather_stress": round(ws, 1),
            "spread_potential": round(spread, 1),
            "trend": round(trend, 1),
        },
        "fire_parts": fa_parts,
        "weather_parts": ws_parts,
    }


def build_explanation(region: Region, result: dict, f: dict) -> str:
    comp = result["components"]
    weights = rules.top_weights()
    weighted = {
        "fire_activity": comp["fire_activity"] * weights["fire"],
        "weather_stress": comp["weather_stress"] * weights["weather"],
        "spread_potential": comp["spread_potential"] * weights["spread"],
        "trend": comp["trend"] * weights["trend"],
    }
    drivers = sorted(weighted.items(), key=lambda kv: kv[1], reverse=True)
    top = drivers[0][0].replace("_", " ")
    parts = [
        f"{region.name}: risco {result['level']} (score {result['score']}/100).",
        f"{f['foci_24h']} focos em 24h ({f['foci_7d']} em 7d).",
    ]
    if f["has_weather"]:
        parts.append(
            f"Clima: {f['temp']}°C, umidade {f['humidity']}%, vento {f['wind']} km/h, "
            f"precip {f['precip']} mm."
        )
    parts.append(f"Principal vetor: {top}.")
    return " ".join(parts)


def assess_region(session: Session, region: Region, ref) -> RiskAssessment:
    features = compute_features(session, region, ref)
    result = score_region(features)
    weights = rules.top_weights()
    payload = {
        **features,
        **result["components"],
        "fire_parts": result["fire_parts"],
        "weather_parts": result["weather_parts"],
        "weighted_components": {
            "fire_activity": round(result["components"]["fire_activity"] * weights["fire"], 2),
            "weather_stress": round(result["components"]["weather_stress"] * weights["weather"], 2),
            "spread_potential": round(result["components"]["spread_potential"] * weights["spread"], 2),
            "trend": round(result["components"]["trend"] * weights["trend"], 2),
        },
    }
    assessment = RiskAssessment(
        region_id=region.id,
        score=result["score"],
        level=result["level"],
        features_json=json.dumps(payload, ensure_ascii=False),
        explanation=build_explanation(region, result, features),
    )
    session.add(assessment)
    return assessment


def _manage_alert(session: Session, region: Region, assessment: RiskAssessment) -> None:
    active_alerts = session.exec(
        select(Alert).where(Alert.region_id == region.id, Alert.status.in_(["open", "ack"]))
    ).all()
    if assessment.level in ("Alto", "Critico"):
        if active_alerts:
            # update existing (dedup: one active alert per region)
            alert = active_alerts[0]
            alert.severity = assessment.level
            alert.score = assessment.score
            alert.reason = assessment.explanation
            session.add(alert)
            for duplicate in active_alerts[1:]:
                duplicate.status = "closed"
                session.add(duplicate)
        else:
            session.add(
                Alert(
                    region_id=region.id,
                    severity=assessment.level,
                    reason=assessment.explanation,
                    status="open",
                    score=assessment.score,
                )
            )
    else:
        for alert in active_alerts:
            alert.status = "closed"
            session.add(alert)


def recalculate_all(session: Session) -> list[dict]:
    ref = reference_time(session)
    regions = session.exec(select(Region).order_by(Region.id)).all()
    summary: list[dict] = []
    for region in regions:
        assessment = assess_region(session, region, ref)
        session.flush()  # ensure assessment id/values before alert logic
        _manage_alert(session, region, assessment)
        summary.append(
            {"region_id": region.id, "name": region.name,
             "score": assessment.score, "level": assessment.level}
        )
    session.commit()
    return summary


def latest_assessments(session: Session) -> list[RiskAssessment]:
    """Most recent assessment per region."""
    regions = session.exec(select(Region).order_by(Region.id)).all()
    out: list[RiskAssessment] = []
    for region in regions:
        row = session.exec(
            select(RiskAssessment)
            .where(RiskAssessment.region_id == region.id)
            .order_by(RiskAssessment.id.desc())
        ).first()
        if row:
            out.append(row)
    return out
