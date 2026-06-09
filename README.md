# FIAP - Faculdade de Informática e Administração Paulista

<p align="center">
<a href="https://www.fiap.com.br/">
  <img src="assets/logo-fiap.png" alt="FIAP" width="40%">
</a>
</p>

<br>

# OrbitGuard AI — Prevenção de Desastres Climáticos com Dados Orbitais

## 2TIAO — Global Solution 2026.1

## 👨‍🎓 Integrante

- <a href="https://www.linkedin.com/in/diogozequini/">Diogo Zequini Viso — RM 565535</a>

---

## 📜 Descrição

**OrbitGuard AI** conecta cinco APIs públicas de satélite (NASA FIRMS, INPE Queimadas, Open-Meteo, NASA EONET, NASA POWER) e transforma dados brutos em decisão acionável: score de risco 0–100 por região, laudo técnico gerado por IA e agente conversacional com RAG.

---

## ✅ Checklist da Entrega

### Dados e Ingestão
- [x] 5 adapters de ingestão com retry, timeout e fallback para fixture offline
- [x] Cross-validation FIRMS × INPE (focos confirmados por duas fontes independentes)
- [x] Cobertura total do Brasil (bbox corrigida: −74W a −28W, −34S a 5N)

### Motor de Risco
- [x] Score 0–100 explicável: 40% fogo + 30% clima + 15% dispersão + 15% tendência 7 dias
- [x] Classificação automática: Baixo / Moderado / Alto / Crítico
- [x] Alertas automáticos para Alto e Crítico

### IA Generativa — Laudos
- [x] Laudo técnico estruturado gerado via OpenRouter (resumo executivo, evidências, ações, limitações)
- [x] Cascade de modelos com fallback determinístico se LLM indisponível

### IA Conversacional — Chat RAG
- [x] Agente com tools em tempo real: `get_risk`, `get_fires`, `get_weather`
- [x] ChromaDB + sentence-transformers (fallback TF-IDF puro-Python sem dependências extras)
- [x] Respostas com citação de fonte

### Machine Learning Experimental
- [x] LogisticRegression com 14 features de satélite
- [x] Labels observacionais reais: critérios operacionais INPE Queimadas + eventos confirmados NASA EONET (não pseudo-labels das regras internas)
- [x] Split estratificado (seed=42) garantindo todas as classes no conjunto de teste
- [x] Augmentação oracle: 75 amostras sintéticas/classe com rejection sampling dentro dos limiares INPE

### Interface
- [x] 12 páginas: Missões, Mapa, Laudos IA, Chat RAG, Telemetria, Ativos, Risco, ML Experimental, Histórico, Sensor IoT, Saúde do Sistema, Configurações
- [x] Mapa geoespacial Leaflet com focos de calor, regiões e eventos, filtros por camada
- [x] Score com decomposição visual por componente
- [x] Feed de detecção ao vivo com histórico sparkline

### IoT
- [x] Sensor ESP32 simulado (Wokwi) enviando temperatura, umidade e fumaça via MQTT/HTTP
- [x] Página dedicada com leituras em tempo real e histórico

### Infraestrutura
- [x] Zero custo: SQLite, APIs públicas, embeddings open-source
- [x] `python start.py` sobe backend + frontend com um comando (auto-instala dependências)
- [x] Testes backend com pytest

---

## 🏆 QUERO CONCORRER

---

## 📁 Estrutura de Pastas

```
OrbitGuard/
├── assets/       screenshots e logo
├── data/         fixtures CSV/JSON para demo offline
├── docs/         diagramas de arquitetura e documentação
├── Plano/        planejamento técnico
├── src/
│   ├── backend/  FastAPI, adapters, motor de risco, LLM, RAG, ML
│   └── frontend/ React + Vite + TypeScript + Leaflet
└── start.py      ponto de entrada único
```

---

## 📎 Links e Observações

- **Repositório:** https://github.com/diogozeq/GlobalSolution-1-Semestre
- **Vídeo demonstrativo:** https://youtu.be/L1mKh8KA1oQ
- **PDF da entrega:** `docs/entrega.pdf`

A chave `OPENROUTER_API_KEY` está exposta no `.env` **intencionalmente** — coloquei crédito limitado para os professores testarem a IA Generativa sem configurar nada. Se o crédito acabar, o sistema cai automaticamente para o fallback determinístico.

**Este projeto aceita participar da competição de pódio: QUERO CONCORRER.**

---

## 🔧 Como Executar

**Pré-requisitos:** Python 3.11+ e Node 18+

```bash
python start.py
```

Instala dependências automaticamente, sobe backend em `http://localhost:8079` e frontend em `http://localhost:5173`.

**Testes:**
```bash
cd src/backend
.venv/Scripts/python -m pytest -q
```

**Demo offline (sem internet):**
```bash
curl -X POST "http://localhost:8079/ingest/run?use_fixture=true"
curl -X POST "http://localhost:8079/risk/recalculate"
```

---

## 📋 Licença

<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1"><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1"><p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/agodoi/template">MODELO GIT FIAP</a> por <a rel="cc:attributionURL dct:creator" property="cc:attributionName" href="https://fiap.com.br">FIAP</a> está licenciado sobre <a href="http://creativecommons.org/licenses/by/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">Attribution 4.0 International</a>.</p>
