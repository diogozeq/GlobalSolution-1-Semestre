# NASA POWER — Dados Meteorologicos Diarios

## Fonte oficial
[NASA POWER — Prediction Of Worldwide Energy Resources](https://power.larc.nasa.gov/)

## Resumo
O NASA POWER disponibiliza series temporais de variaveis meteorologicas e de energia solar derivadas de reanalises e observacoes de satelite da NASA. Os dados cobrem qualquer ponto do planeta por coordenadas (latitude/longitude), com granularidade diaria, mensal e climatologica. Sao acessiveis de forma aberta via API REST, sem custo e sem necessidade de estacao meteorologica local.

## Conceitos importantes
- `PRECTOTCORR`: precipitacao total corrigida na superficie, expressa em milimetros por dia (mm/dia); base para calcular chuva acumulada.
- `T2M`: temperatura do ar a 2 metros da superficie, em graus Celsius.
- `RH2M`: umidade relativa do ar a 2 metros, em porcentagem; valores baixos favorecem o ressecamento da vegetacao.
- `WS2M`: velocidade do vento a 2 metros, em metros por segundo; influencia a propagacao do fogo.
- Serie diaria: cada parametro retorna um valor por dia, permitindo reconstruir o historico recente de uma regiao.
- Chuva acumulada: soma de `PRECTOTCORR` ao longo de uma janela de dias para estimar a umidade disponivel no solo e na vegetacao.
- Dias secos consecutivos: contagem de dias com precipitacao abaixo de um limiar, indicador de aumento do risco de queimada.
- Latencia: os dados sao consolidados com alguns dias de defasagem, o que deve ser considerado ao interpretar o periodo mais recente.

## Como o OrbitGuard usa
O OrbitGuard consulta a API do NASA POWER por coordenadas para obter a serie diaria de `PRECTOTCORR`, `T2M`, `RH2M` e `WS2M` da regiao monitorada. A partir dessas variaveis o sistema calcula chuva acumulada e o numero de dias secos consecutivos, que alimentam o indicador de risco de queimada combinado com os focos de calor orbitais. O OrbitGuard e uma ferramenta de apoio a decisao e demonstracao academica (POC FIAP); nao constitui alerta oficial nem substitui orgaos competentes como INPE, Defesa Civil ou Corpo de Bombeiros.
