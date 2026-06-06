# NASA EONET v3 — Eventos Naturais

## Fonte oficial
https://eonet.gsfc.nasa.gov/docs/v3

## Resumo
O EONET (Earth Observatory Natural Event Tracker) é um serviço aberto da NASA que cataloga eventos naturais curados a partir de múltiplas fontes orbitais e terrestres. A API v3 expõe esses eventos em formato JSON e GeoJSON, organizados por categorias e com referência às imagens de satélite associadas. É um catálogo de metadados de eventos, não uma fonte de imagens brutas nem de alertas oficiais.

## Conceitos importantes
- Cada evento possui um identificador único (`id`), título, descrição e uma ou mais categorias.
- Categorias relevantes ao monitoramento de queimadas e clima incluem `wildfires`, `severeStorms`, `floods` e `drought`, entre outras.
- O campo `geometry` descreve a localização do evento ao longo do tempo, podendo ser `Point` (foco pontual) ou `Polygon` (área afetada), seguindo a convenção GeoJSON de coordenadas `[longitude, latitude]`.
- Cada entrada de geometria tem um carimbo de data/hora (`date`), permitindo acompanhar a evolução espacial e temporal do evento.
- O status do evento é `open` (em andamento) ou `closed` (encerrado, com data de fechamento), filtrável via parâmetro `status`.
- Os eventos trazem `sources` com links para a origem do dado e podem referenciar camadas WMS/imagens de satélite.
- A API permite filtrar por categoria, status, intervalo de datas, bounding box geográfica e limite de resultados.
- Os endpoints principais expõem eventos, categorias, fontes e camadas, sempre como dados abertos e sem necessidade de chave de acesso.

## Como o OrbitGuard usa
O OrbitGuard consome o EONET v3 como camada multi-risco complementar, cruzando eventos `wildfires` ativos (`status=open`) com outras categorias como `severeStorms`, `floods` e `drought` para contextualizar a área monitorada. As geometrias GeoJSON são usadas para posicionar os eventos no mapa e correlacioná-los com os focos de calor de outras fontes orbitais. Trata-se exclusivamente de uma POC de apoio à decisão: o OrbitGuard não emite alertas oficiais nem substitui órgãos competentes, servindo apenas para enriquecer a análise de risco de queimadas.
