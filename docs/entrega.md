# OrbitGuard AI — Entrega Global Solution 2026.1

**Diogo Zequini Viso — RM 565535**
2TIAO — FIAP

---

**QUERO CONCORRER**

---

## Introdução

Dados orbitais da NASA e do INPE registram focos de calor em tempo real. O problema não é falta de dado — é falta de inteligência para transformar dado bruto em decisão acionável.

**OrbitGuard AI** é uma plataforma de apoio à prevenção de desastres climáticos que conecta cinco fontes públicas de satélite, calcula risco por região, gera laudos técnicos via IA Generativa e disponibiliza um agente conversacional com RAG. É uma POC acadêmica — não substitui Defesa Civil, INPE ou Corpo de Bombeiros.

---

## Desenvolvimento

### Arquitetura

```
[NASA FIRMS] ─┐
[INPE Queimadas] ─┤
[Open-Meteo] ─┤──► [Adapters: timeout·retry·fixture] ──► [SQLite]
[NASA EONET] ─┤                                              │
[NASA POWER] ─┘                                   ┌──────────┴──────────┐
                                            [Risk Engine]          [RAG Index]
                                            score 0–100         ChromaDB/TF-IDF
                                                  │                    │
                                           [Alertas Auto]       [Agente + tools]
                                                  │                    │
                                         [IA Generativa]               │
                                           laudo estruturado            │
                                                  └──────────┬──────────┘
                                                        [FastAPI]
                                                            │
                                              [React Dashboard — 12 páginas]
```

### Fontes de dados

| Fonte | O que fornece | Chave |
|---|---|---|
| NASA FIRMS | Focos de calor MODIS/VIIRS em tempo real | FIRMS_MAP_KEY |
| INPE Queimadas | CSV diário oficial do Brasil | Pública |
| Open-Meteo | Temperatura, umidade, vento, precipitação | Pública |
| NASA EONET | Eventos naturais ativos (incêndios, secas, inundações) | Pública |
| NASA POWER | Meteorologia histórica diária | Pública |

Todos os adapters têm timeout configurável, retry automático e fallback para fixture local se a API cair.

### Motor de risco explicável

Score 0–100 decomposto em quatro componentes auditáveis:

```
fire_activity  = 0,60·focos_24h + 0,10·densidade + 0,15·brilho + 0,15·frp
weather_stress = 0,40·temperatura + 0,40·(1 − umidade) + 0,20·(1 − precipitação)
spread         = vento / cap
trend          = focos_24h / (média_diária_7d)

score = 0,40·fire_activity + 0,30·weather_stress + 0,15·spread + 0,15·trend

Níveis: 0–24 Baixo · 25–49 Moderado · 50–74 Alto · 75–100 Crítico
```

Trecho principal (`src/backend/app/risk/engine.py`):

```python
def score_region(features: dict) -> dict:
    fa, fa_parts = _fire_activity(features)
    ws, ws_parts = _weather_stress(features)
    spread = _spread(features)
    trend  = _trend(features)
    w = rules.top_weights()
    score = w["fire"] * fa + w["weather"] * ws + w["spread"] * spread + w["trend"] * trend
    return {
        "score": round(rules.clamp(score), 1),
        "level": rules.classify(score),
        "components": {
            "fire_activity":   round(fa, 1),
            "weather_stress":  round(ws, 1),
            "spread_potential": round(spread, 1),
            "trend":           round(trend, 1),
        },
    }
```

### IA Generativa — Laudos

Quando uma região atinge Alto ou Crítico, o sistema gera um laudo técnico estruturado via OpenRouter:

- Resumo executivo
- Evidências com dados brutos de satélite
- Ações recomendadas
- Limitações do modelo

Cascade de modelos com fallback determinístico (`src/backend/app/llm/router.py`):

```python
async def chat_completion(messages, models=None, **kwargs):
    for model in (models or settings.llm_report_models):
        try:
            return await _call_openrouter(model, messages, **kwargs)
        except LLMUnavailable:
            continue
    raise LLMUnavailable("todos os modelos falharam")
```

### RAG — Agente Conversacional

Agente com três tools em tempo real integradas ao banco de dados:

- `get_risk(region)` — score e nível atual
- `get_fires(region)` — focos das últimas 24h
- `get_weather(region)` — leitura climática atual

Base de conhecimento: ChromaDB + sentence-transformers. Fallback automático para TF-IDF puro Python se ChromaDB não estiver disponível. Respostas sempre citam a fonte no formato `[S1]`, `[S2]`.

```python
# src/backend/app/rag/agent.py — fluxo principal
async def answer(session, question, region_id=None):
    region = detect_region(session, question) or get_region(session, region_id)
    context = []
    if region:
        context += [get_risk(session, region), get_fires(session, region),
                    get_weather(session, region)]
    docs = retrieve(question, k=4)
    prompt = build_prompt(question, context, docs)
    return await chat_completion(prompt, models=settings.llm_agent_models)
```

### Machine Learning Experimental

Classificador LogisticRegression com 14 features de satélite. Diferencial: labels **observacionais reais** — critérios operacionais do INPE Queimadas + eventos confirmados NASA EONET (não pseudo-labels das regras internas).

Dataset pequeno (n=18) resolvido com augmentação oracle: geração de amostras sintéticas dentro dos limiares INPE, com rejection sampling via `_observational_label()`.

```python
# src/backend/app/ml/experimental.py
def _observational_label(features, eonet_cats=None):
    if eonet_cats and "wildfires" in eonet_cats:
        return "Critico"
    foci = features.get("foci_24h", 0)
    temp = features.get("temp", 25)
    hum  = features.get("humidity", 60)
    frp  = features.get("avg_frp", 0)
    if foci >= 10 and temp >= 35 and hum <= 25: return "Critico"
    if foci >= 20:                               return "Critico"
    if foci >= 8  and hum <= 18 and frp >= 50:  return "Critico"
    if foci >= 5:                                return "Alto"
    if foci >= 3  and temp >= 33 and hum <= 35: return "Alto"
    if foci >= 2:                                return "Moderado"
    return "Baixo"
```

Split estratificado com seed=42 garante todas as classes no conjunto de teste. Métricas reportadas: acurácia, acurácia balanceada e F1 macro.

### IoT — Sensor de Solo

ESP32 simulado via Wokwi envia temperatura, umidade, fumaça e umidade do solo por região. Os dados cruzam com os dados orbitais do satélite na página de Sensores.

```python
# POST /sensor/readings
class SensorReadingCreate(BaseModel):
    region_id: int
    device_id: str
    temperature: float
    humidity: float
    smoke: float
    soil_moisture: float
```

### Dashboard (12 páginas)

| # | Página | O que faz |
|---|---|---|
| 1 | Missões | Mapa Leaflet com focos, regiões, eventos + painel de alertas ao vivo |
| 2 | Laudos IA | Geração de laudos técnicos por região via IA Generativa |
| 3 | Chat RAG | Agente conversacional com tools em tempo real |
| 4 | Telemetria | Status operacional das 5 fontes de dados |
| 5 | Ativos | Cadastro de regiões com link para imagem orbital Sentinel |
| 6 | Risco | Scores por região com decomposição visual e sparkline histórico |
| 7 | ML Experimental | Treino ao vivo do classificador com métricas e matriz de confusão |
| 8 | Histórico | Log completo de todas as ingestões |
| 9 | Sensores IoT | Leituras ESP32 em tempo real por região |
| 10 | Saúde | Status de cada componente (DB, LLM, RAG, embeddings) |
| 11 | Configurações | Variáveis de ambiente e pesos do motor de risco |
| 12 | Dados | Explorer dos dados brutos no banco |

---

## Resultados Esperados

- Score de risco calculado para 6 regiões brasileiras (Amazônia, Cerrado, Pantanal, Mata Atlântica, Caatinga, Pampa) a cada ingestão
- Laudo técnico gerado em segundos para qualquer região em nível Alto ou Crítico
- Agente RAG respondendo perguntas em linguagem natural com citação de fonte
- Classificador ML treinado e avaliado ao vivo no browser
- Sensor IoT simulado cruzando dados de solo com dados orbitais

---

## Conclusões

### Disciplinas integradas

| Disciplina | Aplicação no projeto |
|---|---|
| IA Generativa | Laudos técnicos via OpenRouter, agente RAG |
| Machine Learning | LogisticRegression com labels observacionais, augmentação oracle |
| Análise de Dados | Motor de risco explicável, decomposição de score |
| Automação / APIs | 5 adapters com retry, fallback, integração em pipeline |
| IoT / ESP32 | Sensor de solo simulado via Wokwi |
| Edge Computing | Fallback local (fixture + TF-IDF) sem dependência de nuvem |
| Dashboard | React + Vite + TypeScript + Leaflet, 12 páginas |
| Aplicações Distribuídas | FastAPI + SQLite + ChromaDB + React, arquitetura desacoplada |

### Limitações da POC

- Dataset ML pequeno (n=18 reais + augmentação synthetic)
- Regiões fixas — sem cadastro dinâmico
- Sem imagens Sentinel/NDVI diretas (link externo via Copernicus)

### Evoluções futuras

- Integração direta com imagens Sentinel (visão computacional / NDVI)
- ML com dataset histórico real do INPE
- ESP32 físico substituindo simulação Wokwi
- Expansão para múltiplos países / risco hídrico

---

## Links

- **Repositório:** https://github.com/diogozeq/GlobalSolution-1-Semestre
- **Vídeo demonstrativo:** https://youtu.be/L1mKh8KA1oQ
