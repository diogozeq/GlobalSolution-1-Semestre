# Estrutura do PDF de entrega — OrbitGuard AI

> Gere `document/entrega.pdf` a partir deste roteiro. Código deve aparecer **em texto** (não print).

## 1. Capa
- Nome completo dos integrantes (+ RM).
- Frase **"QUERO CONCORRER"** se for concorrer ao pódio.
- Nome do projeto: **OrbitGuard AI** — e o subtítulo (apoio à prevenção de desastres climáticos com dados orbitais).

## 2. Introdução
- Contexto da nova economia espacial e dados orbitais abertos.
- Problema: dados existem, mas precisam virar decisão rápida.
- Proposta do OrbitGuard AI (apoio à decisão, **não** alerta oficial).

## 3. Desenvolvimento
- Arquitetura (inserir diagrama de `document/diagramas/arquitetura.md`).
- Fontes de dados (FIRMS, Open-Meteo, EONET, POWER, INPE) + links.
- Fluxo de ingestão (adapter → SQLite → risco → alerta → IA/RAG → dashboard).
- Motor de risco explicável (fórmula 0,40·fogo + 0,30·clima + 0,15·vento + 0,15·tendência).
- IA Generativa (laudo estruturado via OpenRouter + fallback determinístico).
- RAG/agente (ChromaDB/TF-IDF + tools get_risk/get_fires/get_weather + fontes).
- Dashboard (mapa, matriz, alertas, laudo, chat).
- Trechos de código principais **em texto**: `risk/engine.py` (score), `llm/router.py` (fallback), `rag/agent.py` (fluxo).

## 4. Resultados esperados
- Como o sistema apoia a decisão preventiva.
- O que o MVP já faz (ver "Critérios de aceite" no README).
- Limites da POC.

## 5. Conclusão
- Conexão com as disciplinas integradas.
- Evoluções futuras (INPE completo, EONET multi-risco, Sentinel/NDVI, ESP32/IoT, ML experimental).
- Valor para a economia espacial.

## 6. Links
- Repositório.
- Vídeo YouTube (não listado).
- Fontes externas.

## Imagens recomendadas (salvar em `../assets/`)
- [ ] Diagrama de arquitetura
- [ ] Print do mapa com focos
- [ ] Print da matriz de risco
- [ ] Print do laudo de IA
- [ ] Print do chat RAG com fontes
- [ ] Fluxograma de ingestão até alerta
