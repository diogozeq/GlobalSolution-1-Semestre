# ETAPA 2 - Inteligencia

> Objetivo: transformar dados coletados em decisao explicavel. Esta etapa prova IA Generativa, RAG, agente, motor de risco, alertas e analise de dados.

Resultado esperado: dashboard mostra nivel de risco por regiao, alerta gerado automaticamente, laudo por IA e chat RAG respondendo com fontes.

---

## 2.1 Motor de risco explicavel

Implementar primeiro versao por regras. Ela e mais defensavel no PDF e na banca.

- [ ] `risk/features.py`
  - Agrega features por regiao:
    - focos nas ultimas 24h.
    - focos nos ultimos 7 dias.
    - densidade por area.
    - brilho medio/maximo.
    - confianca media.
    - temperatura.
    - umidade.
    - precipitacao recente.
    - vento.

- [ ] `risk/engine.py`
  - Calcula score 0-100.
  - Classifica `Baixo`, `Moderado`, `Alto`, `Critico`.
  - Retorna explicacao curta e `features_json`.

- [ ] `risk/rules.py`
  - Pesos configuraveis.
  - Limiar configuravel via `.env`.

Formula v1:

```text
fire_activity = focos_24h + densidade + brilho + confianca
weather_stress = temperatura_alta + umidade_baixa + pouca_chuva
spread_potential = vento
trend = aumento_24h_vs_7d

score = 0.40 * fire_activity
      + 0.30 * weather_stress
      + 0.15 * spread_potential
      + 0.15 * trend
```

Niveis:

- 0-24: Baixo.
- 25-49: Moderado.
- 50-74: Alto.
- 75-100: Critico.

Endpoints:

- [ ] `POST /risk/recalculate`
- [ ] `GET /risk`
- [ ] `GET /risk/{region_id}`

---

## 2.2 Alertas

- [ ] Criar `Alert` quando `level` for `Alto` ou `Critico`.
- [ ] Evitar alerta duplicado para mesma regiao em janela curta.
- [ ] Campos: regiao, severidade, motivo, status, score, criado_em.
- [ ] `GET /alerts`
- [ ] `PATCH /alerts/{id}/status`
- [ ] Polling no frontend a cada 30-60 segundos.

Regra de comunicacao: texto deve dizer "risco estimado pelo OrbitGuard", nao "alerta oficial".

---

## 2.3 IA Generativa para laudos

- [ ] `llm/router.py`
  - Usa OpenAI SDK com `base_url=https://openrouter.ai/api/v1`.
  - Le `LLM_REPORT_MODELS` e `LLM_AGENT_MODELS`.
  - Usa fallback por lista de modelos.
  - Timeout e erro tratados.

- [ ] `llm/schemas.py`
  - Schema do laudo:
    - `title`
    - `risk_level`
    - `summary`
    - `evidence`
    - `recommended_actions`
    - `limitations`

- [ ] `llm/reports.py`
  - Prompt com dados numericos da regiao.
  - Exige que IA cite evidencias dos dados, nao invente.
  - Inclui limitacao: "nao substitui orgaos oficiais".

- [ ] `POST /report/{region_id}`
  - Retorna laudo.
  - Salva laudo no alerta quando existir.

Prompt base recomendado:

```text
Voce e um analista tecnico de monitoramento ambiental.
Gere um laudo curto em portugues do Brasil usando apenas os dados fornecidos.
Nao invente valores. Se um dado estiver ausente, declare a limitacao.
Classificacao do sistema: {risk_level}, score {score}/100.
Features: {features_json}
Responda no schema JSON solicitado.
```

---

## 2.4 RAG com base espacial

Usar embedding local por padrao para nao depender de custo/rede.

- [ ] Criar `knowledge_base/` com documentos markdown curtos:
  - `nasa-firms.md`
  - `nasa-eonet.md`
  - `nasa-power.md`
  - `inpe-queimadas.md`
  - `copernicus-sentinel.md`
  - `defesa-civil-protocolos.md`
  - `glossario.md`

- [ ] Cada documento deve conter:
  - titulo.
  - fonte oficial.
  - resumo.
  - conceitos importantes.
  - como o OrbitGuard usa aquele dado.

- [ ] `rag/index.py`
  - Le markdown.
  - Divide em chunks.
  - Gera embeddings com `sentence-transformers/all-MiniLM-L6-v2`.
  - Persiste no ChromaDB.

- [ ] `rag/retriever.py`
  - Busca top-k chunks.
  - Retorna texto + metadados + fonte.

- [ ] `POST /rag/reindex`
  - Reindexa base.

---

## 2.5 Agente RAG com ferramentas

O agente nao precisa ser complexo. Ele deve combinar base de conhecimento com dados vivos do sistema.

Ferramentas internas:

- [ ] `get_risk(region_name)`
  - Consulta ultimo `RiskAssessment`.

- [ ] `get_fires(region_name)`
  - Consulta focos recentes da regiao.

- [ ] `get_weather(region_name)`
  - Consulta clima recente.

Fluxo:

```text
Pergunta do usuario
  |
  +--> detectar regiao citada, se houver
  +--> recuperar chunks RAG
  +--> chamar ferramentas internas relevantes
  +--> montar contexto
  +--> LLM responde com fontes
```

Endpoint:

- [ ] `POST /chat`
  - Entrada: `{ "question": "...", "region_id": optional }`
  - Saida: `{ "answer": "...", "sources": [...], "used_tools": [...] }`

Exemplos para demo:

- "Por que o Para esta em risco alto?"
- "Qual a diferenca entre FIRMS e EONET?"
- "Que acoes preventivas fazem sentido para uma regiao com muitos focos e vento alto?"

---

## 2.6 ML opcional e defensavel

Nao treinar modelo falso so para dizer que tem ML. Se houver tempo, usar ML como comparacao didatica.

Opcoes:

- [ ] Treinar `LogisticRegression` ou `RandomForestClassifier` com labels gerados pelas regras v1.
- [ ] Mostrar matriz de confusao comparando ML contra regra.
- [ ] Explicar no PDF que, por falta de rotulo oficial, o ML e prototipo experimental.

Melhor abordagem para nota: manter regra como motor principal e usar ML como "experimento de expansao".

---

## 2.7 Frontend de inteligencia

- [ ] `RiskMatrix`
  - Tabela por regiao com score, nivel e principais evidencias.

- [ ] `AlertsPanel`
  - Lista alertas Alto/Critico.
  - Expandir laudo.

- [ ] `ReportView`
  - Botao "Gerar laudo".
  - Loading, erro e fallback.

- [ ] `ChatAgent`
  - Chat com historico local.
  - Mostra fontes clicaveis.
  - Mostra ferramentas usadas quando houver.

Layout final recomendado:

```text
+---------------------------------------------------------------+
| OrbitGuard AI | Atualizar dados | Gerar riscos | Status       |
+---------------------------+-----------------------------------+
| Mapa                      | KPIs: regioes, focos, risco max   |
| focos + eventos           +-----------------------------------+
|                           | Matriz de risco                   |
+---------------------------+-----------------------------------+
| Alertas e laudos          | Chat RAG com fontes               |
+---------------------------+-----------------------------------+
```

---

## 2.8 Testes e verificacao

- [ ] Teste unitario do score com caso Baixo.
- [ ] Teste unitario do score com caso Critico.
- [ ] Teste de nao duplicar alerta.
- [ ] Teste de prompt: laudo nao quebra quando LLM indisponivel.
- [ ] Teste RAG com pergunta conhecida retornando fonte.
- [ ] Teste manual do fluxo completo:
  - ingestao.
  - recalculo de risco.
  - alerta.
  - laudo.
  - chat.

---

## 2.9 Entregaveis da Etapa 2

- [ ] Motor de risco explicavel.
- [ ] Alertas persistidos.
- [ ] Laudo por IA via OpenRouter.
- [ ] RAG indexado com fontes espaciais.
- [ ] Agente consultando base + dados vivos.
- [ ] Frontend com matriz, alertas, laudo e chat.
- [ ] Commit sugerido: `feat: add risk engine, AI reports and RAG agent`
