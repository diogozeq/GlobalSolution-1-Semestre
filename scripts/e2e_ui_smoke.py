"""OrbitGuard UI smoke test using local Chrome headless."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


ROUTES: dict[str, list[str]] = {
    "missoes": ["OrbitGuard", "Matriz de Risco", "Feed de Detecções"],
    "laudo": ["Laudos Técnicos", "Laudo Técnico"],
    "chat": ["Chat RAG", "Pergunte sobre riscos"],
    "telemetria": ["Telemetria", "Fontes de fogo"],
    "ativos": ["Ativos monitorados", "Regiões"],
    "risco": ["Modelos de risco", "Scores explicáveis"],
    "ml": ["ML experimental", "Matriz de confusão"],
    "historico": ["Histórico", "Execuções"],
    "saude": ["Saúde do sistema", "API"],
    "config": ["Configurações", "Chaves"],
}

BAD_LIGATURES = [
    "psychology",
    "description",
    "material-symbols-outlined",
    "local_fire_department",
    "satellite_alt",
    "monitoring",
    "assignment",
]


def chrome_path() -> str | None:
    candidates = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]
    for path in candidates:
        if Path(path).exists():
            return path
    return shutil.which("chrome") or shutil.which("msedge")


def dump_dom(chrome: str, url: str, user_data_dir: str) -> str:
    proc = subprocess.run(
        [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--virtual-time-budget=12000",
            f"--user-data-dir={user_data_dir}",
            "--window-size=1440,1100",
            "--dump-dom",
            url,
        ],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=45,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"Chrome failed with {proc.returncode}")
    return proc.stdout


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:5173")
    args = parser.parse_args()
    base = args.base.rstrip("/")
    chrome = chrome_path()
    if not chrome:
        print(json.dumps({"ok": False, "error": "Chrome/Edge não encontrado"}, ensure_ascii=False, indent=2))
        return 1

    results = []
    with tempfile.TemporaryDirectory(prefix="orbitguard-ui-") as user_data_dir:
        for route, expected in ROUTES.items():
            dom = dump_dom(chrome, f"{base}/#{route}", user_data_dir)
            missing = [text for text in expected if text not in dom]
            leaked = [text for text in BAD_LIGATURES if text in dom]
            results.append(
                {
                    "route": route,
                    "ok": not missing and not leaked,
                    "missing": missing,
                    "leaked": leaked,
                }
            )

    failed = [r for r in results if not r["ok"]]
    print(json.dumps({"ok": not failed, "failed": failed, "routes": results}, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
