# Copernicus / Sentinel

## Fonte oficial
https://documentation.dataspace.copernicus.eu/APIs.html

## Resumo
O Copernicus e o programa de observacao da Terra da Uniao Europeia, operado em conjunto com a Agencia Espacial Europeia (ESA). A familia de satelites Sentinel fornece imagens e dados ambientais gratuitos e abertos. O Copernicus Data Space Ecosystem e o ponto de acesso oficial atual a esses dados, com APIs para busca, download e processamento. No OrbitGuard, o foco e o Sentinel-2, sensor optico de media resolucao usado para derivar indices de vegetacao e umidade.

## Conceitos importantes
- **Sentinel-2 optico**: missao de imageamento multiespectral de media resolucao, voltada ao monitoramento de vegetacao, uso do solo e ambiente terrestre.
- **Bandas espectrais**: o Sentinel-2 capta multiplas bandas, incluindo vermelho, infravermelho proximo (NIR) e infravermelho de ondas curtas (SWIR), base para o calculo de indices.
- **NDVI (Indice de Vegetacao por Diferenca Normalizada)**: indice que estima vigor e densidade da vegetacao a partir das bandas vermelho e NIR; valores mais baixos podem indicar vegetacao seca ou estressada.
- **NDWI (Indice de Agua por Diferenca Normalizada)**: indice que estima o conteudo de umidade da vegetacao ou presenca de agua, util para identificar areas mais secas.
- **Estresse hidrico da vegetacao**: combinacao de NDVI baixo e NDWI baixo pode sugerir vegetacao seca, um dos fatores associados a maior susceptibilidade a queimadas.
- **Copernicus Data Space Ecosystem**: plataforma oficial de acesso aos dados Sentinel, com APIs (catalogo, OData, STAC, Sentinel Hub) para consulta e processamento.
- **Dados abertos e gratuitos**: as imagens Sentinel seguem politica de acesso livre, adequada a projetos academicos e provas de conceito.
- **Cobertura de nuvens**: imagens opticas dependem de ceu limpo; nebulosidade pode limitar a disponibilidade e a qualidade das observacoes.

## Como o OrbitGuard usa
No OrbitGuard, o Sentinel-2 e uma fonte opcional de analise orbital visual do estresse da vegetacao. A partir de indices como NDVI e NDWI, o sistema busca caracterizar areas com vegetacao mais seca ou estressada, complementando outras variaveis de risco. Esses dados servem como insumo qualitativo de contexto, sem substituir leituras de campo ou outras fontes. O OrbitGuard e uma ferramenta de apoio a decisao e nao constitui alerta oficial de queimadas.
