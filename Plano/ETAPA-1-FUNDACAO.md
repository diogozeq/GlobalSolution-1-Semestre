# ETAPA 1 - Fundacao

> Objetivo: colocar dados reais entrando no backend, persistidos no banco e visiveis no mapa. Esta etapa prova automacao, integracao de APIs e dashboard.

Resultado esperado: abrir `localhost:5173`, ver mapa com focos reais de fogo e clima de regioes monitoradas, com backend FastAPI servindo dados do SQLite.

---

## 1.1 Estrutura obrigatoria do repositorio

- [ ] Replicar estrutura do template `TEMPLATE-TIAO-2026`.
- [ ] Criar README raiz com nome completo dos integrantes.
- [ ] Criar `src/backend`, `src/frontend`, `document/`, `assets/` e `Plano/`.
- [ ] Criar `.gitignore` com `venv/`, `.venv/`, `node_modules/`, `.env`, `*.db`, `__pycache__/`, `.pytest_cache/`.
- [ ] Criar `.env.example` sem valores reais.
- [ ] Criar README basico em pastas exigidas pelo template.

---

## 1.2 Backend FastAPI

Dependencias minimas:

```text
fastapi
uvicorn[standard]
httpx
sqlmodel
pydantic-settings
python-dotenv
tenacity
pytest
```

Tarefas:

- [ ] `src/backend/app/main.py` com FastAPI.
- [ ] CORS liberado para `localhost:5173`.
- [ ] `GET /health` retornando status, versao e timestamp.
- [ ] `app/core/config.py` lendo `.env`.
- [ ] `app/core/http.py` com timeout padrao e retries simples.
- [ ] Tratamento global de erro para API externa.

---

## 1.3 Banco SQLite

- [ ] `app/db/session.py` com engine SQLite.
- [ ] `app/db/init_db.py` criando tabelas.
- [ ] Modelos SQLModel:
  - [ ] `Region`
  - [ ] `IngestRun`
  - [ ] `FireFocus`
  - [ ] `WeatherReading`
  - [ ] `NaturalEvent`
  - [ ] `RiskAssessment`
  - [ ] `Alert`
- [ ] Seed inicial com regioes-alvo:
  - [ ] Amazonia Legal ou estados prioritarios.
  - [ ] Pelo menos 5 regioes para dashboard ficar interessante.

---

## 1.4 Conectores reais

### Obrigatorios

- [ ] `ingestion/firms.py`
  - NASA FIRMS area CSV.
  - Usa `FIRMS_MAP_KEY` no `.env`.
  - Busca focos por bbox e intervalo.
  - Normaliza lat/lon, data, satelite, brilho e confianca.
  - Salva `FireFocus`.

- [ ] `ingestion/weather.py`
  - Open-Meteo forecast/current por lat-lon.
  - Coleta temperatura, umidade relativa, precipitacao e vento.
  - Salva `WeatherReading`.

### Recomendados

- [ ] `ingestion/eonet.py`
  - NASA EONET v3 GeoJSON.
  - Coleta eventos abertos de `wildfires`, `severeStorms`, `floods` quando existirem.
  - Salva `NaturalEvent`.

- [ ] `ingestion/power.py`
  - NASA POWER Daily API para historico meteorologico.
  - Usar para chuva acumulada e dias secos se der tempo.

### Extra Brasil

- [ ] `ingestion/inpe.py`
  - Baixar CSV publico do Programa Queimadas/INPE ou consultar endpoint estavel.
  - Usar como comparacao/validacao do FIRMS.

---

## 1.5 Cache e fixtures de demo

Nao depender da internet no dia da apresentacao.

- [ ] Cada adapter grava `IngestRun` com status `success`, `partial` ou `failed`.
- [ ] Criar `fixtures/fires_sample.csv`.
- [ ] Criar `fixtures/weather_sample.json`.
- [ ] Criar `fixtures/eonet_sample.geojson`.
- [ ] `POST /ingest/run?use_fixture=true` carrega dados locais.
- [ ] Se API externa falhar, frontend mostra selo "dados em cache" ou "fixture de demo".

---

## 1.6 Endpoints da Etapa 1

- [ ] `POST /ingest/run`
  - Parametros: `sources`, `use_fixture`, `bbox`, `days`.
  - Retorna resumo por fonte.

- [ ] `GET /ingest/runs`
  - Lista execucoes e erros.

- [ ] `GET /regions`
  - Lista regioes monitoradas.

- [ ] `GET /fires?bbox=...&date_from=...&date_to=...`
  - Retorna pontos para o mapa.

- [ ] `GET /weather?region_id=...`
  - Retorna clima mais recente da regiao.

- [ ] `GET /events`
  - Retorna eventos naturais EONET, se implementado.

---

## 1.7 Frontend dashboard basico

Dependencias:

```text
react
typescript
vite
leaflet
react-leaflet
axios
recharts
lucide-react
```

Componentes:

- [ ] `MapView`
  - Mapa do Brasil.
  - Marcadores de focos.
  - Cor por confianca/intensidade.
  - Clique em marcador abre popup com fonte, data e satelite.

- [ ] `RegionPanel`
  - Lista regioes monitoradas.
  - Seleciona regiao e centraliza mapa.

- [ ] `WeatherPanel`
  - Temperatura, umidade, chuva e vento.

- [ ] `IngestStatus`
  - Mostra ultima coleta, fontes com erro e uso de cache/fixture.

Layout recomendado:

```text
+--------------------------------------------------+
| OrbitGuard AI | status ingestao | atualizar      |
+----------------------+---------------------------+
| mapa                 | regiao selecionada        |
| focos/eventos        | clima + ultimas coletas   |
|                      |                           |
+----------------------+---------------------------+
```

---

## 1.8 Testes e verificacao

- [ ] `pytest` para parser FIRMS com CSV fixture.
- [ ] `pytest` para parser Open-Meteo com JSON fixture.
- [ ] `pytest` para `/health`.
- [ ] Teste manual: rodar backend, executar ingestao, abrir frontend.
- [ ] Registrar prints do mapa para usar no PDF.

Comando de aceite:

```powershell
cd src/backend
python -m uvicorn app.main:app --reload

cd ../frontend
npm run dev
```

---

## 1.9 Entregaveis da Etapa 1

- [ ] Repo organizado.
- [ ] Backend FastAPI funcional.
- [ ] SQLite populado.
- [ ] 2 fontes reais funcionando.
- [ ] Fixture de demo pronta.
- [ ] Mapa com dados reais ou cache.
- [ ] Commit sugerido: `feat: add OrbitGuard foundation with ingestion and map`
