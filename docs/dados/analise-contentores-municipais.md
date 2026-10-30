# Análise dos contentores municipais (pacote QGIS da Vitrus)

Recebido a **20 de outubro de 2026**. Fica em `data/raw/vitrus-mapa-qgis/` (só leitura, versionado no Git). `just etl` produz os ficheiros `municipal_*` e `caop_guimaraes.geojson` em `data/processed/`. Os números abaixo vêm de `data/processed/municipal_summary.json`; se o ETL mudar, este documento muda no mesmo commit.

> **Nada neste pacote é de têxteis.** São os contentores **municipais** de indiferenciado, orgânico e recolha seletiva, enterrados ou de superfície (Vitrus, 21 de outubro de 2026). **Não há contentores de têxteis**: a Vitrus não os tem nem os quer, porque o têxtil de contentor vem contaminado e perde a reutilização. Este pacote é, por isso, a **base geográfica** do modelo: mostra onde o têxtil se perde no lixo e onde a viatura de têxtil pode parar. Tem o seu próprio ETL (`scripts/etl/municipal_containers.py`) e os seus próprios ficheiros (`municipal_*`); `containers.py` fica só por compatibilidade.

## Para que serve

| Uso | Como |
| --- | --- |
| 1. Locais candidatos (sem contentor novo) e procura por local | 1 187 locais com contentor municipal de rua (profundidade, superfície ou plataforma), 837 com coordenada precisa. São paragens possíveis para a viatura de têxtil nova (a 22 out a Vitrus disse que o saco não pode ir no compactador): uma paragem para recolher sacos fechados no momento não precisa de contentor (pressuposto). A procura de cada freguesia reparte-se por eles na proporção dos contentores |
| 2. Produtores com potencial têxtil | 922 contentores de orgânico de 6 tipos de produtor (restauração, escolas, estabelecimentos, grandes produtores, lares, hotelaria): recolha dedicada B2B (uniformes, roupa de cama, toalhas) |
| 3. Geometria oficial das freguesias | CAOP 2019 completa para as 48 freguesias (o OSM da app falha 3 e tem 1 minúscula) |
| 4. Referência de densidade | 17,4 contentores e 10,0 locais públicos por 1 000 habitantes; cobertura por distância |

## O que foi recebido

| Ficheiro | Linhas de dados | IDs | Campos | Notas |
| --- | ---: | --- | --- | --- |
| `Contentores de Profundidade.txt` | 593 | 1 a 593, únicos | `ID`, `tipologia`, `cap.`, `Freguesia`, `Rua`, `Coord. Y`, `Coord. X2` | molok 488 (1 com espaço no fim), bluebee 66, Greenbee 37, plataforma 2; 576 de 5 m³ e 17 de 3 m³ |
| `Contentores de Superfície.txt` | 795 | `C001`..., únicos | `ID`, `Capacidade`, `Nome`, `Freguesia`, `Coord_Y`, `Coord_X` | todos 1100 L; `Nome` é a rua; 3 sem coordenadas |
| `Contentores Orgânico - Coletivo.txt` | 397 | `BC1`... | `ID`, `tipologia`, `cap.`, `Material`, `Freguesia`, `Rua`, `Coord. Y`, `Coord. X` e uma coluna vazia (tabulação no fim) | `tipologia` sempre `superficie`, `Material` sempre `Orgânico`; 1100 L (281), 80 L (111), 360 L (5); 3 sem coordenadas |
| `Contentores Orgânico - Tipologia.txt` | 923 | `B1`... | `ID`, `Capacidade`, `Tipologia`, `Nome`, `Freguesia`, `Coord_Y`, `Coord_X` | produtores; `Nome` é o estabelecimento; capacidades 10 a 1100 **sem unidade**; 24 sem coordenadas; 1 linha vazia |
| `Contentores Resíduos Verdes.txt` | 46 | `BC279` a `BC356` (46 deles) | `ID`, `tipologia`, `cap.`, `Freguesia`, `Rua`, `Quantidade`, `Coord. Y`, `Coord. X` | todos superfície 1100 L; `Quantidade` de 1 a 7 (soma 95); sobretudo cemitérios |
| `Georreferenciação.qgz` | | | | Projeto QGIS 3.36.2 guardado a 9 de maio de 2025: 5 camadas de texto delimitado, o contorno de Guimarães (filtro `"Concelho" LIKE 'GUIMARÃES'`) e OpenStreetMap como fundo. Projeto em ETRS89 / PT-TM06 |
| `Informação/Cont_AAD_CAOP2019/` | 3 223 polígonos | | `Dicofre`, `Freguesia`, `Concelho`, `Distrito`, `TAA`, `AREA_EA_Ha`, `AREA_T_Ha`, `Des_Simpli` | CAOP 2019 de **todo o país continental**, EPSG:3763; 48 polígonos são de Guimarães (24 099,97 ha). 50 MB |

Os 5 `.txt` são UTF-8 com CRLF e tabulações, sem aspas. IDs únicos em cada ficheiro. Os da orgânico coletivo (397) e dos resíduos verdes (46) formam **uma só série `BC1` a `BC443`**, sem buracos nem repetições: o ficheiro de resíduos verdes é um pedaço da mesma numeração.

### O que cada campo significa

| Campo | Significado | Como o ETL o usa |
| --- | --- | --- |
| `tipologia` (profundidade) | Marca/modelo do contentor enterrado ou semienterrado, ou `plataforma` | `brand` = molok, bluebee, greenbee; `plataforma` → `kind = platform` e sem marca |
| `cap.` / `Capacidade` | Volume. Profundidade em m³, restantes em litros; Tipologia sem unidade | `capacity_litres` (m³ × 1000). Sem unidade → litros, com alerta. `???`, `?` e vazio → nulo |
| `Freguesia` | Nome da freguesia **como escrito**, não um código | `declared_parish`. Nunca conta; conta o polígono |
| `Rua` / `Nome` | Rua (profundidade, coletivo, verdes), rua (superfície) ou estabelecimento (tipologia) | `street` ou `producer_name` |
| `Tipologia` (produtor) | Restauração, Escola, Estabelecimento, Grandes produtores, Lar, Hotelaria | `producer_type` e `producer_type_key` (restaurant, school, establishment, large_producer, care_home, hospitality) |
| `Quantidade` (verdes) | Número associado à linha (1 a 7). **Não sabemos** se é o número de contentores nesse local | `quantity`; `units_declared` do local usa-o |
| `Material` (coletivo) | Sempre `Orgânico` | `stream = organico` |
| `Coord. Y`, `Coord. X`, `Coord. X2`, `Coord_Y`, `Coord_X` | Coordenadas WGS84 em graus decimais. **Os nomes não são de fiar** (ver abaixo) | Cada linha é classificada pelo intervalo do valor |
| `Dicofre` (CAOP) | Código único da freguesia: 2 dígitos de distrito, 2 de concelho, 2 de freguesia (`0308xx` em Guimarães) | `parish_dicofre` |
| `TAA` (CAOP) | Tipo de área administrativa: 1 principal, 3 secundária (separada da principal), 4 especial, 5 costeira, 7 águas interiores. Em Guimarães são as 48 "ÁREA PRINCIPAL" | Só informativo |
| `AREA_EA_Ha`, `AREA_T_Ha` | Área da entidade administrativa e total, em hectares. Iguais nas 48 | Conferidas com a área calculada |
| `Des_Simpli` | Designação simplificada, sem "União das freguesias de" | Dá os componentes de cada união para ligar nomes antigos |

## Contexto técnico (pesquisa)

**Molok, Blue Bee, Green Bee.** São contentores de deposição **enterrados** (profundidade) ou **semienterrados**, para reduzir o volume visível e o número de recolhas. A **Molok** (finlandesa) fabrica o semienterrado: cerca de 60% do contentor fica no subsolo, a cuba interior é de polietileno de alta densidade e existe em 1,3, 3 e 5 m³; fornecedores portugueses dizem que a necessidade de recolha desce até 90% face ao contentor de superfície comum [F65]. **Blue Bee, Green Bee e Red Bee** são a gama de contentores enterrados da **Lasso** (grupo Sopsa), em betão armado pré-fabricado C40/50, nas capacidades de **3 m³ e 5 m³**; o Green Bee tem altura total enterrada de 2,02 m (3 m³) e 2,76 m (5 m³) e a cuba pesa cerca de 3 e 4 toneladas [F63] [F64]. O ficheiro confirma isto: as capacidades são só 3 m³ (17) e 5 m³ (576), nunca 1,3 m³. **Plataforma** (2 casos) é o único tipo cujo significado os dados não explicam: pode ser uma plataforma de elevação do enterrado; fica por confirmar. O contentor de **superfície de 1 100 L** é o contentor de rodas corrente; 80, 360 e 1 100 L são as capacidades habituais dos contentores de rodas do orgânico.

**O que estes contentores implicam para os têxteis.** Confirmado em parte pela Vitrus a 21 de outubro (o têxtil de contentor vem contaminado e perde a reutilização): um enterrado de 5 m³ é desenhado para resíduo urbano comum e **não serve para têxtil** sem adaptação (o têxtil reutilizável não deve ser compactado nem molhado). O interesse do pacote é o **local** (acesso de camião e de utente já existente, licença municipal já dada), não o equipamento. Os 1 187 candidatos são pontos, não contentores: a viatura para, recolhe os sacos fechados e segue.

**CAOP.** Carta Administrativa Oficial de Portugal, da Direção-Geral do Território (DGT). Regista a delimitação oficial de distritos, concelhos e freguesias, em PT-TM06/ETRS89. A DGT publica versões anuais; a mais recente é a **CAOP2025**, aprovada a 28 de janeiro de 2026 (Aviso n.º 3502/2026/2) [F66]. O pacote traz a **CAOP 2019**. `AAD` quer dizer, muito provavelmente, "Área Administrativa" (a DGT publica o continente como "Área Administrativa (Polígonos)"), e "Cont" é Continente. Cada polígono tem `TAA` e `Dicofre` [F67]. Os 48 códigos de freguesia do INE (Censos 2021) coincidem com os da CAOP 2019 (43 diretamente, 5 por nome), por isso a CAOP 2019 serve para este fim; **não verificámos a CAOP2025** e a versão a usar deve ser confirmada (pergunta 9).

**Boas práticas de qualidade e geocodificação que seguimos.** A norma ISO 19157-1 organiza a qualidade de dados geográficos em completude, consistência lógica, exatidão posicional, qualidade temporal e exatidão temática [F68]; os alertas do ETL seguem essa divisão (completude: coordenadas em falta; consistência lógica: cabeçalhos trocados, freguesia vs polígono; exatidão posicional: precisão decimal, pontos fora do concelho; temática: capacidade, fração). Regras práticas: (1) nunca confiar no nome da coluna de coordenadas, validar pelo intervalo e pelo polígono; (2) trabalhar em coordenadas projetadas (EPSG:3763, metros) para distâncias e áreas, e em WGS84 só para publicar; (3) separar o que se corrigiu do que se assumiu e contar ambos; (4) conservar a linha de origem (`source_file`, `source_line`) para auditoria.

## Problemas encontrados e como foram tratados

| # | Problema | Quantas linhas | Tratamento | Onde fica registado |
| --- | --- | ---: | --- | --- |
| 1 | **Cabeçalhos de coordenadas trocados**: em Profundidade, Coletivo e Verdes a coluna "Y" traz a **longitude** e "X"/"X2" a **latitude**. Em Superfície e Tipologia estão certos. O projeto QGIS já compensava trocando `xField`/`yField` por ficheiro | 593 + 394 + 46 = 1 033 | Cada linha é classificada pelo intervalo (lat 36,5 a 42,5; lon -10 a -6; nunca se sobrepõem). Em **todas** as linhas do mesmo ficheiro a ordem é a mesma: não há linhas trocadas dentro de um ficheiro certo | `coord_swapped`; alerta `municipal_coords_swapped` |
| 2 | **Caracteres espúrios** numa coordenada: `-8.2899442Â` e um espaço não separável (`profundidade:381`) | 1 | Removidos; o valor numérico é o mesmo | `coord_cleaned`; alerta `municipal_coords_artifact` |
| 3 | **Sem coordenadas** | 29 (Superfície 3, Coletivo 3, Tipologia 23; `C792` e `C794` têm só ID e capacidade) | Ficam `pending`: contam como contentores, não entram no mapa nem nas contagens por freguesia | `coord_status`; `municipal_coords_missing` |
| 4 | **Coordenadas aproximadas** (3 casas decimais ou menos, ~100 m), quase todas em Superfície; pontos repetidos de várias ruas (ex.: 11 contentores "Escola Secundária" no mesmo ponto) | 509 | Usadas, mas assinaladas; o local herda `coord_precision = approximate` | `coord_precision`; `municipal_coords_low_precision` |
| 5 | **Fora do concelho** (> 50 m do contorno CAOP 2019) | 2 (`C617`, `C618`, "Tv de entre latas", declaradas em Figueiredo, a 453 m) | Rejeitadas com motivo e distância | `municipal_containers_rejected.csv` |
| 6 | **Quase no limite** (≤ 50 m fora): `C605` a 28 m, `B342` a 41 m | 2 | Aceites; atribuídas à freguesia mais próxima | `boundary_note`; `municipal_boundary_tolerance` |
| 7 | **Linha vazia** (linha 924 de Tipologia) | 1 | Rejeitada | `municipal_containers_rejected.csv` |
| 8 | **Capacidade "???", "?" ou vazia** | 10 | Nula; fora das somas de litros | `capacity_status = unknown`; `municipal_capacity_unknown` |
| 9 | **Capacidade sem unidade** (Tipologia: 10, 30, 45, 80, 1100) | 912 | Lida como litros (coerente com baldes e contentores de 1 100 L); **assumida**, com alerta | `capacity_status = assumed_litres`; `municipal_capacity_unit_assumed` |
| 10 | **Capacidade de 10 L** (5 contentores de produtores) | 5 | Mantida e assinalada (possível 110 L) | `municipal_capacity_outlier` |
| 11 | **Espaços e maiúsculas**: `molok ` (espaço), `Escola `, `Lar `, `80l `, nomes em MAIÚSCULAS, `Nome` com espaços no fim | vários | `clean_text` (espaços, NBSP) e comparação sem acentos nem maiúsculas. Os textos originais mantêm acentos e maiúsculas | `declared_parish`, `street`, `producer_name` |
| 12 | **Freguesia declarada inconsistente**: 166 escritas diferentes para 48 freguesias (69 só na Tipologia depois de normalizar; 103 como escritas), maiúsculas, abreviaturas (`S.Jorge de Selho`), uniões `UF ...`, nomes anteriores a 2013 (`Airão`, `Briteiros S. Salvador`, `Penselo`), erros (`São Torcado`, `Gomilhães`) | 2 751 | Normalização (sem acentos; `S.`, `Sta.`, `Sto.`, São, Santa e Santo tratados como equivalentes; sem `e`/`de`), liga a nomes completos e a componentes das uniões. Nunca se conta pelo texto | `parish_match_level`; `municipal_parish_names_inconsistent` |
| 13 | **Nomes que não são freguesias**: `Cidade` (41), `Penha` (7), `PEVIDÉM` (3), `Caldas das Taipas` (1) | 52 | `parish_match = nao_mapeada`; a freguesia vem do polígono. `Cidade` tem 42 linhas (41 com coordenadas): 35 caem na união de Oliveira, S. Paio e S. Sebastião, 3 em Urgezes, 2 em Creixomil e 1 em Azurém | `municipal_parish_unmapped` |
| 14 | **Freguesia declarada ≠ polígono** | 316 de 2 670 comparáveis (11,8%): 49 a ≤ 25 m, 57 a 26-100 m, 76 a 101-300 m, 55 a 301-1 000 m, **79 a mais de 1 km** | Prevalece o polígono. Os de > 1 km ficam `coord_suspect = true` (coordenada ou nome errados) | `parish_mismatch_distance_m`; `municipal_parish_mismatch`, `municipal_coord_suspect` |
| 15 | **Fração desconhecida** em Profundidade e Superfície (1 386 contentores): os ficheiros não dizem se é indiferenciado, reciclável ou outra | 1 386 | `stream = desconhecido`. Só `organico` (coletivo e produtores) e `verdes` se afirmam, porque o nome do ficheiro e `Material` o dizem | `municipal_stream_unknown` |
| 16 | **`Quantidade` ambígua** nos resíduos verdes | 46 | Mantida; `units_declared` usa-a, `containers` conta linhas | `municipal_quantity_semantics` |
| 17 | **Códigos de freguesia**: o INE/app usa `0308U1` a `0308U5` (provisórios) para 5 uniões; a CAOP 2019 usa `030876`, `030881`, `030883`, `030884`, `030890` | 5 freguesias | Liga-se por nome; guardam-se os dois (`parish_dicofre` da CAOP, `parish_code` da app) | `municipal_caop_version` |
| 18 | **Contornos OSM da app incompletos**: sem geometria para 3 uniões (Candoso S. Tiago e Mascotelos; Leitões, Oleiros e Figueiredo; Souto S. Maria, Souto S. Salvador e Gondomar) e geometria minúscula (0,004 km²) para Briteiros S. Salvador e Briteiros Sta Leocádia | 4 freguesias | `caop_guimaraes.geojson` tem as 48. Nas 44 restantes a sobreposição mediana CAOP-OSM é 97,9% (mínimo 95,3%) e a área soma 204,91 km² (CAOP) vs 204,75 km² (OSM), -0,1% | `municipal_osm_contours_incomplete`, `municipal_caop_vs_osm` |

Nenhum valor foi alterado sem aparecer num alerta. O que foi **corrigido** (1, 2, 11, 12, 17) mantém o valor original ao lado quando é texto; o que foi **assumido** (9, 15 como "desconhecido") leva etiqueta explícita.

## Regras do ETL

1. **Coordenadas.** Lê as duas colunas "Y" e "X" de cada linha. Se a de "Y" cabe em 36,5 a 42,5 e a de "X" em -10 a -6, é lat/lon normal; se for ao contrário, troca e marca `coord_swapped`; se nenhuma combinação cabe em Portugal, a linha é rejeitada (`invalid_coordinates`; não houve nenhuma). Duas colunas vazias → `pending`.
2. **Concelho e freguesia.** Converte para EPSG:3763 e testa ponto-em-polígono nas 48 freguesias da CAOP 2019 (geometria original, não a simplificada). Fora de todas: se a ≤ 50 m do contorno é aceite e assinalado; senão, rejeitado.
3. **Freguesia declarada.** `NameIndex` compara por quatro níveis: `exact` (mesmas palavras), `same_words` (outra ordem, "S. Jorge de Selho"), `contains_name` ("Cemitério de Arosa") e `partial` (parte de um nome: "Briteiros", "São Lourenço"; pode dar **vários** candidatos, e é "igual" se o polígono for um deles). `parish_match`: `igual`, `diferente`, `sem_coord`, `nao_mapeada` (nome que não é de freguesia). A tabela de sinónimos é mínima e está no código: `Gomilhães` → Gominhães, `Penselo` → Pencelo, `São Torcado` → São Torcato, `Santiago` → São Tiago, `Oliveira do Castelo` → Oliveira.
4. **Local (`site_id`).** Mesmas coordenadas arredondadas a 5 casas (~1 m, meio para cima, sobre o texto original) = mesmo local, em qualquer ficheiro. `site_id` é `S` + 8 hexadecimais do SHA-1 da chave `lat,lon`: estável entre execuções. `units_at_site` conta linhas.
5. **Taxonomia.** `kind`: `underground` (molok, bluebee, greenbee), `platform`, `surface`, `organic_collective`, `organic_producer`, `green_waste`. `stream`: `organico`, `verdes`, `desconhecido`. Não se inventa "indiferenciado" nem "reciclável".
6. **Sem perda.** Contentores repetidos no mesmo ponto ficam todos. Quase duplicados de ficheiros diferentes (< 5 m) **não se fundem**: são frações diferentes (ver relações).
7. **Linhagem.** `source_file`, `source_line` (linha física, 1 = cabeçalho) e `external_id` em cada linha; SHA-256 de cada entrada em `municipal_summary.json` e um resumo em `sources.json` (`vitrus_municipal_containers_2026_10`).

## Números

| Indicador | Valor |
| --- | ---: |
| Linhas de dados lidas | 2 754 |
| Contentores aceites | 2 751 (593 profundidade, 793 superfície, 397 orgânico coletivo, 922 orgânico produtores, 46 verdes) |
| Rejeitadas | 3 (2 fora do concelho, 1 linha vazia) |
| Localizados (coordenadas válidas dentro de Guimarães) | 2 722 |
| Pendentes (sem coordenadas) | 29 |
| Enterrados | 591: molok 488, bluebee 66, greenbee 37; 2 plataformas |
| Capacidade declarada, soma de tudo | 4 315 830 L (enterrados 2 921 000 L = 17 × 3 m³ + 574 × 5 m³) |
| Locais (coordenadas distintas a 5 casas) | 2 026: 1 573 públicos, 452 de produtores, 1 misto; 1 659 com 1 contentor; máximo 32 |
| Coordenada precisa / aproximada (locais) | 1 676 / 350 |
| Freguesias atribuídas pelo polígono | 48 de 48 têm contentores |
| Contentores por 1 000 habitantes | 17,4 (2 722 / 156 830) |
| Locais públicos por 1 000 habitantes | 10,0 (1 574 / 156 830) |
| Freguesia declarada = polígono | 2 354 de 2 670 comparáveis (88,2%) |
| Candidatos a têxteis (locais com contentor de rua) | 1 187 (837 com coordenada precisa; 589 com contentor enterrado) |
| Área CAOP 2019 das 48 freguesias | 24 099,97 ha = 241,0 km² (igual à soma do atributo `AREA_T_Ha`) |

Validação: o teste `test_real_totals_match_raw_files` conta as linhas dos `.txt` por fora do ETL (593, 795, 397, 923, 46) e confere que aceites + rejeitadas = lidas, localizadas + pendentes = aceites, 29 pendentes, soma de litros dos enterrados, população 156 830 e área CAOP.

## Análise

### Distribuição por freguesia

Os 5 ficheiros concentram-se na cidade e nas freguesias urbanas: **Oliveira, São Paio e São Sebastião (232), Creixomil (213), Azurém (201), Caldelas (191), Ponte (168), Costa (140) e Urgezes (140)** somam 1 285 dos 2 722 contentores localizados (47%), com 32,2% da população. Por 1 000 habitantes: de 2,0 (Lordelo) a 47,2 (Arosa e Castelões, 699 habitantes e 33 contentores, pelo que o rácio é inflacionado). A tabela completa está em `municipal_by_parish.csv`.

| Mais baixo (contentores por 1 000 hab.) | Contentores | Locais públicos | Cobertura 300 m (% da área) |
| --- | ---: | ---: | ---: |
| Lordelo (3 979 hab.) | 8 (2,0) | 2 | 13,3% |
| Serzedo e Calvos (2 263) | 6 (2,7) | 2 | 12,5% |
| Tabuadelo e São Faustino (2 415) | 7 (2,9) | 2 | 11,2% |
| Infantas (1 740) | 7 (4,0) | 2 | 11,9% |
| Ronfe (4 496) | 22 (4,9) | 12 | 32,3% |

As quatro primeiras linhas (Lordelo, Serzedo e Calvos, Tabuadelo e São Faustino, Infantas) quase não têm registos e merecem uma pergunta: ou os ficheiros estão incompletos nelas, ou a recolha é porta a porta (PAP) e não há contentores de rua. Desde 22 out 2026, 79 das 82 localidades dos circuitos têm freguesia (CAOP 2019; ver [Dados e modelo](../engenharia/dados-e-modelo.md#fontes-de-dados)). Das quatro, só Lordelo aparece nos circuitos: no C6 (moloks) e no C22 e C23, porta a porta mas sem viatura no planeamento de turnos. Serzedo e Calvos, Tabuadelo e São Faustino e Infantas não têm nenhuma localidade nos circuitos. A pergunta mantém-se.

### Capacidade

| Tipo | Contentores | Capacidades |
| --- | ---: | --- |
| Enterrado | 591 | 3 m³ (17), 5 m³ (574) |
| Plataforma | 2 | 5 m³ |
| Superfície | 793 | 1 100 L (793) |
| Orgânico coletivo | 397 | 80 L (111), 360 L (5), 1 100 L (281) |
| Orgânico produtor | 922 | 10 L (5), 30 L (35), 45 L (178), 80 L (618), 1 100 L (76), desconhecida (10) |
| Resíduos verdes | 46 | 1 100 L (46) |

### Locais com muitos contentores e outliers

A mediana é 1 contentor por local; 367 locais têm 2 ou mais. Os maiores:

| Contentores | Local | Freguesia | Tipo |
| ---: | --- | --- | --- |
| 32 | Hospital Senhora da Oliveira | Creixomil | produtor (grande) |
| 13 | Universidade do Minho, Campus de Azurém | Azurém | produtor (estabelecimento) |
| 11 | "Escola Secundária" (superfície, **coordenada aproximada**) | Caldelas | público (várias ruas no mesmo ponto) |
| 11 | Centro Escolar de Ponte | Ponte | produtor (escola) |
| 10 | J. Pereira Fernandes | Selho (São Jorge) | produtor (grande) |

Outros: Cenatex (9), Cercigui (8), MIT Penha (8, restauração), Panda Wok (8), Pousada Mosteiro de Guimarães (8). **Outliers:** 5 contentores de 10 L, 10 capacidades desconhecidas, 79 contentores a mais de 1 km da freguesia declarada, e 17 enterrados de 3 m³ entre 576 de 5 m³.

### Cobertura e vizinho mais próximo

Só locais **públicos** (rede de rua). Cobertura = parte da área do concelho a menos de r metros de um local:

| Raio | 200 m | 300 m | 500 m |
| --- | ---: | ---: | ---: |
| % da área de Guimarães | 31,4% | 47,8% | 70,9% |

Vizinho mais próximo entre locais públicos (m): mediana 74, média 112, quartis 11,9 e 141,0, percentil 95 = 365, máximo 1 469. 249 locais têm vizinho a ≤ 5 m (o orgânico coletivo ao lado do contentor de rua). Das 48 freguesias, 26 têm 50% ou mais da área a 300 m de um local; 6 têm menos de 25%. É **cobertura de área, não de população**: não temos a população por quarteirão (BGRI) dentro de cada freguesia.

### Relações entre os ficheiros

- **Orgânico coletivo acompanha a rua.** 233 dos 394 contentores de orgânico coletivo localizados (59%) têm um contentor de rua a ≤ 15 m, e em 219 o mais próximo é de profundidade; a distância mediana ao contentor de rua mais próximo é 10,1 m. É a mesma rua do ficheiro de Profundidade, instalada ao lado. Há 118 pares de locais de ficheiros diferentes a menos de 5 m (107 coletivo ~ profundidade, 3 coletivo ~ superfície).
- **Os IDs `BCn` não espelham os de Profundidade.** Só os primeiros (`BC1` a `BC4`, `BC6`) coincidem em número e em rua com o enterrado do mesmo número; para os 376 `BCn` com enterrado de igual número, só 5 estão a ≤ 15 m. A relação é **espacial** (mesma rua), não por ID. Ver `municipal_links.csv`.
- **`BC1` a `BC443` são uma só série** repartida entre Orgânico Coletivo (397) e Resíduos Verdes (46), sem sobreposição.
- **Superfície e Profundidade quase não se tocam** (1 par a < 5 m): são redes complementares, não duplicadas.
- Pares de pontos distintos a < 5 m dentro do mesmo ficheiro: 24 (8 em profundidade, 6 em produtores, 5 em coletivo, 4 em superfície, 1 em verdes); podem ser contentores lado a lado com coordenadas ligeiramente diferentes (não verificado).

### Produtores com potencial têxtil

| Tipo | Contentores | Produtores distintos | Freguesias com mais |
| --- | ---: | ---: | --- |
| Restauração | 446 | 304 | Oliveira, S. Paio e S. Sebastião (42), Caldelas (40), Azurém (31) |
| Escola | 250 | 87 | Oliveira (26), Creixomil (18), Caldelas (17) |
| Estabelecimento | 93 | 39 | Oliveira (25), Azurém (17), Ponte (12) |
| Grandes produtores | 65 | 12 | Creixomil (33), Moreira de Cónegos (11), Selho S. Jorge (11) |
| Lar | 47 | 17 | Oliveira (18), Urgezes (6), Pencelo (6) |
| Hotelaria | 21 | 9 | Costa (8), Mesão Frio (3), São Torcato (3) |

A lógica para têxteis (hipótese nossa, a validar): **hotelaria e lares** geram roupa de cama e toalhas em volume e já são clientes B2B; **escolas** já têm campanha de têxteis com a Vitrus (cerca de 3 t em mais de 30 escolas [F57]); **grandes produtores** (hospital, universidade) geram fardamento. A restauração tem pouco têxtil reutilizável. Os 12 grandes produtores e os 9 de hotelaria são o primeiro alvo: poucos contactos, volume alto.

### Locais candidatos para recolha de têxteis

Não há fração "reciclável" nem "ecoponto" nos dados, por isso **não** se pode escolher "os ecopontos". O critério (`textile_candidate`) é: local público com pelo menos um contentor de rua (profundidade, superfície ou plataforma). Dá 1 187 locais; 837 com coordenada precisa (os 350 aproximados exigem confirmação no terreno) e 589 com contentor enterrado. `candidate_reason` diz porquê (enterrado, orgânico coletivo a menos de 15 m, 3 ou mais contentores, coordenada aproximada). **É uma lista de lugares possíveis, não de recomendados**: a escolha depende de espaço, tráfego e da passagem da viatura. Nenhum recebe contentor de têxtil: o modo é paragem da viatura de têxtil em local existente.

### Ranking de freguesias com mais lacuna (estimativa)

Não há têxtil recolhido nem deposição de têxtil por freguesia (só o total de 301,3 t). Por isso a lacuna por freguesia é **estimativa**: o têxtil que ainda vai para o lixo, população INE × 1,596 kg/hab/mês × 12 (51 250,6 t de indiferenciado do concelho × 5,86% da APA, repartidas por habitante). Divide-se pelo número de locais candidatos (+ 1 se houver zero) e ordena-se: toneladas por candidato.

Valores com a base de 22 de outubro de 2026: população × 19,15 kg/hab/ano (cálculo nosso; confirmar com `data/processed/municipal_summary.json` depois de `just etl`). A ordem não muda face às bases antigas, porque o fator é o mesmo em todas as freguesias.

| # | Freguesia | População | Lacuna (t/ano, estimativa) | Locais candidatos | t por candidato |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | Lordelo | 3 979 | 76,2 | 1 | 76,2 |
| 2 | Tabuadelo e São Faustino | 2 415 | 46,2 | 0 | 46,2 |
| 3 | Serzedo e Calvos | 2 263 | 43,3 | 0 | 43,3 |
| 4 | Infantas | 1 740 | 33,3 | 0 | 33,3 |
| 5 | Abação e Gémeos | 2 682 | 51,4 | 3 | 17,1 |
| 6 | Ronfe | 4 496 | 86,1 | 10 | 8,6 |
| 7 | Atães e Rendufe | 2 579 | 49,4 | 6 | 8,2 |
| 8 | Candoso (São Martinho) | 1 234 | 23,6 | 3 | 7,9 |
| 9 | Moreira de Cónegos | 4 651 | 89,1 | 14 | 6,4 |
| 10 | Silvares | 2 250 | 43,1 | 7 | 6,2 |

As quatro primeiras são as mesmas com poucos registos: **são as freguesias onde o pacote não ajuda** (ou o ficheiro está incompleto, ou não há recolha de rua), e onde o saco à porta, recolhido pela viatura de têxtil, é a opção natural. Os rácios usam população de 2021, não a atual.

## CAOP 2019, OSM e a versão atual

| | CAOP 2019 (este pacote) | OSM (`data/raw/public/parishes.geojson`) |
| --- | --- | --- |
| Freguesias com geometria | 48 | 44 utilizáveis; 3 sem geometria; 1 minúscula |
| Área comparável | 204,91 km² (44 freguesias) | 204,75 km² (-0,1%) |
| Sobreposição por freguesia (mediana; mínimo) | | 97,9%; 95,3% |
| Códigos das 5 uniões | `030876`, `030881`, `030883`, `030884`, `030890` | `0308U1` a `0308U5` (provisórios) |

Diferenças 2019 vs atual: Guimarães não teve fusões nem desagregações de freguesias depois de 2013, por isso o conjunto de 48 mantém-se. A CAOP2025 pode ter pequenos ajustes de limite; **não a temos** e o ETL aceita outra versão sem mudanças (muda só o caminho do shapefile e o campo `Concelho`). `caop_guimaraes.geojson` simplifica cada freguesia a **5 m** (topologia preservada por freguesia, 6 casas decimais, 147 KB): as áreas, as atribuições e as distâncias usam sempre a geometria original.

## Limites

- Os contentores **não são de têxteis**; nada aqui diz quantos têxteis se recolhem nem onde. Não há dados de deposição de têxtil por contentor (Vitrus, 21 de outubro).
- A Vitrus confirmou que o pacote junta indiferenciado, orgânico e seletivo, mas não há campo com a fração de cada contentor de profundidade ou superfície.
- A data de referência do inventário não consta (o projeto QGIS é de maio de 2025). Pode haver contentores novos ou removidos.
- Cobertura e vizinho são de **área**; sem população por quarteirão não há cobertura de pessoas.
- Coordenadas de 3 casas (509 contentores) e freguesias declaradas erradas (79 a mais de 1 km) enfraquecem as contas locais; as contagens por freguesia usam o polígono, que depende da coordenada.
- Locais agrupados a 5 casas fundem contentores de ruas diferentes quando a coordenada é aproximada (o caso das escolas com 11 superfícies).
- Capacidades dos produtores sem unidade (assumidas em litros). `Quantidade` dos verdes por esclarecer.
- A lacuna por freguesia é **estimativa**: o mesmo têxtil por habitante em todas as freguesias.

## Perguntas para a Vitrus e para o Lucas

1. ~~**Lista de contentores de têxteis**~~: respondida a 21 de outubro. Não existem e a Vitrus não os quer.
2. **Fração de cada ficheiro:** respondida em parte a 21 de outubro (indiferenciado, orgânico e seletivo). Falta saber a fração de cada contentor de Profundidade e Superfície.
3. **`plataforma`** (2 casos): que equipamento é?
4. **Frequência de recolha** de cada tipo e custo por esvaziamento (enterrado vs superfície) para dimensionar o ganho de usar os mesmos locais.
5. **Resíduos verdes, `Quantidade`:** é o número de contentores no local?
6. **Capacidade da Tipologia:** é em litros? Os 10 L são 110 L?
7. **Freguesia por código (Dicofre)** em vez de texto, e as 79 coordenadas a mais de 1 km da freguesia declarada (lista em `municipal_containers.csv`, `coord_suspect = true`).
8. **Lordelo, Infantas, Tabuadelo e São Faustino, Serzedo e Calvos:** o inventário está completo nestas freguesias ou a recolha é porta a porta?
9. **Versão da CAOP** e código oficial das 5 uniões (`0308U1..5` provisórios vs `030876...`).
10. **Data de referência** do inventário e se há contentores novos ou retirados desde maio de 2025.
11. **Produtores:** o contacto B2B existe? Quais fornecem roupa de cama, toalhas ou fardamento (hotelaria, lares, grandes produtores)?
12. **Autorização** para mostrar nomes de produtores no mapa (são estabelecimentos privados) ou só agregados por freguesia.

## Como reproduzir

```bash
just etl          # corre build_processed.py e depois municipal_containers.py
cd apps/api && uv run pytest tests/unit/test_etl_municipal.py -q
```

O script é PEP 723 (`numpy`, `pyproj`, `pyshp`, `shapely`), idempotente: duas execuções dão exatamente os mesmos bytes. Entradas só em `data/raw/vitrus-mapa-qgis/`. Se a pasta não existir, remove as saídas antigas e não falha.

### Ficheiros de saída

| Ficheiro | Conteúdo |
| --- | --- |
| `municipal_containers.csv` | Um contentor por linha (2 751): `container_uid`, `source_file`, `source_line`, `external_id`, `kind`, `stream`, `brand`, `capacity_litres`, `capacity_raw`, `capacity_status`, `producer_type(_key)`, `producer_name`, `street`, `quantity`, `declared_parish`, `parish_dicofre` (CAOP), `parish_code` (app), `parish_name`, `parish_match`, `parish_match_level`, `parish_mismatch_distance_m`, `coord_suspect`, `latitude`, `longitude`, `coord_status`, `coord_swapped`, `coord_cleaned`, `coord_decimals`, `coord_precision`, `boundary_note`, `site_id`, `units_at_site` |
| `municipal_sites.csv` | Um local por linha (2 026): posição, freguesia, `site_class` (public, producer, mixed), contagens por `kind` e `stream`, capacidade total, `producer_types`, `streets`, `coord_precision`, `organic_collective_within_15m`, `nn_distance_m`, `textile_candidate`, `candidate_reason` |
| `municipal_containers_rejected.csv` | 3 linhas rejeitadas com `reason_key`, motivo e a linha original em JSON |
| `municipal_alerts.csv` | Alertas para o ecrã "Qualidade dos dados" (mesmo formato de `data_alerts.csv`) |
| `municipal_by_parish.csv` | 48 linhas: população, área, contentores e locais, por tipo, por 1 000 hab., por km², vizinho mais próximo, cobertura 200/300/500 m, produtores por tipo, candidatos, lacuna estimada e `gap_rank` |
| `municipal_links.csv` | Cada orgânico coletivo com o contentor de rua mais próximo e o enterrado de igual número |
| `municipal_summary.json` | Todos os números, regras, SHA-256 das entradas |
| `caop_guimaraes.geojson` | 48 freguesias CAOP 2019, WGS84, simplificadas a 5 m, com área, população e centróide |
| `qgis/guimaraes_contentores_municipais.gpkg` | GeoPackage com `contentores`, `locais` e `freguesias_caop2019` |

### Abrir no QGIS

1. **Camada → Adicionar camada → Adicionar camada vetorial** e escolher `data/processed/qgis/guimaraes_contentores_municipais.gpkg`; aceitar as três camadas. O sistema é WGS84 (EPSG:4326); o projeto pode ficar em ETRS89 / PT-TM06 (EPSG:3763), o QGIS reprojeta.
2. Simbologia por `kind` na camada `contentores` (categorizada) e rótulo por `producer_name`. Filtrar `parish_match = 'diferente'` ou `coord_suspect = 'true'` para ver os pontos suspeitos.
3. Em `locais`, `textile_candidate = 'true'` mostra os candidatos; `nn_distance_m` serve para um mapa de calor.
4. O projeto original da Vitrus (`Georreferenciação.qgz`) abre-se na pasta `data/raw/vitrus-mapa-qgis/`. Declara vírgula decimal nos ficheiros de texto, que usam ponto: se alguma camada não aparecer, é isso; o GeoPackage evita o problema.

## Contrato de dados para a API (implementado)

O `seed` importa estes ficheiros (`DATA_DIR`) para `municipal_containers`, `municipal_sites`, `municipal_parish_stats` (com o contorno CAOP), `municipal_links` e `municipal_meta`, com a fonte `vitrus_municipal_containers_2026_10` e o SHA-256 do pacote; os 25 alertas `municipal_*` entram em `data_alerts` e aparecem no ecrã "Qualidade dos dados". Rotas em `/api/v1/municipal` (autenticadas, com ETag): `get_municipal_overview`, `list_municipal_parishes`, `get_municipal_parish`, `list_municipal_sites`, `get_municipal_sites_geojson`, `get_municipal_site`, `list_municipal_containers`, `list_municipal_producers`, `get_textile_candidate_sites`, `get_municipal_gap_ranking`, `get_municipal_density_benchmark`, `export_municipal_sites`, `get_caop_parishes_geojson`. `kind`, `stream`, `parish_match`, `producer_type`, `site_class`, `coord_precision` e `alert.kind` são enums. Detalhe em [Arquitetura](../engenharia/arquitetura.md#rede-municipal-municipal).

- **Nunca** se junta `municipal_*` à tabela `containers` de têxteis.
- **Nomes de produtores** (pergunta 12): a API não os devolve por omissão; só um `admin` que peça `show_names=true`. O copiloto nunca os mostra. Se a Vitrus não autorizar, basta nunca ligar o parâmetro no web.
- Os candidatos têm uma ordem explícita (`rank_rule`): coordenada precisa; freguesia com mais lacuna estimada por candidato; enterrado; orgânico a menos de 15 m; mais contentores. É uma ordem de leitura, não uma recomendação.

**No web (implementado).** O ecrã `/municipal` tem seis separadores: visão geral (KPIs, cobertura e distância ao local público mais próximo), freguesias (contentores por 1 000 habitantes, cobertura a 200/300/500 m), locais (com ficha e vizinhos), candidatos a têxteis (com a regra de ordem), lacunas (estimativa, com etiqueta) e qualidade (alertas `municipal_*`); exporta CSV, XLSX e GeoJSON. No mapa (`/map`), o painel de camadas liga os locais municipais por fração (com mapa de calor da densidade de contentores), os contornos CAOP em coroplético (contentores por 1 000 habitantes ou cobertura a 300 m) e os produtores (sem nomes). Não há mapa de calor de `nn_distance_m`.

## Fontes

[F63] Lasso, brochura de contentores enterrados (Blue Bee, Green Bee, Red Bee). [F64] Lasso, página do Green Bee. [F65] Molok e fornecedores portugueses (Resopre, SULO). [F66] DGT, Carta Administrativa Oficial de Portugal. [F67] DGT, catálogo de entidades da CAOP 2023. [F68] ISO 19157-1:2023. Detalhe, estado e ligações em Fontes.
