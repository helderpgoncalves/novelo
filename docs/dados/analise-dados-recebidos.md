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
| Vitrus Ambiente | localizações dos contentores | **chegam a 20 de outubro de 2026** | Pontos atuais da rede de partida |

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

## Qualidade e limites

- **Método por entidade.** H Sarah Trading e Ultriplo enviaram quilos exatos por destino (`weighed`); Nova Etapa e Vitrus enviaram percentagens de relatórios aplicadas ao total (`percentage`). Os números destas duas levam a etiqueta "estimativa" no ecrã. O rejeito de 56,9% da Vitrus vem de uma amostra de 5,6 t.
- **Doze alertas** no ficheiro de circuitos, guardados em `data_alerts` e resolvíveis no ecrã (por exemplo: circuitos sem viatura, códigos V1 a V4 por trocar por matrículas, serviços como SELETIVO, PAYT ou CARTÃO sem localidades nem dias, matrículas duplicadas ou suspeitas).
- **Datas diferentes.** A semana útil, o sábado e o domingo não são da mesma semana; o planeamento de fim de semana tem de ser confirmado.
- **Geocodificação.** Algumas "localidades" dos circuitos (por exemplo "Ruas Estreitas") não são lugares e ficam sem coordenadas; o mapa usa as 71 que existem.
- **Sem custos.** A Vitrus ainda não indicou custo por recolha, por quilómetro ou por contentor. Os custos do simulador são pressupostos marcados como tal em `features/planning/params.py` e no ecrã "Pressupostos".
- **Contentores.** Sem localizações até 20 de outubro de 2026: a tabela `containers` existe e o simulador funciona sem ela; quando chegarem, `just etl` e o seed importam-nas e o mapa ganha a camada.
- **Códigos provisórios.** Os códigos de zona `0308U1` a `0308U5` da tipologia são provisórios até à validação com o INE.

## Onde se usa cada dado

| Dado | Ecrã ou função |
| --- | --- |
| Têxtil recolhido e destino | Ponto de partida, Sankey observado, calibração da captura, receita e €/t |
| População e freguesias | Procura por zona, simulador, mapa |
| TIPAU | Custo por tipo de território no relatório RAP |
| Circuitos, viaturas e turnos | Circuitos, Frota, recolha a pedido sem km novos |
| Localidades geocodificadas | Mapa, ligação entre circuitos e freguesias |
| Alertas | Qualidade dos dados |

## Regra

Um valor ou vem destes ficheiros, ou está em [Dados e modelo](../engenharia/dados-e-modelo.md) como pressuposto com fonte, ou leva a etiqueta "estimativa" no ecrã.
