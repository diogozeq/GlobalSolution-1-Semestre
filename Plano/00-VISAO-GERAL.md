# OrbitGuard AI - Visao Geral do Projeto

> POC da Global Solution 2026.1 FIAP: plataforma inteligente de apoio a prevencao de desastres climaticos usando dados orbitais, APIs, automacao, IA Generativa, RAG e dashboard geoespacial.

---

## 1. Posicionamento

**Pergunta da GS:** como tecnologias avancadas de IA, automacao e computacao podem impulsionar solucoes inovadoras para a nova economia espacial?

**Resposta do OrbitGuard AI:** transformar dados de satelites e fontes climaticas abertas em uma central local de monitoramento, analise e explicacao de risco. O sistema coleta dados reais, calcula risco por regiao, mostra o resultado em mapa, gera laudos com IA Generativa e permite perguntas via agente RAG com fontes citadas.

Para reduzir risco de entrega, a POC tera foco operacional em **risco de queimadas no Brasil**, com arquitetura preparada para outros eventos como tempestades, enchentes, seca e eventos naturais globais. Queimada e melhor para MVP porque NASA FIRMS e INPE oferecem dados abertos, recentes e demonstraveis.

---

## 2. Mapeamento dos temas escolhidos

| Tema da GS | Como o OrbitGuard AI atende |
|---|---|
| IA Generativa para exploracao espacial e analise de dados orbitais | LLM gera laudo estruturado a partir de focos de fogo, clima, tendencia e fontes |
| Plataformas inteligentes para monitoramento climatico e prevencao de desastres | Motor de risco classifica regioes em Baixo, Moderado, Alto e Critico |
| Plataformas com RAG e agentes inteligentes usando bases espaciais | ChromaDB + agente consultam base NASA, INPE, ESA/Copernicus e docs do projeto |
| Dashboards inteligentes para analise de dados espaciais | React + mapa Leaflet + graficos + matriz de risco + painel de alertas |
| Automacao web, scraping e integracao de APIs | Conectores para FIRMS, EONET, Open-Meteo/NASA POWER, INPE e scraping opcional |

---

## 3. Escopo recomendado

### MVP obrigatorio

- Coletar dados reais de pelo menos 2 fontes externas.
- Salvar dados em SQLite com historico de execucoes.
- Exibir mapa com focos reais e regioes monitoradas.
- Calcular risco explicavel por regiao.
- Gerar alerta e laudo por IA para regioes em Alto/Critico.
- Responder perguntas com RAG e fontes.
- Ter README, PDF unico e video de ate 5 minutos.

### Extras de podio

- INPE como fonte brasileira de validacao dos focos.
- EONET para eventos naturais globais no mapa.
- Copernicus/Sentinel como visual ou indice NDVI/NDWI opcional.
- ESP32/Wokwi simulando sensor de solo.
- App mobile React Native para receber alertas.

### Fora do MVP

- Predicao oficial de desastre. O app deve se apresentar como apoio a decisao, nao sistema oficial de emergencia.
- Pipeline pesado de imagens Sentinel. Pode virar extra, mas nao deve bloquear demo.
- N2YO como requisito. Posicao de satelite e interessante visualmente, mas nao aumenta muito a nota se nao afetar decisao.
- ML treinado sem dados rotulados confiaveis. Primeiro usar regras explicaveis; ML entra como comparativo se houver tempo.

---

## 4. Arquitetura

```text
Fontes externas
  |-- NASA FIRMS: focos de fogo
  |-- Open-Meteo ou NASA POWER: clima
  |-- NASA EONET: eventos naturais
  |-- INPE Queimadas: validacao Brasil
  |-- Copernicus/Sentinel: opcional
          |
          v
FastAPI ingestion adapters
          |
          v
SQLite + cache local + fixtures de demo
          |
          +--> Risk Engine --> Alerts --> LLM Reports
          |
          +--> RAG Index --> Chat Agent
          |
          v
React Dashboard: mapa, KPIs, matriz, alertas, chat
```

Principio tecnico: cada fonte externa deve ter adapter proprio, timeout, tratamento de erro, cache e dado fixture. Assim a demo funciona mesmo se alguma API falhar no dia da gravacao.

---

## 5. Stack definida

| Camada | Tecnologia | Decisao |
|---|---|---|
| Frontend | React + Vite + TypeScript | Rapido para dashboard e bom para video |
| Mapa | Leaflet + react-leaflet | Gratuito, sem chave, adequado para geodados |
| Graficos | Recharts | Leve, suficiente para KPIs e series simples |
| Backend | FastAPI + Python 3.11+ | Boa integracao com IA, dados e APIs |
| HTTP | httpx | Async, timeout e retry por adapter |
| Banco | SQLite + SQLModel | Zero infra, bom para POC local |
| RAG | ChromaDB + sentence-transformers local | Evita depender de embedding pago para demo |
| LLM | OpenRouter via OpenAI SDK | Uma chave para modelos diferentes e fallback |
| ML | Regras explicaveis + scikit-learn opcional | Baseline confiavel primeiro, ML como plus |

---

## 6. Estrategia LLM/OpenRouter

OpenRouter sera usado para chat completions e laudos. O plano deve evitar depender de modelo fixo, porque IDs e disponibilidade mudam. O sistema deve ler os modelos do `.env` e ter fallback.

Variaveis sugeridas:

```env
OPENROUTER_API_KEY=
LLM_REPORT_MODELS=~anthropic/claude-sonnet-latest,~openai/gpt-latest
LLM_AGENT_MODELS=~openai/gpt-latest,meta-llama/llama-3.1-8b-instruct
EMBEDDINGS_PROVIDER=local
```

Regras:

- `llm/router.py` recebe `task_type`, prompt e schema esperado.
- IDs de modelo devem ser configuraveis e podem ser atualizados pela Models API do OpenRouter.
- Laudo deve sair em JSON estruturado antes de virar texto na UI.
- Fallback usa lista de modelos por tarefa.
- Se OpenRouter falhar, backend mostra "laudo indisponivel" e mantem risco calculado.
- RAG usa embedding local por padrao; embeddings via OpenRouter ficam opcionais.

---

## 7. Fontes de dados

| Fonte | Uso no app | Prioridade | Observacao |
|---|---|---|---|
| NASA FIRMS | Focos ativos de fogo por satelite | Obrigatoria | Requer MAP_KEY gratuita |
| Open-Meteo | Previsao/tempo atual por lat-lon | Obrigatoria ou NASA POWER | Sem chave, facil para demo |
| NASA POWER | Dados meteorologicos historicos/diarios | Recomendada | Forte alinhamento com NASA e analise climatica |
| NASA EONET v3 | Eventos naturais recentes | Recomendada | GeoJSON pronto para mapa |
| INPE Queimadas | Focos no Brasil e validacao nacional | Recomendada | Forte contexto brasileiro |
| Copernicus Data Space/Sentinel Hub | Imagens/indices orbitais | Extra | Pode exigir conta e mais tempo |
| Defesa Civil/CEMADEN | Boletins e contexto | Extra | Usar scraping apenas se fonte for estavel |

Referencias oficiais consultadas:

- NASA FIRMS API: https://firms.modaps.eosdis.nasa.gov/api/area/csv
- NASA FIRMS MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key
- NASA EONET v3: https://eonet.gsfc.nasa.gov/docs/v3
- NASA POWER Daily API: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
- Open-Meteo Forecast API: https://open-meteo.com/en/docs
- INPE Queimadas Dados Abertos: https://data.inpe.br/queimadas/dados-abertos/
- Copernicus Data Space APIs: https://documentation.dataspace.copernicus.eu/APIs.html
- OpenRouter fallbacks: https://openrouter.ai/docs/guides/routing/model-fallbacks
- OpenRouter embeddings: https://openrouter.ai/docs/api/reference/embeddings

---

## 8. Modelo de dados minimo

| Entidade | Campos principais |
|---|---|
| `Region` | `id`, `name`, `state`, `center_lat`, `center_lon`, `bbox`, `area_km2` |
| `IngestRun` | `id`, `source`, `started_at`, `finished_at`, `status`, `error`, `records_count` |
| `FireFocus` | `id`, `source`, `lat`, `lon`, `brightness`, `confidence`, `acq_datetime`, `satellite` |
| `WeatherReading` | `id`, `source`, `region_id`, `temp`, `humidity`, `precip`, `wind`, `timestamp` |
| `NaturalEvent` | `id`, `source`, `category`, `title`, `lat`, `lon`, `started_at`, `raw_json` |
| `RiskAssessment` | `id`, `region_id`, `score`, `level`, `features_json`, `explanation`, `created_at` |
| `Alert` | `id`, `region_id`, `severity`, `reason`, `status`, `report_text`, `created_at` |
| `KnowledgeDocument` | `id`, `title`, `source_url`, `kind`, `indexed_at` |

---

## 9. Motor de risco v1

Score 0 a 100, explicavel:

```text
score =
  40% atividade de fogo      (focos recentes, densidade por area, confianca)
  30% estresse climatico     (temperatura, umidade, chuva recente)
  15% vento                  (propagacao potencial)
  15% tendencia              (aumento nas ultimas 24h/7d, se houver historico)
```

Niveis:

- 0-24: Baixo
- 25-49: Moderado
- 50-74: Alto
- 75-100: Critico

Toda classificacao deve guardar `features_json`, para o laudo explicar "por que" a regiao recebeu o nivel.

---

## 10. Criterios de aceite da POC

- `GET /health` responde.
- `POST /ingest/run` coleta dados reais ou ativa fixture quando API externa falha.
- `GET /fires` retorna pontos com latitude/longitude.
- `GET /risk` retorna regioes com `score`, `level` e explicacao.
- `POST /report/{region_id}` gera laudo estruturado com base nos dados.
- `POST /chat` responde com fontes.
- Frontend abre em `localhost:5173` com mapa, matriz de risco, alertas, laudo e chat.
- README permite rodar backend e frontend do zero.
- PDF e video explicam integracao entre IA Gen, RAG, automacao, APIs, dashboard e analise de dados.

---

## 11. Estrutura de pastas planejada

```text
OrbitGuard/
|-- README.md
|-- document/
|   |-- entrega.pdf
|   |-- diagramas/
|-- assets/
|-- Plano/
|-- src/
|   |-- backend/
|   |   |-- app/
|   |   |   |-- main.py
|   |   |   |-- core/
|   |   |   |-- db/
|   |   |   |-- models/
|   |   |   |-- ingestion/
|   |   |   |-- risk/
|   |   |   |-- llm/
|   |   |   |-- rag/
|   |   |   |-- api/
|   |   |   |-- fixtures/
|   |   |-- tests/
|   |   |-- requirements.txt
|   |   |-- .env.example
|   |-- frontend/
|       |-- src/
|       |   |-- components/
|       |   |-- pages/
|       |   |-- services/
|       |   |-- styles/
|       |-- package.json
```

O README de cada pasta deve seguir o template oficial exigido pela FIAP.
