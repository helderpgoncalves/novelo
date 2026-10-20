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
| Vitrus Ambiente | `data/raw/vitrus-mapa-qgis/` (5 `.txt`, projeto QGIS, CAOP 2019) | recebido a 20 de outubro de 2026; inventário sem data (projeto QGIS de maio de 2025) | Contentores **municipais** de outras frações (profundidade, superfície, orgânico, resíduos verdes) e contornos oficiais das freguesias. **Não são de têxteis.** Ver [Análise dos contentores municipais](analise-contentores-municipais.md) |
| Vitrus Ambiente | localizações dos contentores **de têxteis** | **por receber** | Pontos atuais da rede de partida |

Cada ficheiro tem impressão digital (SHA-256), data de receção e período registados em `data/processed/sources.json` e visíveis no ecrã "Qualidade dos dados".

## O que os dados dizem

| Resultado | Valor |
| --- | --- |
| Têxtil recolhido em 2025 | 301,3 t (0,16 kg/hab/mês) |
| Destino | reutilização 59,4% (179,0 t), reciclagem 26,5% (79,9 t), rejeito 14,1% (42,3 t) |
| População | 156 830 habitantes em 48 freguesias (soma do INE) |
| Potencial (0,7 kg/hab/mês) | ≈ 1 317 t por ano, captura atual ≈ 22,9% |
| Circuitos | 40, dos quais 9 sem viatura atribuída no planeamento |
| Viaturas | 29, duas nunca atribuídas (`29-48-XU`, `74-HN-36`) |
| Turnos | 101 por semana |
| Localidades | 82 com pelo menos um circuito, 71 geocodificadas |
| Contentores municipais (não são de têxteis) | 2 754 linhas, 2 751 aceites, 2 722 localizados, 2 026 locais, 17,4 por 1 000 hab. |
| Freguesias CAOP 2019 | 48, 24 099,97 ha (241,0 km²) |

## Qualidade e limites

- **Método por entidade.** H Sarah Trading e Ultriplo enviaram quilos exatos por destino (`weighed`); Nova Etapa e Vitrus enviaram percentagens de relatórios aplicadas ao total (`percentage`). Os números destas duas levam a etiqueta "estimativa" no ecrã. O rejeito de 56,9% da Vitrus vem de uma amostra de 5,6 t.
- **Doze alertas** no ficheiro de circuitos, guardados em `data_alerts` e resolvíveis no ecrã (por exemplo: circuitos sem viatura, códigos V1 a V4 por trocar por matrículas, serviços como SELETIVO, PAYT ou CARTÃO sem localidades nem dias, matrículas duplicadas ou suspeitas).
- **Datas diferentes.** A semana útil, o sábado e o domingo não são da mesma semana; o planeamento de fim de semana tem de ser confirmado.
- **Geocodificação.** Algumas "localidades" dos circuitos (por exemplo "Ruas Estreitas") não são lugares e ficam sem coordenadas; o mapa usa as 71 que existem.
- **Sem custos.** A Vitrus ainda não indicou custo por recolha, por quilómetro ou por contentor. Os custos do simulador são pressupostos marcados como tal em `features/planning/params.py` e no ecrã "Pressupostos".
- **Contentores de têxteis.** Continuam por receber: a tabela `containers` existe e o simulador funciona sem ela; quando chegarem, `just etl` (`containers.py`) e o seed importam-nas e o mapa ganha a camada.
- **Contentores municipais (pacote QGIS, 20 de outubro).** São outra rede (outras frações) e nunca se misturam com a de têxteis. Vinte e cinco alertas em `municipal_alerts.csv`; os principais: cabeçalhos de coordenadas trocados em 3 de 5 ficheiros (corrigido linha a linha pelo intervalo), 29 contentores sem coordenadas, 509 com coordenadas de 3 casas decimais, 166 escritas diferentes de freguesia (conta o polígono, não o texto), 79 contentores a mais de 1 km da freguesia declarada, capacidades "???" e sem unidade, 1 linha vazia e 2 pontos fora do concelho (rejeitados). Fração dos contentores de profundidade e superfície **desconhecida**.
- **Contornos das freguesias.** Os contornos OSM de `parishes.geojson` falham 3 uniões de freguesias e têm 1 minúscula; a CAOP 2019 do pacote (`caop_guimaraes.geojson`) tem as 48. As 5 uniões têm Dicofre oficial na CAOP (`030876`, `030881`, `030883`, `030884`, `030890`) onde a app tem os provisórios `0308U1` a `0308U5`: ligam-se por nome até a Vitrus/INE confirmarem.
- **Códigos provisórios.** Os códigos de zona `0308U1` a `0308U5` da tipologia são provisórios até à validação com o INE; a CAOP 2019 já traz códigos oficiais para essas cinco freguesias (ver acima).

## Onde se usa cada dado

| Dado | Ecrã ou função |
| --- | --- |
| Têxtil recolhido e destino | Ponto de partida, Sankey observado, calibração da captura, receita e €/t |
| População e freguesias | Procura por zona, simulador, mapa |
| TIPAU | Custo por tipo de território no relatório RAP |
| Circuitos, viaturas e turnos | Circuitos, Frota, recolha a pedido sem km novos |
| Localidades geocodificadas | Mapa, ligação entre circuitos e freguesias |
| Alertas | Qualidade dos dados |
| Contentores municipais, locais e produtores | Candidatos a pontos de têxteis, B2B (hotelaria, lares, escolas, grandes produtores), densidade por freguesia, mapa |
| CAOP 2019 | Geometria das freguesias, área em km², atribuição de freguesia por ponto |

## Regra

Um valor ou vem destes ficheiros, ou está em [Dados e modelo](../engenharia/dados-e-modelo.md) como pressuposto com fonte, ou leva a etiqueta "estimativa" no ecrã.
