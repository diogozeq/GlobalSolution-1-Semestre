# OrbitGuard AI — Backend (FastAPI)

API de ingestão de dados orbitais/climáticos, motor de risco explicável, laudos por IA Generativa e agente RAG.

## Rodar

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# opcional (RAG semântico): -r requirements-optional.txt
copy .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Docs interativas: http://localhost:8000/docs · Testes: `python -m pytest -q` (26 testes)

## Estrutura

```
app/
├─ core/        config (.env) + http client (timeout/retry)
├─ db/          engine SQLite, init_db, seed de regiões
├─ models/      8 tabelas SQLModel
├─ ingestion/   adapters: firms, weather, eonet, power, inpe (+ service orquestrador)
├─ risk/        features → rules → engine (score 0-100 explicável)
├─ llm/         router OpenRouter (fallback) + schemas + reports
├─ rag/         index (Chroma/TF-IDF) + retriever + fallback + agent
├─ api/         routers REST
├─ fixtures/    dados de demo offline
└─ knowledge_base/  7 docs markdown para RAG
```

## Notas

- Modo padrão usa APIs reais. Fixtures só entram com `POST /ingest/run?use_fixture=true`.
- INPE, Open-Meteo, EONET e NASA POWER funcionam sem chave; FIRMS precisa de `FIRMS_MAP_KEY`.
- Sem `OPENROUTER_API_KEY`, laudos e chat usam **fallback determinístico** (regras + RAG).
- Sem `chromadb`, o RAG usa **TF-IDF puro-Python** automaticamente.
- `LLM_REPORT_MODELS` e `LLM_AGENT_MODELS` aceitam IDs exatos e aliases `~...latest` do OpenRouter.
