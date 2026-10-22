# Análise dos dados recebidos

Tudo o que o Novelo calcula parte destes ficheiros. Os originais ficam em `data/raw/` e nunca se editam; `just etl` produz `data/processed/`, e a API importa-o para o Postgres no arranque.

## Fontes

| Fonte | Ficheiro | Período | Conteúdo |
| --- | --- | --- | --- |
| Vitrus Ambiente | `data/raw/dados_textil.xlsx` | 2025 | Têxtil recolhido por entidade e destino; composição dos resíduos urbanos |
| Vitrus Ambiente | `data/raw/Circuitos_Viaturas_Guimaraes.xlsx` | semana de 21 a 25/09/2026 (mais o fim de semana anterior) | Circuitos, viaturas, localidades e turnos |
| INE | `data/raw/public/population_ine.json` | Censos 2021 | População residente por freguesia |
| INE | `data/raw/public/tipau.json` | Tipologia de Áreas Urbanas | Predominantemente urbana, mediamente urbana ou rural, por freguesia |
| CAOP e OpenStreetMap | `data/raw/public/parishes.geojson` | atual | Contornos das freguesias |
| OpenStreetMap (Nominatim) | `data/raw/public/localities_geocoded.json` | atual | Coordenadas das localidades dos circuitos |
| Vitrus Ambiente | `data/raw/vitrus-mapa-qgis/` (5 `.txt`, projeto QGIS, CAOP 2019) | recebido a 20 de outubro de 2026; inventário sem data (projeto QGIS de maio de 2025) | Contentores **municipais** de indiferenciado, orgânico e recolha seletiva, enterrados ou de superfície (ficheiros de profundidade, superfície, orgânico, resíduos verdes), e contornos oficiais das freguesias. **Não são de têxteis.** Ver [Análise dos contentores municipais](analise-contentores-municipais.md) |
| Vitrus Ambiente | email do mentor | 21 de outubro de 2026 (valores de 2025) | 43 051 t de RSU recolhidas; 5,4% de têxtil (APA); não há contentores de têxteis. Ver [Respostas da Vitrus de 21 out 2026](#respostas-da-vitrus-de-21-out-2026) |

Cada ficheiro tem impressão digital (SHA-256), data de receção e período registados em `data/processed/sources.json` e visíveis no ecrã "Qualidade dos dados".

## O que os dados dizem

| Resultado | Valor |
| --- | --- |
| Têxtil recolhido à parte em 2025 | 301,3 t (0,16 kg/hab/mês) |
| RSU recolhido pela Vitrus em 2025 | 43 051 t |
| Destino | reutilização 59,4% (179,0 t), reciclagem 26,5% (79,9 t), rejeito 14,1% (42,3 t) |
| População | 156 830 habitantes em 48 freguesias (soma do INE) |
| Têxtil por desviar (43 051 t × 5,4%) | ≈ 2 324,8 t por ano (1,235 kg/hab/mês), estimativa |
| Têxtil gerado e captura atual | ≈ 2 626,0 t por ano; captura ≈ 11,5%, estimativa |
| Circuitos | 40, dos quais 9 sem viatura atribuída no planeamento |
| Viaturas | 29, duas nunca atribuídas (`29-48-XU`, `74-HN-36`) |
| Turnos | 101 por semana |
| Localidades | 82 com pelo menos um circuito; 79 com coordenadas e freguesia CAOP 2019 desde 22 out 2026 (antes 71 geocodificadas e 61 com freguesia), 3 por resolver (alerta 102) |
| Contentores municipais (não são de têxteis) | 2 754 linhas, 2 751 aceites, 2 722 localizados, 2 026 locais, 17,4 por 1 000 hab. |
| Freguesias CAOP 2019 | 48, 24 099,97 ha (241,0 km²) |

## Qualidade e limites

- **Método por entidade.** H Sarah Trading e Ultriplo enviaram quilos exatos por destino (`weighed`); Nova Etapa e Vitrus enviaram percentagens de relatórios aplicadas ao total (`percentage`). Os números destas duas levam a etiqueta "estimativa" no ecrã. O rejeito de 56,9% da Vitrus vem de uma amostra de 5,6 t.
- **Doze alertas** no ficheiro de circuitos, guardados em `data_alerts` e resolvíveis no ecrã (por exemplo: circuitos sem viatura, códigos V1 a V4 por trocar por matrículas, serviços como SELETIVO, PAYT ou CARTÃO sem localidades nem dias, matrículas duplicadas ou suspeitas).
- **Datas diferentes.** A semana útil, o sábado e o domingo não são da mesma semana; o planeamento de fim de semana tem de ser confirmado.
- **Geocodificação.** Algumas "localidades" dos circuitos (por exemplo "Ruas Estreitas") não são lugares e ficam sem coordenadas; o mapa usa as 71 que existem.
- **Sem custos.** A Vitrus ainda não indicou custo por recolha ou por quilómetro; a 21 de outubro o mentor pediu-os ao departamento financeiro (não estão no site). Os custos do simulador são pressupostos marcados como tal em `features/planning/params.py` e no ecrã "Pressupostos".
- **Contentores de têxteis.** Não existem: a Vitrus não os tem e não os quer (21 de outubro). Deixou de ser uma lacuna. A tabela `containers` e o `containers.py` ficam só por compatibilidade.
- **Contentores municipais (pacote QGIS, 20 de outubro).** São outra rede (indiferenciado, orgânico, seletivo) e são a base geográfica do modelo. Vinte e cinco alertas em `municipal_alerts.csv`; os principais: cabeçalhos de coordenadas trocados em 3 de 5 ficheiros (corrigido linha a linha pelo intervalo), 29 contentores sem coordenadas, 509 com coordenadas de 3 casas decimais, 166 escritas diferentes de freguesia (conta o polígono, não o texto), 79 contentores a mais de 1 km da freguesia declarada, capacidades "???" e sem unidade, 1 linha vazia e 2 pontos fora do concelho (rejeitados). A Vitrus confirmou a 21 de outubro que o pacote junta indiferenciado, orgânico e seletivo; a fração de cada contentor de profundidade e superfície continua sem campo.
- **Contornos das freguesias.** Os contornos OSM de `parishes.geojson` falham 3 uniões de freguesias e têm 1 minúscula; a CAOP 2019 do pacote (`caop_guimaraes.geojson`) tem as 48. As 5 uniões têm Dicofre oficial na CAOP (`030876`, `030881`, `030883`, `030884`, `030890`) onde a app tem os provisórios `0308U1` a `0308U5`: ligam-se por nome até a Vitrus/INE confirmarem.
- **Códigos provisórios.** Os códigos de zona `0308U1` a `0308U5` da tipologia são provisórios até à validação com o INE; a CAOP 2019 já traz códigos oficiais para essas cinco freguesias (ver acima).

## Respostas da Vitrus de 21 out 2026

O mentor respondeu por email a três perguntas. As respostas mudam a base da procura e a forma da rede.

| Pergunta | Resposta | O que muda |
| --- | --- | --- |
| Contentores de têxteis | A Vitrus não os tem nem os quer. O têxtil de contentor vem contaminado e perde a reutilização. A reciclagem é muito mais cara que a fibra virgem | A rede proposta é sem contentores: local existente sem contentor novo e recolha a pedido nos circuitos. O contentor de rua fica só como referência (benchmark francês) |
| O que traz o pacote QGIS | Todos os contentores de indiferenciado, orgânico e recolha seletiva, enterrados ou de superfície. Não há dados de deposição de têxtil por contentor | Os contentores municipais são a base geográfica: onde o têxtil se perde e onde a viatura já passa |
| Quanto têxtil há | Em 2025 a Vitrus recolheu 43 051 t de RSU; contar 5,4% de têxtil (APA). O mentor não conhece o Plano de Ação Integrado (URBACT) | Nova procura (abaixo). O plano deixa de ser fonte de números |
| Custos unitários | Não estão no site; o mentor vai pedi-los ao departamento financeiro | Continuam pressupostos |

**Números novos** (cálculo nosso sobre os valores da Vitrus e da APA; tudo **estimativa** exceto os dados da Vitrus):

| Facto | Valor | Cálculo |
| --- | --- | --- |
| RSU recolhido em 2025 | 43 051 t | Vitrus |
| Têxtil no RSU | 5,4% | APA, indicado pela Vitrus |
| Têxtil que ainda vai para o lixo (por desviar) | 2 324,8 t/ano | 43 051 × 0,054 = 2 324,754 |
| Por habitante | 1,235 kg/hab/mês (14,82 kg/hab/ano) | 2 324 754 kg ÷ 156 830 ÷ 12 |
| Recolhido à parte em 2025 | 301,3 t | Dados Vitrus (inalterado) |
| Têxtil gerado | 2 626,0 t/ano | 2 324,754 + 301,27 = 2 626,024 |
| Captura atual | 11,5% | 301,27 ÷ 2 626,024 = 11,47% |

**Leitura.** As 301,3 t foram recolhidas à parte, fora do RSU. Os 5,4% aplicam-se às 43 051 t de RSU, por isso medem o têxtil que ainda se perde no lixo. A base antiga (0,7 kg/hab/mês, ≈ 1 317 t, captura 22,9%) dava pouco mais de metade do têxtil que agora se estima por desviar (1 317 contra 2 324,8 t). Com a nova base, Guimarães capta cerca de um em cada nove quilos de têxtil.

**O que isto diz à rede.** O valor está na reutilização: têxtil limpo e seco. Um contentor na rua junta chuva e lixo. Por isso o modelo oferece só `existing` (entrega em locais com pessoas, ou paragem nos locais municipais onde a viatura já passa, com sacos fechados recolhidos no momento) e `on_demand` (porta a porta nos circuitos). A triagem por foto passa a ser controlo de qualidade na entrega. A bolsa de fibra desce na prioridade.

## Verificação em fontes públicas (22 out 2026)

Antes de perguntar à Vitrus, procurámos o que já é público. Pedimos confirmação no email de 22 de outubro; até lá **o modelo não muda** (segue a indicação do mentor: 43 051 t × 5,4%).

| Ponto | O que encontrámos | Fonte | Efeito |
| --- | --- | --- | --- |
| Origem dos 5,4% | Média por circuito do estudo do Laboratório da Paisagem e da CM Guimarães sobre a caracterização de 2016 (23 circuitos; a mediana é 4,5%). É a mesma fonte dos 0,7 kg/hab/mês | Perebynos, Sepúlveda e Ribeiro, *Waste Disposal & Sustainable Energy*, 2023, p. 5 | Não é um valor da APA; a APA dá 5,86% para o indiferenciado nacional em 2025 (RARU 2025, p. 24) |
| 43 051 t | São 84,0% do indiferenciado recolhido no concelho | Vitrus, Relatório e Contas 2025, p. 8 | Com o concelho todo seriam cerca de 51 250 t e 2 768 t de têxtil (cálculo nosso). A procura do modelo é, por isso, **conservadora** |
| Tratamento do indiferenciado | Guimarães entrega à Resinorte; tarifa de 65,64 €/t em 2024 e 2025; taxa de gestão de resíduos de 40 €/t em 2026 para aterro | RARU 2024, p. 147; tarifários e R&C 2025 da Resinorte; tabela APA 2026 | Base para a poupança no tratamento, que fica "por validar" até a Vitrus confirmar quem paga e quanto |
| Depósito | Estaleiro Operacional na Rua das Lameiras, Polvoreira | vitrusambiente.pt/contactos | O modelo ainda usa o centro de Guimarães (pressuposto) até confirmação |
| Quem recolhe têxteis | A To Be Green recolhe nos contentores das escolas (RRRCICLO); H Sarah, Ultriplo e Nova Etapa trabalham com contentores próprios noutros concelhos | Plano URBACT, pp. 56–57; EWWR; protocolos municipais | Explica a qualidade por entidade (9,2% a 72,9% de reutilização); por confirmar em Guimarães |

Relatório completo da pesquisa, com páginas e citações, guardado fora do repositório durante o hackathon; resumo no [registo de afirmações](../pesquisa/registo-de-afirmacoes.md).

## Onde se usa cada dado

| Dado | Ecrã ou função |
| --- | --- |
| Têxtil recolhido e destino | Ponto de partida, Sankey observado, captura atual, receita (só reutilização) e €/t |
| RSU de 2025 e 5,4% (APA) | Procura do modelo: têxtil por desviar por freguesia |
| População e freguesias | Procura por zona, simulador, mapa |
| TIPAU | Custo por tipo de território no relatório RAP |
| Circuitos, viaturas e turnos | Circuitos, Frota, recolha a pedido sem km novos |
| Localidades geocodificadas | Mapa, ligação entre circuitos e freguesias |
| Alertas | Qualidade dos dados |
| Contentores municipais, locais e produtores | Onde o têxtil se perde no lixo e onde a viatura já passa: locais candidatos (sem contentor novo), procura por local, B2B (hotelaria, lares, escolas, grandes produtores), densidade por freguesia, mapa |
| CAOP 2019 | Geometria das freguesias, área em km², atribuição de freguesia por ponto |

## Regra

Um valor ou vem destes ficheiros, ou está em [Dados e modelo](../engenharia/dados-e-modelo.md) como pressuposto com fonte, ou leva a etiqueta "estimativa" no ecrã.
