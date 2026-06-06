# ETAPA 3 - Polimento e Entrega

> Objetivo: transformar MVP em entrega clara, testada e forte para nota/podio. Esta etapa cobre acabamento visual, documentacao, PDF, video e ensaio da apresentacao.

Resultado esperado: projeto roda do zero, README explica tudo, PDF unico cumpre regras, video de ate 5 minutos demonstra fluxo completo.

---

## 3.1 Dashboard final

Prioridade: utilitario, claro e demonstravel. Evitar tela com cara de landing page.

- [ ] Tela unica com mapa, KPIs, matriz de risco, alertas, laudo e chat.
- [ ] Mapa como elemento principal.
- [ ] Cores de risco consistentes:
  - Baixo: verde.
  - Moderado: amarelo.
  - Alto: laranja.
  - Critico: vermelho.
- [ ] Estados visiveis:
  - carregando.
  - erro de API externa.
  - sem dados.
  - dados em cache/fixture.
- [ ] Botao "Atualizar dados".
- [ ] Botao "Recalcular risco".
- [ ] Botao "Gerar laudo".
- [ ] Responsividade suficiente para notebook e gravacao.

Checklist visual:

- [ ] Texto nao sobrepoe mapa.
- [ ] Marcadores nao travam a tela.
- [ ] Chat mostra fontes.
- [ ] Laudo tem formato legivel.
- [ ] Status da ultima ingestao aparece no topo.

---

## 3.2 Qualidade operacional

- [ ] Backend sobe com `python -m uvicorn app.main:app --reload`.
- [ ] Frontend sobe com `npm run dev`.
- [ ] `.env.example` completo.
- [ ] Nenhuma chave real no repo.
- [ ] `requirements.txt` congelado.
- [ ] `package.json` com scripts claros.
- [ ] Banco pode ser recriado do zero.
- [ ] Fixtures permitem demo offline.
- [ ] README testado em maquina limpa ou pasta nova.

Testes minimos:

- [ ] `pytest` passa.
- [ ] Teste parser FIRMS.
- [ ] Teste parser clima.
- [ ] Teste risk engine.
- [ ] Teste endpoints principais.
- [ ] Teste RAG com fonte.

---

## 3.3 README raiz

Obrigatorio conter:

- [ ] Nome completo dos integrantes.
- [ ] Nome do projeto: OrbitGuard AI.
- [ ] Problema resolvido.
- [ ] Solucao proposta.
- [ ] Temas da GS atendidos.
- [ ] Arquitetura com diagrama.
- [ ] Tecnologias usadas.
- [ ] Fontes de dados e links.
- [ ] Como rodar backend.
- [ ] Como rodar frontend.
- [ ] Como configurar `.env`.
- [ ] Como executar demo com fixtures.
- [ ] Prints do dashboard.
- [ ] Link do video.
- [ ] Observacao: projeto e POC academica, nao alerta oficial.

README das pastas deve seguir template FIAP quando exigido.

---

## 3.4 PDF unico da entrega

Estrutura minima pedida:

1. Capa
   - Nome completo dos integrantes.
   - Frase "QUERO CONCORRER" se forem concorrer ao podio.
   - Nome do projeto.

2. Introducao
   - Contexto da nova economia espacial.
   - Problema de desastres climaticos.
   - Proposta OrbitGuard AI.

3. Desenvolvimento
   - Arquitetura.
   - Fontes de dados.
   - Fluxo de ingestao.
   - Motor de risco.
   - IA Generativa.
   - RAG/agente.
   - Dashboard.
   - Trechos de codigo principais em texto, nao print.

4. Resultados esperados
   - Como o sistema apoia decisao.
   - O que o MVP ja faz.
   - Limites da POC.

5. Conclusao
   - Conexao com disciplinas.
   - Evolucoes futuras.
   - Valor para economia espacial.

6. Links
   - Repositorio.
   - Video YouTube nao listado.
   - Fontes externas.

Imagens recomendadas:

- [ ] Diagrama de arquitetura.
- [ ] Print do mapa.
- [ ] Print da matriz de risco.
- [ ] Print do laudo.
- [ ] Print do chat RAG com fontes.
- [ ] Fluxograma de ingestao ate alerta.

---

## 3.5 Roteiro do video de ate 5 minutos

```text
0:00 - 0:15
Nome do grupo, integrantes e "QUERO CONCORRER" se aplicavel.

0:15 - 0:45
Problema: dados orbitais existem, mas precisam virar decisao rapida.

0:45 - 1:20
Arquitetura: APIs NASA/INPE/Open-Meteo -> FastAPI -> SQLite -> risco -> IA/RAG -> dashboard.

1:20 - 2:10
Demo ingestao: atualizar dados, mostrar status e mapa com focos.

2:10 - 3:00
Demo risco: matriz, regiao critica, evidencias do score.

3:00 - 3:45
Demo IA Generativa: gerar laudo e explicar recomendacoes.

3:45 - 4:30
Demo RAG/agente: perguntar por que a regiao esta em risco e mostrar fontes.

4:30 - 5:00
Fechamento: disciplinas integradas, limites da POC, evolucoes.
```

Frase-chave para banca:

> "O OrbitGuard AI nao tenta substituir orgaos oficiais; ele demonstra como dados orbitais, automacao, IA Generativa e RAG podem acelerar analise de risco e apoiar decisoes preventivas."

---

## 3.6 Extras de podio

Usar apenas depois do MVP rodando.

### Extra A - INPE completo

- [ ] Integrar dados do INPE Queimadas.
- [ ] Mostrar comparacao FIRMS x INPE.
- [ ] Valor: reforca Brasil, dados oficiais e validacao cruzada.

### Extra B - EONET multi-risco

- [ ] Mostrar camada de eventos naturais globais.
- [ ] Filtrar por wildfires, storms, floods.
- [ ] Valor: amplia de queimadas para plataforma multi-risco.

### Extra C - Copernicus/Sentinel visual

- [ ] Usar Copernicus Browser/Sentinel Hub para imagem da regiao.
- [ ] Exibir link ou snapshot no painel.
- [ ] Valor: reforca analise orbital visual.

### Extra D - ESP32/Wokwi

- [ ] Simular sensor de temperatura, umidade e fumaca.
- [ ] Enviar leitura para endpoint `POST /sensor/readings`.
- [ ] Cruzar "satelite + solo" no laudo.
- [ ] Valor: integra IoT/Edge Computing.

### Extra E - ML experimental

- [ ] Treinar modelo com features historicas e labels derivadas da regra.
- [ ] Mostrar resultado como experimento, nao fonte oficial.
- [ ] Valor: demonstra Machine Learning sem fragilizar MVP.

---

## 3.7 Checklist final antes de entregar

- [ ] App roda do zero com README.
- [ ] Fluxo demo completo funciona sem internet usando fixture.
- [ ] Fluxo demo real funciona com chaves configuradas.
- [ ] PDF unico pronto.
- [ ] Codigo no PDF esta em texto.
- [ ] Video esta no YouTube como "Nao listado".
- [ ] Link do video esta no PDF.
- [ ] Link do repo esta no PDF.
- [ ] `.env`, `venv`, `node_modules` e banco local nao foram enviados.
- [ ] Nomes dos integrantes aparecem no README e PDF.
- [ ] Entrega feita antes do prazo da plataforma.

---

## 3.8 Entregaveis da Etapa 3

- [ ] Dashboard final polido.
- [ ] Testes basicos passando.
- [ ] README completo.
- [ ] PDF unico.
- [ ] Video publicado.
- [ ] Projeto operacional e testado.
- [ ] Commit sugerido: `docs: finalize OrbitGuard delivery materials`
