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
| Vitrus Ambiente | email do mentor | 21 de outubro de 2026 (valores de 2025) | 43 051 t de RSU recolhidas; 5,4% de têxtil (APA); não há contentores de têxteis. Ver [Respostas da Vitrus de 21 out 2026](#respostas-da-vitrus-de-21-out-2026) (a base da procura foi substituída a 22 out) |
| Vitrus Ambiente | respostas do mentor | 22 de outubro de 2026 | O saco não pode ir no compactador; não há viaturas livres à tarde; tratamento a 105,64 €/t; depósito em Polvoreira; procura com 5,86% sobre o indiferenciado do concelho todo. Ver [Respostas da Vitrus de 22 out 2026](#respostas-da-vitrus-de-22-out-2026) |
| Vitrus Ambiente | Relatório e Contas 2025, p. 8 | 2025 | 43 050,5 t de indiferenciado recolhido pela Vitrus, 84,0% do concelho |
| APA | Relatório Anual de Resíduos Urbanos 2025, p. 24 | 2025 | 5,86% de têxtil no indiferenciado (média nacional) |

Cada ficheiro tem impressão digital (SHA-256), data de receção e período registados em `data/processed/sources.json` e visíveis no ecrã "Qualidade dos dados".

## O que os dados dizem

| Resultado | Valor |
| --- | --- |
| Têxtil recolhido à parte em 2025 | 301,3 t (0,16 kg/hab/mês) |
| Indiferenciado recolhido pela Vitrus em 2025 | 43 050,5 t, 84,0% do concelho (Relatório e Contas 2025, p. 8) |
| Indiferenciado do concelho em 2025 | ≈ 51 250,6 t (43 050,5 ÷ 0,840), estimativa |
| Destino | reutilização 59,4% (179,0 t), reciclagem 26,5% (79,9 t), rejeito 14,1% (42,3 t) |
| População | 156 830 habitantes em 48 freguesias (soma do INE) |
| Têxtil por desviar (51 250,6 t × 5,86%) | ≈ 3 003,3 t por ano (1,596 kg/hab/mês), estimativa |
| Têxtil gerado e captura atual | ≈ 3 304,6 t por ano; captura ≈ 9,1%, estimativa |
| Tratamento do indiferenciado em aterro | 105,64 €/t (40 €/t de taxa de gestão de resíduos + 65,64 €/t da Resinorte; Vitrus, 22 out 2026) |
| Circuitos | 40; no ficheiro, 9 sem viatura atribuída, mas a Vitrus confirmou a 22 out que os circuitos PAP têm viatura (erro da folha) |
| Viaturas | 29, duas nunca atribuídas no ficheiro (`29-48-XU`, `74-HN-36`); nenhuma livre à tarde (Vitrus, 22 out 2026) |
| Depósito | Estaleiro Operacional da Rua das Lameiras, Polvoreira (Vitrus, 22 out 2026) |
| Turnos | 101 por semana |
| Localidades | 82 com pelo menos um circuito; 79 com coordenadas e freguesia CAOP 2019 desde 22 out 2026 (antes 71 geocodificadas e 61 com freguesia), 3 por resolver (alerta 102) |
| Contentores municipais (não são de têxteis) | 2 754 linhas, 2 751 aceites, 2 722 localizados, 2 026 locais, 17,4 por 1 000 hab. |
| Freguesias CAOP 2019 | 48, 24 099,97 ha (241,0 km²) |

## Qualidade e limites

- **Método por entidade.** H Sarah Trading e Ultriplo enviaram quilos exatos por destino (`weighed`); Nova Etapa e Vitrus enviaram percentagens de relatórios aplicadas ao total (`percentage`). Os números destas duas levam a etiqueta "estimativa" no ecrã. O rejeito de 56,9% da Vitrus vem de uma amostra de 5,6 t.
- **Doze alertas** no ficheiro de circuitos, guardados em `data_alerts` e resolvíveis no ecrã (por exemplo: circuitos sem viatura, códigos V1 a V4 por trocar por matrículas, serviços como SELETIVO, PAYT ou CARTÃO sem localidades nem dias, matrículas duplicadas ou suspeitas).
- **Datas diferentes.** A semana útil, o sábado e o domingo não são da mesma semana; o planeamento de fim de semana tem de ser confirmado.
- **Geocodificação.** Algumas "localidades" dos circuitos (por exemplo "Ruas Estreitas") não são lugares e ficam sem coordenadas; o mapa usa as 71 que existem.
- **Sem custos das viaturas.** A Vitrus ainda não indicou custo por hora ou por quilómetro; a 21 de outubro o mentor pediu-os ao departamento financeiro e a 22 ainda não tinham chegado. Os custos do simulador são pressupostos marcados como tal em `features/planning/params.py` e no ecrã "Pressupostos". O custo de tratamento (105,64 €/t) já é dado da Vitrus.
- **Turnos.** A folha de turnos tem um erro: as viaturas estão em uso à tarde e os circuitos PAP que pareciam sem viatura também a têm (Vitrus, 22 out). As contagens de viaturas livres feitas sobre `shifts.csv` não valem.
- **Sazonalidade.** Os quilos de têxtil por mês só se partilham com o município (Vitrus, 22 out): o modelo usa o total anual.
- **Contentores de têxteis.** Não existem: a Vitrus não os tem e não os quer (21 de outubro). Deixou de ser uma lacuna. A tabela `containers` e o `containers.py` ficam só por compatibilidade.
- **Contentores municipais (pacote QGIS, 20 de outubro).** São outra rede (indiferenciado, orgânico, seletivo) e são a base geográfica do modelo. Vinte e cinco alertas em `municipal_alerts.csv`; os principais: cabeçalhos de coordenadas trocados em 3 de 5 ficheiros (corrigido linha a linha pelo intervalo), 29 contentores sem coordenadas, 509 com coordenadas de 3 casas decimais, 166 escritas diferentes de freguesia (conta o polígono, não o texto), 79 contentores a mais de 1 km da freguesia declarada, capacidades "???" e sem unidade, 1 linha vazia e 2 pontos fora do concelho (rejeitados). A Vitrus confirmou a 21 de outubro que o pacote junta indiferenciado, orgânico e seletivo; a fração de cada contentor de profundidade e superfície continua sem campo.
- **Contornos das freguesias.** Os contornos OSM de `parishes.geojson` falham 3 uniões de freguesias e têm 1 minúscula; a CAOP 2019 do pacote (`caop_guimaraes.geojson`) tem as 48. As 5 uniões têm Dicofre oficial na CAOP (`030876`, `030881`, `030883`, `030884`, `030890`) onde a app tem os provisórios `0308U1` a `0308U5`: ligam-se por nome até a Vitrus/INE confirmarem.
- **Códigos provisórios.** Os códigos de zona `0308U1` a `0308U5` da tipologia são provisórios até à validação com o INE; a CAOP 2019 já traz códigos oficiais para essas cinco freguesias (ver acima).

## Respostas da Vitrus de 21 out 2026

O mentor respondeu por email a três perguntas. As respostas mudam a base da procura e a forma da rede.

> **Substituído a 22 de outubro.** A base da procura desta secção (43 051 t × 5,4% = 2 324,8 t, 11,5%) e a recolha "nos circuitos" deixaram de valer. Fica como histórico; ver [Respostas da Vitrus de 22 out 2026](#respostas-da-vitrus-de-22-out-2026).

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

## Respostas da Vitrus de 22 out 2026

O mentor (Lucas Nascimento) respondeu às perguntas do email de 22 de outubro. As respostas invalidam o saco no camião do porta a porta e o plano B das viaturas livres, e mudam a base da procura.

| # | Pergunta | Resposta da Vitrus | O que muda |
| --- | --- | --- | --- |
| 1 | O saco de têxtil pode ir no camião do porta a porta? | **Não.** Vai para a caixa de compactação e estraga-se. Cabine, gancho ou caixa lateral também não são possíveis. O caminho é "a aquisição de um meio novo de recolha" | Sai o saco no compactador. A rede passa a ter **uma viatura de têxtil nova, sem compactação** |
| 2 | Um compactador pode fazer uma volta só de têxtil? | **Não**, por contaminação | Nenhuma viatura atual serve para têxtil |
| 3 | Há viaturas livres à tarde? | **Não.** A folha de turnos tem um erro: as viaturas estão em uso à tarde. O mesmo vale para os circuitos PAP que pareciam sem viatura | Cai o plano B "pelo menos 15 viaturas sem circuito numa tarde de dia útil" |
| 4 | Custos por hora e por km das viaturas | O departamento financeiro ainda não os enviou | Continuam pressupostos, com variação de ±30% |
| 5 | Custo de tratamento do indiferenciado | 40 €/t de taxa de gestão de resíduos (TGR) + 65,64 €/t de tarifa da Resinorte = **105,64 €/t** em aterro | Cada tonelada desviada do lixo poupa 105,64 €: custo evitado que se põe ao lado do custo de cada cenário |
| 6 | Depósito | **Estaleiro Operacional da Rua das Lameiras, Polvoreira** | Origem e fim das rotas |
| 7 | Base da procura | Usar **5,86%** (APA, RARU 2025, p. 24) sobre o indiferenciado do **concelho todo** | Nova procura (abaixo). A base de 21 out deixa de se usar |
| 8 | Sazonalidade | Os quilos por mês só se partilham com o município | O modelo continua anual |

**Números novos** (cálculo nosso sobre os valores da Vitrus e da APA; tudo **estimativa** exceto os dados de origem):

| Facto | Valor | Cálculo |
| --- | --- | --- |
| Indiferenciado recolhido pela Vitrus em 2025 | 43 050,5 t | Vitrus, Relatório e Contas 2025, p. 8 |
| Parte do concelho que a Vitrus recolhe | 84,0% | idem |
| Indiferenciado do concelho | ≈ 51 250,6 t | 43 050,5 ÷ 0,840 = 51 250,595 |
| Têxtil no indiferenciado | 5,86% | APA, RARU 2025, p. 24 (média nacional) |
| Têxtil que ainda vai para o lixo (por desviar) | ≈ 3 003,3 t/ano | 51 250,595 × 0,0586 = 3 003,285 |
| Por habitante | ≈ 1,596 kg/hab/mês (19,15 kg/hab/ano) | 3 003 285 kg ÷ 156 830 ÷ 12 = 1,5958 |
| Recolhido à parte em 2025 | 301,3 t | Dados Vitrus (inalterado) |
| Têxtil gerado | ≈ 3 304,6 t/ano | 3 003,285 + 301,27 = 3 304,555 |
| Captura atual | ≈ 9,1% | 301,27 ÷ 3 304,555 = 9,12%; cerca de 9 em cada 10 kg vão para o lixo |
| Tratamento evitado por tonelada desviada | 105,64 €/t | 40 + 65,64 (Vitrus) |

**Leitura.** A procura sobe cerca de 29% face à base de 21 de outubro (3 003,3 contra 2 324,8 t) por duas razões: conta o concelho todo, e não só os 84,0% que a Vitrus recolhe, e usa os 5,86% de 2025 em vez de 5,4%. Com a nova base, Guimarães capta cerca de um em cada onze quilos de têxtil.

**O que isto diz à rede.** O têxtil não pode viajar nas viaturas que já existem. A rede passa a ter uma viatura de têxtil nova, sem compactação, com partida do depósito de Polvoreira: recolhe o saco fechado à porta num dia fixo por freguesia e para nos locais municipais existentes e nas escolas, sem contentores novos. O custo de tratamento evitado (105,64 €/t) cobre parte do custo de operação. Os novos números dos cenários saem do modelo revisto e são estimativa.

## Verificação em fontes públicas (22 out 2026)

Antes de perguntar à Vitrus, procurámos o que já é público e pedimos confirmação no email de 22 de outubro. A Vitrus confirmou no mesmo dia a base nova, o tratamento e o depósito (ver [abaixo](#respostas-da-vitrus-de-22-out-2026)).

| Ponto | O que encontrámos | Fonte | Efeito |
| --- | --- | --- | --- |
| Origem dos 5,4% | Média por circuito do estudo do Laboratório da Paisagem e da CM Guimarães sobre a caracterização de 2016 (23 circuitos; a mediana é 4,5%). É a mesma fonte dos 0,7 kg/hab/mês | Perebynos, Sepúlveda e Ribeiro, *Waste Disposal & Sustainable Energy*, 2023, p. 5 | Não é um valor da APA; a APA dá 5,86% para o indiferenciado nacional em 2025 (RARU 2025, p. 24). **Confirmado a 22 out:** a procura passa a usar 5,86% |
| 43 051 t | São 84,0% do indiferenciado recolhido no concelho | Vitrus, Relatório e Contas 2025, p. 8 | Com o concelho todo seriam cerca de 51 250 t. **Confirmado a 22 out:** a procura usa o concelho todo (51 250,6 t × 5,86% ≈ 3 003,3 t) |
| Tratamento do indiferenciado | Guimarães entrega à Resinorte; tarifa de 65,64 €/t em 2024 e 2025; taxa de gestão de resíduos de 40 €/t em 2026 para aterro | RARU 2024, p. 147; tarifários e R&C 2025 da Resinorte; tabela APA 2026 | **Confirmado a 22 out:** 40 €/t + 65,64 €/t = 105,64 €/t por tonelada de indiferenciado em aterro |
| Depósito | Estaleiro Operacional na Rua das Lameiras, Polvoreira | vitrusambiente.pt/contactos | **Confirmado a 22 out** como depósito das rotas |
| Quem recolhe têxteis | A To Be Green recolhe nos contentores das escolas (RRRCICLO); H Sarah, Ultriplo e Nova Etapa trabalham com contentores próprios noutros concelhos | Plano URBACT, pp. 56–57; EWWR; protocolos municipais | Explica a qualidade por entidade (9,2% a 72,9% de reutilização); por confirmar em Guimarães |

Relatório completo da pesquisa, com páginas e citações, guardado fora do repositório durante o hackathon; resumo no registo de afirmações.

## Onde se usa cada dado

| Dado | Ecrã ou função |
| --- | --- |
| Têxtil recolhido e destino | Ponto de partida, Sankey observado, captura atual, receita (só reutilização) e €/t |
| Indiferenciado do concelho (2025) e 5,86% (APA) | Procura do modelo: têxtil por desviar por freguesia |
| Tratamento do indiferenciado (105,64 €/t) | Custo evitado por tonelada desviada, ao lado do custo de cada cenário |
| Depósito (Rua das Lameiras, Polvoreira) | Origem e fim das rotas da viatura de têxtil |
| Estradas do OpenStreetMap (não vêm da Vitrus; © colaboradores, ODbL) | Km e traçado das rotas pela estrada, num OSRM próprio ([Rotas por estrada](../engenharia/rotas-reais.md)); o porta a porta dentro da freguesia é estimativa por fórmula |
| População e freguesias | Procura por zona, simulador, mapa |
| TIPAU | Custo por tipo de território no relatório RAP |
| Circuitos, viaturas e turnos | Circuitos e Frota (contexto). Desde 22 out não sustentam a recolha de têxtil: o saco não vai no compactador e não há viaturas livres |
| Localidades geocodificadas | Mapa, ligação entre circuitos e freguesias |
| Alertas | Qualidade dos dados |
| Contentores municipais, locais e produtores | Onde o têxtil se perde no lixo e onde a viatura de têxtil pode parar: locais candidatos (sem contentor novo), procura por local, B2B (hotelaria, lares, escolas, grandes produtores), densidade por freguesia, mapa |
| CAOP 2019 | Geometria das freguesias, área em km², atribuição de freguesia por ponto |

## Regra

Um valor ou vem destes ficheiros, ou está em [Dados e modelo](../engenharia/dados-e-modelo.md) como pressuposto com fonte, ou leva a etiqueta "estimativa" no ecrã.
