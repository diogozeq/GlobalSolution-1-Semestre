# Glossario OrbitGuard

## Fonte oficial
https://orbitguard.local/glossario

## Resumo
Este glossario define os termos tecnicos centrais do OrbitGuard AI, uma POC FIAP de monitoramento de risco de queimadas a partir de dados orbitais. Padroniza vocabulario entre dados de sensoriamento remoto, indices ambientais e os componentes de software (IA, RAG, adapters e fixtures). O objetivo e apoiar a interpretacao consistente das saidas do sistema.

## Conceitos importantes
- **Foco de calor**: ponto na superficie detectado por sensores orbitais como anomalia termica, indicando possivel combustao ativa. E um indicio, nao uma confirmacao de incendio.
- **FRP (Fire Radiative Power)**: potencia radiativa do fogo, medida em megawatts, que estima a intensidade energetica de um foco de calor. Valores maiores sugerem combustao mais intensa.
- **NDVI (Normalized Difference Vegetation Index)**: indice de vegetacao calculado a partir das bandas vermelha e infravermelho proximo, variando de -1 a 1. Valores altos indicam vegetacao densa e saudavel; valores baixos, vegetacao escassa ou estressada.
- **Deficit hidrico**: condicao em que a disponibilidade de agua no solo e na vegetacao fica abaixo da demanda, elevando a inflamabilidade do material vegetal.
- **Score de risco 0-100**: indicador numerico agregado calculado pelo OrbitGuard, onde 0 representa risco minimo e 100 risco maximo de queimada.
- **Niveis de risco**: faixas qualitativas derivadas do score, classificadas como Baixo, Moderado, Alto e Critico, para facilitar a leitura por tomadores de decisao.
- **RAG (Retrieval-Augmented Generation)**: tecnica que recupera trechos relevantes de uma base de conhecimento e os fornece como contexto para a geracao de respostas por IA, reduzindo respostas sem fundamento.
- **IA Generativa**: modelo de linguagem que produz texto explicativo a partir do contexto recuperado, usado para interpretar e comunicar os resultados.
- **Adapter**: componente de software que isola e padroniza o acesso a uma fonte externa (sensores, indices, modelos), permitindo trocar a origem sem alterar a logica central.
- **Fixture**: conjunto de dados de teste fixos e reproduziveis, usado para validar o comportamento do sistema sem depender de servicos externos.

## Como o OrbitGuard usa
O OrbitGuard combina foco de calor, FRP, NDVI e deficit hidrico em um score de risco 0-100, traduzido nos niveis Baixo, Moderado, Alto e Critico. Adapters padronizam a entrada de dados e fixtures garantem testes reproduziveis, enquanto RAG e IA Generativa explicam os resultados com base nesta base de conhecimento. As saidas sao apoio a decisao, nao constituem alerta oficial nem substituem orgaos competentes.
