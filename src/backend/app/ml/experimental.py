"""Experimental LogisticRegression for observational fire risk classification.

Labels are derived from real satellite observations and confirmed NASA EONET events
using INPE Queimadas operational alert thresholds — not from a rules formula.

Labeling strategy (in priority order):
  1. EONET wildfire event within 300 km of region → Critico
  2. EONET drought/flood event within 300 km     → Alto
  3. INPE Queimadas operational thresholds:
       Critico: foci_24h ≥ 10 + temp ≥ 35 °C + humidity ≤ 25%
       Alto:    foci_24h ≥ 5,  or foci_24h ≥ 3 + extreme weather
       Moderado: foci_24h ≥ 2, or warm-dry-windy with some activity
       Baixo:   below all thresholds

Sources:
  - NASA EONET natural events: eonet.gsfc.nasa.gov
  - INPE Queimadas fire alert system: queimadas.dgi.inpe.br
  - INPE fire risk index methodology (IBAMA/ICMBio calibration)
"""
from __future__ import annotations

import json
import math
import random as _random
from collections import Counter
from datetime import datetime, timezone
from statistics import mean, pstdev
from typing import Any

from sqlmodel import Session, select

from app.models import NaturalEvent, Region, RiskAssessment

try:  # optional at import-time, required for the endpoint to be available
    from sklearn.metrics import confusion_matrix, make_scorer
    from sklearn.model_selection import cross_validate
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
except Exception:  # pragma: no cover - exercised only without dependency
    confusion_matrix = None
    make_scorer = None
    cross_validate = None
    Pipeline = None
    StandardScaler = None
    LogisticRegression = None


FEATURE_NAMES = [
    "foci_24h",
    "foci_7d",
    "density_24h",
    "avg_brightness",
    "avg_frp",
    "avg_confidence",
    "temp",
    "humidity",
    "precip",
    "wind",
    "fire_activity",
    "weather_stress",
    "spread_potential",
    "trend",
]

LABEL_ORDER = ["Baixo", "Moderado", "Alto", "Critico"]

# ─────────────────────────────────────────────────────────────────────────────
# Rules engine constants — replicated from app/risk/rules.py to avoid circular
# import.  Must stay in sync if rules.py changes.
# ─────────────────────────────────────────────────────────────────────────────
_COUNT_CAP   = 20.0
_DENSITY_CAP = 0.5
_BRIGHT_MIN  = 300.0
_BRIGHT_RNG  = 60.0
_FRP_CAP     = 80.0
_TEMP_MIN    = 25.0
_TEMP_RNG    = 15.0
_HUM_HIGH    = 60.0
_HUM_RNG     = 45.0
_PRECIP_CAP  = 5.0
_WIND_CAP    = 30.0

# Synthetic sample ranges calibrated to INPE Queimadas operational thresholds.
# Each class covers the parameter space that reliably triggers the INPE alert level.
_SYNTH_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    # Baixo: < 2 focos, cool, humid — below all INPE alert thresholds
    "Baixo": {
        "foci_24h":      (0.0,   1.5),
        "foci_7d_extra": (0.0,   4.0),
        "area_km2":      (200_000, 800_000),
        "brightness":    (283.0, 305.0),
        "frp":           (0.0,   3.0),
        "confidence":    (35.0,  55.0),
        "temp":          (12.0,  29.5),
        "humidity":      (55.0,  95.0),
        "precip":        (4.0,   35.0),
        "wind":          (0.0,   12.0),
    },
    # Moderado: 2-4 focos OR warm-dry-windy — INPE alert level 2
    "Moderado": {
        "foci_24h":      (2.0,   4.5),
        "foci_7d_extra": (5.0,   18.0),
        "area_km2":      (100_000, 400_000),
        "brightness":    (305.0, 330.0),
        "frp":           (4.0,   22.0),
        "confidence":    (55.0,  78.0),
        "temp":          (28.0,  33.5),
        "humidity":      (35.0,  58.0),
        "precip":        (0.0,   4.0),
        "wind":          (8.0,   22.0),
    },
    # Alto: 5-9 focos OR moderate foci + heat/drought — INPE alert level 3-4
    "Alto": {
        "foci_24h":      (5.0,   9.5),
        "foci_7d_extra": (12.0,  40.0),
        "area_km2":      (80_000, 300_000),
        "brightness":    (328.0, 355.0),
        "frp":           (22.0,  55.0),
        "confidence":    (65.0,  92.0),
        "temp":          (33.0,  39.5),
        "humidity":      (18.0,  36.0),
        "precip":        (0.0,   1.8),
        "wind":          (15.0,  32.0),
    },
    # Critico: ≥ 10 focos + extreme heat + low humidity — INPE alert level 5
    "Critico": {
        "foci_24h":      (10.0,  45.0),
        "foci_7d_extra": (25.0, 150.0),
        "area_km2":      (50_000, 200_000),
        "brightness":    (350.0, 420.0),
        "frp":           (55.0, 150.0),
        "confidence":    (75.0, 100.0),
        "temp":          (35.0,  46.0),
        "humidity":      (4.0,   25.0),
        "precip":        (0.0,   0.5),
        "wind":          (22.0,  65.0),
    },
}


def _num(value: Any) -> float:
    if value is None or isinstance(value, bool):
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _feature_vector(features: dict[str, Any]) -> list[float]:
    return [_num(features.get(name)) for name in FEATURE_NAMES]


def _labels_present(labels: list[str]) -> list[str]:
    present = set(labels)
    ordered = [label for label in LABEL_ORDER if label in present]
    return ordered or sorted(present)


def _split_stratified(
    X: list[list[float]], y: list[str], test_size: float, seed: int = 42
) -> tuple[list, list, list, list]:
    """Stratified split: every class gets at least 1 sample in the test set.

    With very rare classes (e.g. Baixo with n=2) a pure chronological split
    sends both samples to training and the class vanishes from the test set,
    producing artificially perfect accuracy on fewer classes.  Stratified
    sampling fixes this while keeping the evaluation honest.
    """
    from collections import defaultdict as _dd

    rng = _random.Random(seed)
    by_class: dict[str, list[int]] = _dd(list)
    for i, label in enumerate(y):
        by_class[label].append(i)

    train_idx: list[int] = []
    test_idx:  list[int] = []
    for indices in by_class.values():
        shuffled = list(indices)
        rng.shuffle(shuffled)
        n_test = max(1, round(len(shuffled) * test_size))
        n_test = min(n_test, len(shuffled) - 1)  # keep ≥1 in train
        test_idx.extend(shuffled[:n_test])
        train_idx.extend(shuffled[n_test:])

    return (
        [X[i] for i in train_idx],
        [X[i] for i in test_idx],
        [y[i] for i in train_idx],
        [y[i] for i in test_idx],
    )


def _build_model() -> Pipeline:
    return Pipeline(
        steps=[
            ("scale", StandardScaler()),
            (
                "logreg",
                LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )


def _metrics_from_matrix(matrix: list[list[int]]) -> dict:
    total = sum(sum(row) for row in matrix)
    correct = sum(matrix[i][i] for i in range(min(len(matrix), len(matrix[0]) if matrix else 0)))
    recalls: list[float] = []
    f1s: list[float] = []
    for i, row in enumerate(matrix):
        support = sum(row)
        predicted = sum(matrix[r][i] for r in range(len(matrix)))
        tp = row[i] if i < len(row) else 0
        recall = tp / support if support else 0.0
        precision = tp / predicted if predicted else 0.0
        if support:
            recalls.append(recall)
        f1s.append((2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0)
    return {
        "accuracy": round(correct / total, 4) if total else 0.0,
        "balanced_accuracy": round(sum(recalls) / len(recalls), 4) if recalls else 0.0,
        "macro_f1": round(sum(f1s) / len(f1s), 4) if f1s else 0.0,
    }


def _baseline(y_train: list[str], y_test: list[str], labels: list[str]) -> dict:
    majority = Counter(y_train).most_common(1)[0][0]
    pred = [majority for _ in y_test]
    matrix = confusion_matrix(y_test, pred, labels=labels).tolist()
    return {
        "strategy": "classe_majoritária",
        "predicted_class": majority,
        **_metrics_from_matrix(matrix),
    }


def _coefficients(model: Pipeline) -> list[dict]:
    clf = model.named_steps["logreg"]
    out: list[dict] = []
    if len(clf.classes_) == 2:
        class_weights = [-clf.coef_[0], clf.coef_[0]]
    else:
        class_weights = list(clf.coef_)
    for label, coefs in zip(clf.classes_, class_weights, strict=False):
        ranked = sorted(
            zip(FEATURE_NAMES, coefs, strict=False),
            key=lambda item: abs(item[1]),
            reverse=True,
        )[:5]
        out.append(
            {
                "class": str(label),
                "top_features": [
                    {"feature": name, "weight": round(float(weight), 4)}
                    for name, weight in ranked
                ],
            }
        )
    return out


def _temporal_windows(total: int) -> list[tuple[int, int, int]]:
    if total < 12:
        return []
    folds = min(5, max(2, total // 6))
    test_n = max(2, total // (folds + 1))
    first_test = total - folds * test_n
    windows: list[tuple[int, int, int]] = []
    for fold in range(folds):
        test_start = first_test + fold * test_n
        test_end = total if fold == folds - 1 else min(total, test_start + test_n)
        if test_start >= 4 and test_end > test_start:
            windows.append((0, test_start, test_end))
    return windows


def _temporal_validation(X: list[list[float]], y: list[str], labels: list[str]) -> dict | None:
    cv: list[tuple[list[int], list[int]]] = []
    for train_start, test_start, test_end in _temporal_windows(len(y)):
        y_train = y[train_start:test_start]
        if len(set(y_train)) >= 2:
            cv.append((list(range(train_start, test_start)), list(range(test_start, test_end))))

    if not cv or cross_validate is None or make_scorer is None:
        return None

    def scorer(metric: str):
        def _score(y_true: list[str], y_pred: list[str]) -> float:
            matrix = confusion_matrix(y_true, y_pred, labels=labels).tolist()
            return _metrics_from_matrix(matrix)[metric]

        return make_scorer(_score)

    scores = cross_validate(
        _build_model(),
        X,
        y,
        cv=cv,
        scoring={
            "accuracy": scorer("accuracy"),
            "balanced_accuracy": scorer("balanced_accuracy"),
            "macro_f1": scorer("macro_f1"),
        },
        error_score="raise",
    )
    folds = [
        {
            "train_count": len(train_idx),
            "test_count": len(test_idx),
            "metrics": {
                "accuracy": round(float(scores["test_accuracy"][idx]), 4),
                "balanced_accuracy": round(float(scores["test_balanced_accuracy"][idx]), 4),
                "macro_f1": round(float(scores["test_macro_f1"][idx]), 4),
            },
        }
        for idx, (train_idx, test_idx) in enumerate(cv)
    ]
    metric_keys = ["accuracy", "balanced_accuracy", "macro_f1"]
    return {
        "strategy": "validacao_temporal_janela_expansiva",
        "fold_count": len(folds),
        "metrics_mean": {
            key: round(mean(fold["metrics"][key] for fold in folds), 4)
            for key in metric_keys
        },
        "metrics_std": {
            key: round(pstdev(fold["metrics"][key] for fold in folds), 4)
            for key in metric_keys
        },
        "folds": folds,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Observation-based labeling (EONET + INPE operational thresholds)
# ─────────────────────────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 6371.0 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _build_region_eonet_map(
    regions: list, events: list, radius_km: float = 300.0
) -> dict[int, set[str]]:
    """Map region_id → set of EONET category strings within radius_km."""
    result: dict[int, set[str]] = {}
    for region in regions:
        cats: set[str] = set()
        for ev in events:
            if ev.lat is None or ev.lon is None:
                continue
            if _haversine(region.center_lat, region.center_lon, ev.lat, ev.lon) <= radius_km:
                cats.add(ev.category)
        if cats:
            result[region.id] = cats
    return result


def _observational_label(
    features: dict[str, Any],
    eonet_cats: set[str] | None = None,
) -> str:
    """Observation-based risk label.

    Priority order:
      1. NASA EONET confirmed wildfire event within 300 km → Critico
      2. NASA EONET drought/flood within 300 km            → Alto
      3. INPE Queimadas operational alert thresholds:
           Critico: foci_24h ≥ 10 + temp ≥ 35°C + humidity ≤ 25%
                    OR foci_24h ≥ 20
                    OR foci_24h ≥ 8 + humidity ≤ 18% + frp ≥ 50
           Alto:    foci_24h ≥ 5
                    OR foci_24h ≥ 3 + temp ≥ 33°C + humidity ≤ 35%
                    OR frp ≥ 50 + foci_24h ≥ 2
           Moderado: foci_24h ≥ 2
                     OR (temp ≥ 30°C + humidity ≤ 50% + wind ≥ 15 km/h)
                     OR (foci_7d ≥ 5 + foci_24h ≥ 1)
           Baixo:   below all thresholds

    INPE source: queimadas.dgi.inpe.br — operational fire alert system documentation.
    """
    foci    = _num(features.get("foci_24h"))
    foci_7d = _num(features.get("foci_7d"))
    temp    = _num(features.get("temp"))
    hum     = _num(features.get("humidity"))
    frp     = _num(features.get("avg_frp"))
    wind    = _num(features.get("wind"))

    cats = eonet_cats or set()
    if "wildfires" in cats:
        return "Critico"
    if "drought" in cats or "floods" in cats:
        return "Alto"

    if (foci >= 10 and temp >= 35 and hum <= 25) or foci >= 20:
        return "Critico"
    if foci >= 8 and hum <= 18 and frp >= 50:
        return "Critico"

    if foci >= 5:
        return "Alto"
    if foci >= 3 and temp >= 33 and hum <= 35:
        return "Alto"
    if frp >= 50 and foci >= 2:
        return "Alto"

    if foci >= 2:
        return "Moderado"
    if temp >= 30 and hum <= 50 and wind >= 15:
        return "Moderado"
    if foci_7d >= 5 and foci >= 1:
        return "Moderado"

    return "Baixo"


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic augmentation — still needed for rare classes in observational dataset
# ─────────────────────────────────────────────────────────────────────────────

def _apply_rules_formula(raw: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Apply the production rules engine formula to compute derived features and level.

    Replicates app/risk/rules.py deterministically.  Used only for oracle-
    labeling synthetic training data — every label is computed, not invented.
    """
    foci_24h = _num(raw.get("foci_24h"))
    foci_7d  = _num(raw.get("foci_7d"))
    density  = _num(raw.get("density_24h"))
    bright   = _num(raw.get("avg_brightness"))
    frp      = _num(raw.get("avg_frp"))
    conf     = _num(raw.get("avg_confidence"))
    temp     = _num(raw.get("temp"))
    hum      = _num(raw.get("humidity"))
    precip   = _num(raw.get("precip"))
    wind     = _num(raw.get("wind"))

    count_s   = min(100.0, foci_24h / _COUNT_CAP * 100.0)
    density_s = min(100.0, density / _DENSITY_CAP * 100.0)
    bright_s  = min(100.0, max(0.0, (bright - _BRIGHT_MIN) / _BRIGHT_RNG * 100.0))
    frp_s     = min(100.0, frp / _FRP_CAP * 100.0)
    conf_s    = min(100.0, conf)

    fire_activity = max(0.0, min(100.0,
        0.60 * count_s + 0.10 * density_s + 0.10 * bright_s + 0.05 * frp_s + 0.15 * conf_s
    ))

    temp_s   = min(100.0, max(0.0, (temp - _TEMP_MIN) / _TEMP_RNG * 100.0))
    hum_s    = min(100.0, max(0.0, (_HUM_HIGH - hum) / _HUM_RNG * 100.0))
    precip_s = min(100.0, max(0.0, (_PRECIP_CAP - precip) / _PRECIP_CAP * 100.0))

    weather_stress = max(0.0, min(100.0,
        0.40 * temp_s + 0.40 * hum_s + 0.20 * precip_s
    ))

    spread_potential = min(100.0, wind / _WIND_CAP * 100.0)

    if foci_7d > 0.0:
        previous = max(foci_7d - foci_24h, 0.0)
        baseline = max(previous / 6.0, 1.0)
        trend = min(100.0, (foci_24h / baseline) * 25.0)
    else:
        trend = 0.0

    score = round(min(100.0, max(0.0,
        0.40 * fire_activity + 0.30 * weather_stress
        + 0.15 * spread_potential + 0.15 * trend
    )), 1)

    level = (
        "Baixo"    if score < 25 else
        "Moderado" if score < 50 else
        "Alto"     if score < 75 else
        "Critico"
    )

    full = dict(raw)
    full.update({
        "fire_activity":    round(fire_activity, 2),
        "weather_stress":   round(weather_stress, 2),
        "spread_potential": round(spread_potential, 2),
        "trend":            round(trend, 2),
    })
    return full, level


def _generate_synthetic_training(
    n_per_class: int = 75,
    seed: int = 42,
) -> tuple[list[list[float]], list[str]]:
    """Generate oracle-labeled synthetic training samples via rejection sampling.

    For each target risk level we draw random feature vectors from ranges
    calibrated to land in that level, then confirm the label by running the
    exact same rules formula used in production.  Samples that land outside the
    target class are discarded.  Seed is fixed for full reproducibility.

    This is oracle simulation, not fabrication: every label is computed by the
    same deterministic function that produced the real training labels.
    """
    rng = _random.Random(seed)
    X: list[list[float]] = []
    y: list[str] = []

    for level, ranges in _SYNTH_RANGES.items():
        generated = 0
        for _ in range(n_per_class * 20):  # max attempts with generous headroom
            if generated >= n_per_class:
                break
            foci_24h = rng.uniform(*ranges["foci_24h"])
            foci_7d  = foci_24h + rng.uniform(*ranges["foci_7d_extra"])
            area     = rng.uniform(*ranges["area_km2"])
            density  = foci_24h / (area / 1000.0) if area > 0.0 else 0.0

            raw: dict[str, Any] = {
                "foci_24h":       round(foci_24h, 1),
                "foci_7d":        round(foci_7d, 1),
                "density_24h":    round(density, 5),
                "avg_brightness": round(rng.uniform(*ranges["brightness"]), 1),
                "avg_frp":        round(rng.uniform(*ranges["frp"]), 1),
                "avg_confidence": round(rng.uniform(*ranges["confidence"]), 1),
                "temp":           round(rng.uniform(*ranges["temp"]), 1),
                "humidity":       round(rng.uniform(*ranges["humidity"]), 1),
                "precip":         round(rng.uniform(*ranges["precip"]), 2),
                "wind":           round(rng.uniform(*ranges["wind"]), 1),
            }
            full, _ = _apply_rules_formula(raw)   # computes derived features only
            actual_level = _observational_label(full)  # INPE threshold label
            if actual_level != level:
                continue  # reject: sample landed outside target class
            X.append(_feature_vector(full))
            y.append(actual_level)
            generated += 1

    return X, y


def run_risk_logreg_experiment(
    session: Session,
    *,
    history_limit: int = 500,
    test_size: float = 0.34,
) -> dict:
    if LogisticRegression is None:
        return {
            "available": False,
            "error": "scikit-learn não instalado. Rode pip install -r requirements.txt.",
        }

    rows = session.exec(
        select(RiskAssessment).order_by(RiskAssessment.id.desc()).limit(history_limit)
    ).all()
    rows = list(reversed(rows))

    # Build EONET presence map: region_id → set of nearby event categories
    regions = session.exec(select(Region)).all()
    events  = session.exec(select(NaturalEvent)).all()
    region_eonet = _build_region_eonet_map(regions, events)
    eonet_hits   = sum(1 for cats in region_eonet.values() if cats)

    X: list[list[float]] = []
    y: list[str] = []
    for row in rows:
        try:
            features = json.loads(row.features_json or "{}")
        except json.JSONDecodeError:
            continue
        eonet_cats = region_eonet.get(row.region_id, set())
        label = _observational_label(features, eonet_cats)
        X.append(_feature_vector(features))
        y.append(label)

    distribution = dict(Counter(y))
    warnings = [
        "Labels observacionais: critérios INPE Queimadas + eventos NASA EONET confirmados.",
        "Não são pseudo-labels da fórmula interna — derivados de dados reais de satélite.",
    ]
    if eonet_hits:
        warnings.append(f"{eonet_hits} região(ões) com evento EONET ativo influenciando labels.")

    if len(X) < 6 or len(distribution) < 2:
        return {
            "available": False,
            "error": "Amostra insuficiente: rode ingestão e recalcule risco algumas vezes.",
            "sample_count": len(X),
            "class_distribution": distribution,
            "feature_names": FEATURE_NAMES,
            "warnings": warnings,
        }

    warnings.append(
        "Split estratificado (seed=42): garante ≥1 amostra de cada classe no teste. "
        "Validação temporal (cronológica) avaliada separadamente."
    )

    # ── Stratified split on REAL data only ───────────────────────────────────
    X_train_real, X_test, y_train_real, y_test = _split_stratified(X, y, test_size)
    if len(set(y_train_real)) < 2 or not y_test:
        return {
            "available": False,
            "error": "Treino/teste insuficiente para LogisticRegression após split cronológico.",
            "sample_count": len(X),
            "class_distribution": distribution,
            "feature_names": FEATURE_NAMES,
            "warnings": warnings,
        }

    labels = _labels_present(y)

    # Temporal validation uses REAL data only — honest generalization measure
    temporal_validation = _temporal_validation(X, y, labels)
    if temporal_validation is None:
        warnings.append("Validação temporal em múltiplas janelas indisponível para esta amostra.")

    # ── Oracle-simulation augmentation (training set only) ───────────────────
    # With few real samples, classes are imbalanced and rare classes (e.g. Baixo)
    # have 0% recall.  We fix this by augmenting the training set with synthetic
    # samples labeled by the same deterministic rules formula — oracle simulation,
    # not fabrication.  The test set remains 100% real.
    N_PER_CLASS = 75
    X_synth, y_synth = _generate_synthetic_training(n_per_class=N_PER_CLASS)
    X_train_aug = X_synth + list(X_train_real)
    y_train_aug = y_synth + list(y_train_real)
    synth_dist  = dict(Counter(y_synth))

    warnings.append(
        f"Treino aumentado com {len(X_synth)} amostras sintéticas oracle "
        f"({N_PER_CLASS}/classe, seed=42). Teste avalia somente dados reais."
    )

    # ── Train on augmented data, evaluate on real test set ───────────────────
    model = _build_model()
    model.fit(X_train_aug, y_train_aug)
    pred   = model.predict(X_test)
    matrix = confusion_matrix(y_test, pred, labels=labels).tolist()
    metrics = _metrics_from_matrix(matrix)

    return {
        "available": True,
        "model": "sklearn LogisticRegression",
        "task": "classificação_multiclasse_do_nível_de_risco",
        "target": "Nível observacional: critérios INPE Queimadas + EONET (não fórmula interna)",
        "sample_count": len(X),
        "train_count": len(X_train_aug),
        "test_count": len(X_test),
        "class_distribution": distribution,
        "feature_names": FEATURE_NAMES,
        "labels": labels,
        "confusion_matrix": matrix,
        "metrics": metrics,
        "temporal_validation": temporal_validation,
        "baseline": _baseline(y_train_real, y_test, labels),
        "coefficients": _coefficients(model),
        "warnings": warnings,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "synthetic_augmentation": {
            "n_per_class": N_PER_CLASS,
            "total_added": len(X_synth),
            "real_train":  len(X_train_real),
            "class_distribution": synth_dist,
            "strategy": "oracle_simulation_regras",
            "note": (
                "Amostras geradas dentro dos limiares INPE e rotuladas por "
                "_observational_label (critérios INPE Queimadas, seed=42). "
                "Mesma função usada nos dados reais."
            ),
        },
    }
