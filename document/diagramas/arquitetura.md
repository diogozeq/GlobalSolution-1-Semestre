# Diagrama de Arquitetura — OrbitGuard AI

## Visão geral (Mermaid)

```mermaid
flowchart TD
  FIRMS[NASA FIRMS] --> ADP
  OM[Open-Meteo] --> ADP
  EONET[NASA EONET] --> ADP
  POWER[NASA POWER] --> ADP
  INPE[INPE Queimadas] --> ADP
  ADP[Adapters de ingestão\ntimeout · retry · fixture] --> DB[(SQLite + histórico)]
  DB --> RISK[Risk Engine\nscore 0-100 explicável]
  RISK --> ALERT[Alertas Alto/Crítico]
  ALERT --> LLM[IA Generativa\nlaudo estruturado]
  DB --> RAG[RAG Index\nChromaDB / TF-IDF]
  RAG --> AGENT[Agente + tools]
  RISK --> API[FastAPI]
  ALERT --> API
  LLM --> API
  AGENT --> API
  API --> UI[React Dashboard\nMapa · Matriz · Alertas · Laudo · Chat]
```

## Fluxo de ingestão até alerta (ASCII)

```
[APIs externas] --(httpx timeout/retry)--> [Adapter] --falha?--> [Fixture local]
        |                                       |
        +------------------> [IngestRun status] |
                                                v
                                        [SQLite: FireFocus / WeatherReading / NaturalEvent]
                                                v
                              [features.py] -> [engine.py: score 0-100 -> nível]
                                                v
                                 [RiskAssessment] --Alto/Crítico--> [Alert (dedup)]
                                                v
                            [reports.py: laudo IA/regras]   [agent.py: chat RAG + tools]
                                                v
                                          [FastAPI] -> [Dashboard React]
```

## Motor de risco

```
fire_activity  = 0,60·focos_24h + 0,10·densidade + 0,15·brilho + 0,15·confiança
weather_stress = 0,40·temperatura + 0,40·(baixa_umidade) + 0,20·(pouca_chuva)
spread         = vento
trend          = focos_24h / focos_7d

score = 0,40·fire_activity + 0,30·weather_stress + 0,15·spread + 0,15·trend
níveis: 0-24 Baixo · 25-49 Moderado · 50-74 Alto · 75-100 Crítico
```
