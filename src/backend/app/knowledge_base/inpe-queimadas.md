# INPE Programa Queimadas

## Fonte oficial
Portal de dados do INPE Programa Queimadas: https://data.inpe.br/queimadas/

## Resumo
O Programa Queimadas do Instituto Nacional de Pesquisas Espaciais (INPE) realiza o monitoramento operacional de focos de calor e queimadas no território brasileiro e na América do Sul a partir de dados de sensoriamento remoto. Os produtos são disponibilizados como dados abertos e constituem a referência nacional para acompanhamento de incêndios na vegetação. O programa integra múltiplos satélites e padroniza um satélite de referência para comparações temporais consistentes.

## Conceitos importantes
- Foco de calor: pixel detectado por sensor orbital que indica anomalia térmica compatível com fogo na vegetação; não equivale diretamente a um incêndio ou à sua área.
- Satélite de referência AQUA_M-T: o INPE adota a passagem da tarde do satélite Aqua (sensor MODIS) como referência oficial para análises de série histórica e comparação entre regiões e períodos.
- Constelação multissatélite: além do satélite de referência, o programa agrega detecções de diversos sensores e plataformas, ampliando a cobertura temporal diária.
- Dados abertos: focos, séries históricas e produtos derivados são publicados publicamente, permitindo reuso por pesquisa, gestão pública e aplicações de terceiros.
- Cobertura por biomas: as detecções podem ser analisadas por bioma brasileiro (Amazônia, Cerrado, Pantanal, Caatinga, Mata Atlântica e Pampa), cada um com dinâmica de fogo distinta.
- Atributos do foco: cada registro tipicamente traz data e hora, coordenadas geográficas, satélite de origem e localização administrativa.
- Limitações conhecidas: nuvens, horário de passagem e características do sensor afetam a detecção, podendo gerar omissões ou repetições.
- Complementaridade com FIRMS: o sistema FIRMS da NASA fornece detecções independentes (MODIS/VIIRS) úteis para validação cruzada das ocorrências.

## Como o OrbitGuard usa
O OrbitGuard consome focos do Programa Queimadas como camada primária de evidência nacional, priorizando o satélite de referência AQUA_M-T para consistência temporal. As detecções do INPE são submetidas a validação cruzada com o FIRMS para reforçar a confiança antes de compor o indicador de risco por região e bioma. Os resultados são apoio à decisão e priorização de atenção, não constituindo alerta oficial de incêndio; decisões operacionais devem sempre consultar os órgãos competentes e as fontes oficiais.
