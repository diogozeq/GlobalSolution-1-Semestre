# NASA FIRMS — Focos Ativos de Fogo

## Fonte oficial
NASA FIRMS (Fire Information for Resource Management System): https://firms.modaps.eosdis.nasa.gov/

## Resumo
O FIRMS distribui dados de focos ativos de fogo detectados por sensores orbitais da NASA. Cada foco representa uma anomalia termica observada da orbita, com coordenadas, horario e atributos de qualidade. Os dados sao disponibilizados em modo quase tempo real (NRT) e via downloads/APIs abertas, exigindo apenas uma MAP_KEY gratuita para acesso programatico.

## Conceitos importantes
- Sensores MODIS (satelites Terra e Aqua) e VIIRS (Suomi NPP, NOAA-20/21) detectam radiacao no infravermelho para identificar anomalias termicas associadas a fogo.
- Cada deteccao e um foco ("hotspot"): um pixel onde a temperatura indica fogo provavel, nao a area exata nem a confirmacao de incendio.
- Brilho (brightness): temperatura de brilho do pixel em Kelvin (canais como brightness/bright_ti4 no VIIRS), proporcional a intensidade termica observada.
- Confianca (confidence): no MODIS e percentual 0-100; no VIIRS e categorica (low / nominal / high). Indica a probabilidade de o foco ser fogo real, ajudando a filtrar falsos positivos.
- FRP (Fire Radiative Power): potencia radiativa do fogo em megawatts, usada como proxy da intensidade/energia liberada.
- Latencia NRT (Near Real-Time): dados geralmente disponiveis poucas horas apos a passagem do satelite; modos US/Canada (URT) e Ultra Real-Time reduzem ainda mais o atraso.
- Endpoint de area em CSV: a API permite consultar focos por bounding box e janela temporal (formato area CSV), retornando linhas com latitude, longitude, brilho, confianca, FRP, data e hora de aquisicao.
- MAP_KEY: chave gratuita obtida no portal FIRMS, obrigatoria para autenticar requisicoes a API.

## Como o OrbitGuard usa
O OrbitGuard consome o endpoint de area em CSV do FIRMS usando uma MAP_KEY gratuita para coletar focos MODIS/VIIRS de uma regiao em modo NRT. Os campos de brilho, confianca e FRP alimentam o calculo de risco, com filtragem por confianca para reduzir falsos positivos. Os resultados sao apoio a decisao para priorizar inspecao e monitoramento, nao constituindo alerta oficial nem confirmacao de incendio.
