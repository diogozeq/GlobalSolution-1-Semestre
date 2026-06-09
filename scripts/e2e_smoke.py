"""OrbitGuard E2E smoke test against a running backend."""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from typing import Any


def request(base: str, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    data = None
    headers: dict[str, str] = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=120) as resp:
        text = resp.read().decode("utf-8")
        return json.loads(text) if text else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8077")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    checks: list[tuple[str, bool, str]] = []

    try:
        health = request(base, "GET", "/health")
        checks.append(("health", health["status"] == "ok", json.dumps(health, ensure_ascii=False)))

        ingest = request(base, "POST", "/ingest/run?use_fixture=true&sources=firms,weather,eonet,inpe")
        checks.append(("ingest_fixture", len(ingest["runs"]) >= 1, f"runs={len(ingest['runs'])}"))

        risk_recalc = request(base, "POST", "/risk/recalculate")
        checks.append(("risk_recalc", len(risk_recalc["assessed"]) >= 1, f"assessed={len(risk_recalc['assessed'])}"))

        regions = request(base, "GET", "/regions")
        fires = request(base, "GET", "/fires?limit=20")
        risk = request(base, "GET", "/risk")
        events = request(base, "GET", "/events")
        weather = request(base, "GET", "/weather")
        alerts = request(base, "GET", "/alerts")
        checks.extend(
            [
                ("regions", len(regions) >= 1, f"count={len(regions)}"),
                ("fires", len(fires) >= 1, f"sample={len(fires)}"),
                ("risk", len(risk) >= 1, f"count={len(risk)}"),
                ("events", isinstance(events, list), f"count={len(events)}"),
                ("weather", len(weather) >= 1, f"count={len(weather)}"),
                ("alerts", isinstance(alerts, list), f"count={len(alerts)}"),
            ]
        )

        report = request(base, "POST", "/report/1")
        checks.append(("report", bool(report["available"] and report["report"]), f"model={report.get('model')}"))

        chat = request(base, "POST", "/chat", {"question": "teste e2e risco amazonia legal", "region_id": 1})
        checks.append(("chat", bool(chat["answer"] and chat["used_tools"]), f"available={chat['available']} tools={chat['used_tools']}"))

        ml = request(base, "POST", "/ml/risk-logreg")
        checks.append(("ml", bool(ml["available"] and ml.get("confusion_matrix")), f"samples={ml.get('sample_count')}"))

        sensor = request(
            base,
            "POST",
            "/sensor/readings",
            {"region_id": 1, "device_id": "e2e", "temperature": 31, "humidity": 48, "smoke": 12, "soil_moisture": 25},
        )
        latest = request(base, "GET", "/sensor/latest?region_id=1")
        checks.append(("sensor", latest and latest["device_id"] == sensor["device_id"], f"latest={latest.get('device_id') if latest else None}"))
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, TypeError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1

    failed = [name for name, ok, _detail in checks if not ok]
    print(json.dumps(
        {
            "ok": not failed,
            "failed": failed,
            "checks": [{"name": name, "ok": ok, "detail": detail} for name, ok, detail in checks],
        },
        ensure_ascii=False,
        indent=2,
    ))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
