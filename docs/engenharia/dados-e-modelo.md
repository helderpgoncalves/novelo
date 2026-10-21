# Dados e modelo

O modelo tem três passos: quanto têxtil há em cada zona, quanto custa cada forma de o recolher, e que combinação dá o menor custo para a meta escolhida. Cada número que entra tem fonte ou está marcado como pressuposto.

## Fontes de dados

| Dado | Fonte | Uso |
| --- | --- | --- |
| População por subsecção | INE, Censos 2021 (BGRI) | Procura por zona |
| Limites de freguesia | CAOP, Direção-Geral do Território | Agregar e mostrar no mapa |
| Estradas e locais candidatos (escolas, supermercados, juntas) | OpenStreetMap, extrato de Portugal | Rotas e pontos de recolha em locais existentes |
| Têxtil recolhido, circuitos, viaturas e caracterização do lixo | Vitrus Ambiente (ver [análise dos dados](../dados/analise-dados-recebidos.md)) | Calibração e rede de partida |
| Localizações dos contentores **de têxteis** | Vitrus Ambiente, por receber | Pontos atuais da rede (ETL `containers.py`, tabela `containers`) |
| Contentores **municipais** de outras frações (2 751) e CAOP 2019 | Vitrus Ambiente, pacote QGIS de 20 de outubro de 2026 (ver [análise](../dados/analise-contentores-municipais.md)) | Pontos candidatos junto de recolha existente (investimento perto de zero, **pressuposto**), produtores B2B, geometria oficial das freguesias, densidade. ETL `municipal_containers.py` → `data/processed/municipal_*`; **não entram** na rede de têxteis |
| Têxtil no indiferenciado: 5,4%; 0,7 kg/hab/mês | Plano de Ação Integrado para a Circularidade Têxtil de Guimarães (URBACT, 25/11/2025), p. 30, que cita Perebynos et al. 2023 | Valor base da procura, com a incerteza descrita na secção 1 |
| Custos unitários (recolha, km, contentor) | Vitrus Ambiente (ainda por receber) | Modelo de custos |

## 1. Procura por zona

Têxtil gerado na zona *z* por ano, a partir da população e do valor por habitante do plano municipal:

```latex
D_z = P_z \cdot q \cdot 12 \qquad q = 0{,}7\ \text{kg por habitante por mês}
```

Com os 156 830 habitantes do concelho (soma das freguesias, INE), isto dá cerca de 1 317 t por ano (**estimativa**); a Vitrus recolhe hoje 301,3 t, ou seja, 22,9%. Onde a caracterização da Vitrus mostrar mais têxtil (rotas com microconfeções), *q* sobe nessa zona.

**Pressuposto e incerteza (pergunta Q6).** A fonte é pública (o plano escreve «0,7 kg de têxteis nos RSU por mês per capita», p. 30), mas não sabemos o que a medida inclui: o modelo trata-a como a **procura total a captar**. Se for só o têxtil que ainda vai no indiferenciado, a geração total é pelo menos 1 317,4 + 301,3 = 1 618,6 t e a captura de 2025 é 18,6% em vez de 22,9% (cálculo, estimativa). Se incluir têxteis sanitários, ou vier de uma caracterização de 2016, o potencial recuperável é menor. Outra leitura do mesmo plano (5,4% × 315 kg de indiferenciado por habitante) dá 17,0 kg/hab/ano, o dobro dos 8,4 kg que resultam dos 0,7 kg/mês. Por isso o valor leva «estimativa» em todo o ecrã e entra na sensibilidade como o parâmetro de maior incerteza. A pergunta está em [Perguntas aos orientadores](../projeto/perguntas-aos-orientadores.md#q6-o-que-significam-07-kghabmês-e-54), com o que muda em cada resposta.

Têxtil captado depende do modo de recolha *m* que serve a zona:

```latex
C_z = D_z \cdot c_m
```

A taxa de captura *c* por modo não tem fonte local. Calibrámo-la com os dados reais: o contentor de rua serve 80% da população e a taxa de quem é servido é 22,9% / 80% = 28,6%, de modo que uma rede só de rua reproduz as 301 t que a Vitrus recolhe hoje. Os outros modos são pressupostos visíveis no ecrã, até haver dados do piloto.

## 2. Modelo de custos

```latex
\text{custo anual} = \frac{\text{investimento}}{N} + \text{recolhas} \cdot c_{\text{recolha}} + \text{km} \cdot c_{\text{km}}
```

```latex
\text{EUR/t} = \frac{\text{custo anual}}{\sum_z C_z}
```

*N* = anos de vida do equipamento. Pontos em locais existentes têm investimento perto de zero; contentores de rua têm investimento e recolha; recolha a pedido não tem investimento mas tem km.

## 3. Otimização

1. **Localização e modo (CP-SAT, OR-Tools):** escolher que pontos candidatos abrir e que modo serve cada zona, para **maximizar toneladas captadas com o orçamento dado** ou **minimizar custo para uma meta de captura**. Uma zona só conta como servida se tiver um ponto dentro da distância a pé definida para esse modo.
2. **Rotas (VRP, OR-Tools):** com os pontos abertos, calcular rotas por veículo com capacidade e frequência de recolha, com distâncias em linha reta (haversine) e um fator de desvio de 1,3. Não há ainda cliente OSRM: a variável `OSRM_URL` existe mas não é usada, e distâncias por estrada ficam para quando houver dados de GPS ou um motor de rotas. A recolha a pedido aproveita os circuitos que já passam pela localidade, sem quilómetros novos.
3. **KPIs:** investimento, custo anual, toneladas, €/t, % de população coberta.

## 4. Lotes, fluxos e calibração

Os lotes são o lado real do modelo: o que foi mesmo recolhido, triado e entregue.

| Entidade | Campos principais |
| --- | --- |
| Peça triada | estado, composição, marca (se visível), peso estimado, ponto, data |
| Lote | código, ponto, freguesia, fibra dominante, estado, peso total, histórico |
| Evento do lote | tipo (recolhido, triado, reservado, entregue), data, quem |
| Reserva | lote, reciclador, data |

**Peso no MVP:** cada peça recebe o peso médio do seu tipo (camisola, calças, lençol...), que é um pressuposto marcado como tal. No piloto passa a vir de uma balança no ponto.

**Fluxos (Sankey):** soma de toneladas por freguesia → modo → estado → destino, a partir do cenário (previsto) ou dos lotes (observado).

**Calibração das taxas de captura** pelo copiloto: cada semana, a taxa de cada modo aproxima-se do que foi observado, com um peso que cresce com as semanas de dados.

```latex
c_m^{\text{nova}} = \frac{k \cdot c_m^{\text{pressuposto}} + s \cdot c_m^{\text{observada}}}{k + s}
```

*s* = semanas com dados; *k* = peso dado ao pressuposto (ex.: 4 semanas). Ao fim de um mês, observado e pressuposto pesam o mesmo.

**Tipologia de território** para o relatório RAP: Tipologia de Áreas Urbanas do INE (predominantemente urbanas, mediamente urbanas, predominantemente rurais), cruzada com as freguesias (`data/raw/public/tipau.json`). Os códigos de zona `0308U1` a `0308U5` são provisórios até serem validados.

## 5. Incerteza, referência francesa e piloto

Os custos unitários da Vitrus ainda não existem, por isso a incerteza é tratada como resultado e não como nota de rodapé. Código em `domain/sensitivity.py`, `domain/benchmarks.py` e `domain/pilot.py`; endpoints em `features/planning/insights_router.py`.

### Sensibilidade (tornado e Monte Carlo)

- **Tornado:** cada parâmetro de custo e de procura varia ±30% (configurável, `swing`), um de cada vez, sobre o plano do cenário. Resultado: impacto em €/t, toneladas e custo anual, ordenado por impacto em €/t. Cada barra leva a origem do parâmetro (plano, dados da Vitrus ou pressuposto).
- **Monte Carlo:** 500 amostras (configurável), semente fixa 7, distribuição triangular `Tri(1 − s, 1 + s, moda 1)` multiplicada ao pressuposto, independente por parâmetro. Devolve P10/P50/P90 de €/t, custo anual e toneladas, e a probabilidade de o €/t ficar abaixo de um limiar.
- **Decisão: não se resolve o CP-SAT em cada amostra.** Reavalia-se o modelo de custos sobre o plano já otimizado (mesmas freguesias e modos; os km usam as rotas reais do cenário, por isso o caso central reproduz os KPIs gravados). A pergunta é "o plano que propomos aguenta se os pressupostos estiverem errados?"; reotimizar a cada amostra responderia a "quanto custaria o melhor plano se soubéssemos a verdade?", sempre mais otimista, e custaria horas.
- **Exemplo (cenário de 60 000 €/ano, 122,7 €/t, estimativa com os pressupostos da altura):** P10 92,5, P50 123,8, P90 164,7 €/t. O maior fator de incerteza é o kg/hab/mês (Plano municipal); 3 dos 5 maiores fatores são pressupostos sem dado.

### Robustez

`GET /planning/compare-robustness`: com amostras **emparelhadas** (os mesmos fatores perturbam os pressupostos de ambos os cenários), mede em que fração das amostras o cenário recomendado é estritamente melhor que o alternativo (€/t, custo ou toneladas). `holds` é verdadeiro se a fração for pelo menos `min_share` (por omissão 80%).

### Cenário de referência: desempenho francês

| Pressuposto | Valor | Estado e fonte |
| --- | --- | --- |
| Recolha por habitante | 4,27 kg/hab/ano | **Por verificar.** Registo de afirmações C1 (Refashion via F10), fonte secundária, `docs/pesquisa/registo-de-afirmacoes.md` |
| Densidade de pontos | 1 por 1 414 habitantes (contentor de rua) | **Por verificar.** Registo C2 (F10), fonte secundária |

Só entra como cenário de comparação (`GET /planning/benchmarks`, `POST /planning/benchmarks/{key}/scenario`), nunca como pressuposto base. Consequências com os dados reais (registo C13 a C15):

- Meta: 4,27 × 156 830 / 1000 = **669,7 t/ano** (2,2 vezes as 301,3 t de hoje; hoje são 1,92 kg/hab/ano).
- Exige captar **50,8%** do potencial (4,27 / 8,4); a Vitrus capta 22,9%.
- **Limite alcançável do modelo: 562,6 t/ano** (todos os modos ligados em todas as freguesias, densidade francesa na rua, captura independente por canal, 1 − Π(1 − c·f)). A meta (669,7 t) fica **107,1 t acima do teto**: com os pressupostos atuais o cenário "custo mínimo para a meta" é impossível e sai `infeasible`. O argumento é a distância, não o custo; para a alcançar seriam precisas taxas de captura por modo mais altas, que só o piloto pode medir. A alternativa `max_tonnes` com orçamento corre normalmente.

### Piloto de 3 meses

`POST /planning/pilot` escolhe `k` freguesias (2 a 4) por pesquisa exaustiva e determinista. Valor de aprendizagem do conjunto = soma ponderada de quatro componentes em [0, 1]:

| Componente | Peso | Definição |
| --- | --- | --- |
| Território | 0,25 | amplitude urbano-rural pela TIPAU (APU = 0, AMU = 1, APR = 2): (mais rural − mais urbano) / 2 |
| Densidade | 0,15 | contraste de ln(hab/km²) do conjunto / o de todas as freguesias |
| Circuitos | 0,30 | média de min(dias/semana de circuito / 2, 1): recolha a pedido sem km novos (`piggyback_min_days`) |
| Custo de arranque | 0,30 | 1 − (arranque − mín) / (máx − mín); arranque = investimento + 3 meses de operação |

Os pesos são um **pressuposto da equipa**. A densidade usa a **área geodésica** das freguesias (WGS84, `domain/parish_area.py`), calculada no seed a partir do contorno de cada freguesia em `data/processed/parishes.csv` (origem: `data/raw/public/parishes.geojson`): somam 204,7 km² em 44 das 48 freguesias (o concelho tem cerca de 241 km²). Três freguesias não têm contorno e Briteiros S. Salvador e Santa Leocádia tem um contorno claramente errado (0,004 km²), descartado; nessas quatro a densidade fica em falta e não é inventada.

**Piso de sinal.** Um piloto que capta poucos quilos não mede a taxa de rejeito. Mínimo de toneladas = células (freguesia × modo) × peças por célula × peso médio da peça:

```latex
n = \left\lceil \frac{z^2\, p(1-p)}{h^2} \cdot \mathrm{deff} \right\rceil, \qquad t_{\text{célula}} = n \cdot 0{,}415\ \text{kg}
```

*p* = 14,1% de rejeito (Vitrus, 2025); *h* = 3 pontos percentuais (meia-largura do intervalo a 95%, *z* = 1,96); *deff* = 2 (efeito de desenho: as peças de um mesmo saco não são independentes; convenção de amostragem por conglomerados, **pressuposto a validar**); 0,415 kg = média dos pesos por tipo de peça já usados no passaporte do lote (pressuposto). Dá cerca de 1 030 peças e 0,43 t por célula; com 2 freguesias × 2 modos, **1,71 t em 3 meses**. As combinações abaixo do piso são descartadas e a resposta devolve quantas foram e porquê; se nenhuma o atinge devolve-se a de mais toneladas, com `floor_met = false`. O piso pode ser imposto no pedido (`min_tonnes_pilot`).

**KPIs a medir** (valor previsto e P10-P90, todos "estimativa"): toneladas no piloto, €/t em regime e taxa de rejeito (parte dos 14,1% observados com a mesma incerteza triangular).

## 6. Infraestrutura municipal (pacote QGIS)

O inventário municipal de 20 de outubro (**não é de têxteis**) entra no modelo só como **apoio**, nunca como rede de têxteis. Detalhe, regras e números em [Análise dos contentores municipais](../dados/analise-contentores-municipais.md).

- **Locais candidatos** (modo `existing`): os 1 187 locais com contentor de rua (`municipal_sites.csv`, `textile_candidate = true`). O investimento perto de zero é pressuposto nosso; falta confirmar com a Vitrus se pode haver têxtil nesses locais e a que custo.
- **Cobertura**: parte da área a 200/300/500 m de um local público (31,4%, 47,8%, 70,9%), em CAOP 2019 e EPSG:3763. É cobertura de **área**; a de população precisa de BGRI.
- **Lacuna por freguesia** (`municipal_by_parish.csv`): `potencial = pop × 0,7 kg × 12`, `lacuna = potencial × (1 − 22,9%)`, igual captura média em todas as freguesias porque não há têxtil recolhido por freguesia; **estimativa**. Ordena-se por tonelada de lacuna por local candidato.
- **Freguesias**: a atribuição de uma coordenada à freguesia usa o polígono CAOP 2019, nunca o nome escrito.
- **Na base de dados e na API**: `municipal_containers` (2 751), `municipal_sites` (2 026), `municipal_parish_stats` (48, com o contorno), `municipal_links` (394) e `municipal_meta`, importados no `seed` com a fonte e o SHA-256 do pacote; nunca na tabela `containers`. A lista candidata é ordenada por uma regra explícita sem pesos inventados (coordenada precisa; freguesia com mais lacuna estimada por candidato; enterrado; orgânico a menos de 15 m; mais contentores). Rotas e permissões em [Arquitetura](arquitetura.md#rede-municipal-municipal). **Nomes de produtores** (estabelecimentos privados): por omissão não saem da API; só um `admin` os pede, à espera da decisão da Vitrus (pergunta 12 da análise).

## Pressupostos

| Parâmetro | Valor | Estado |
| --- | --- | --- |
| Têxtil por habitante (*q*) | 0,7 kg/hab/mês | Fonte: Plano de Ação Integrado (URBACT), p. 30. **Significado por confirmar** (secção 1, Q6): total ou só o que fica no indiferenciado |
| Habitantes | 156 830 | Fonte: INE, Censos 2021 (soma das freguesias) |
| Taxa de captura por modo (*c*) | baixo / médio / alto | Pressuposto, a calibrar no piloto |
| Distância máxima a pé por modo | a definir | Pressuposto, validar com o mentor |
| Custo por recolha e por km | a pedir | Vitrus, dia 1 |
| Custo de um contentor de rua | a pedir | Vitrus, dia 1 |
| Variação da sensibilidade | ±30%, distribuição triangular | Pressuposto da equipa (secção 5), configurável |
| Recolha francesa: 4,27 kg/hab/ano; 1 ponto por 1 414 hab | referência externa | Por verificar (registo C1, C2) |
| Pesos do piloto (0,25 / 0,15 / 0,30 / 0,30) | valor de aprendizagem | Pressuposto da equipa (secção 5) |
| Efeito de desenho do ensaio (deff) e peso médio da peça | 2; 0,415 kg | Pressuposto, a validar no piloto (secção 5) |
| Vida útil do equipamento (*N*) | a pedir | Vitrus, dia 1 |
| Têxtil em locais municipais existentes sem investimento | a confirmar | Pressuposto (secção 6); perguntar à Vitrus |
| Captura média igual em todas as freguesias (lacuna por freguesia) | 22,9% | Pressuposto: sem têxtil recolhido por freguesia (secção 6) |

Regra: nenhum valor entra em `apps/api/src/novelo/features/planning/params.py` sem uma linha nesta tabela. Os custos e as taxas por modo estão lá marcados como `assumption` e aparecem com a sua origem no ecrã "Pressupostos".

## 7. Validação do modelo

Só há um ano de têxtil (2025, totais anuais por entidade), por isso **não há backtest temporal e não se finge um**. O ecrã «Validação» (`/validation`, `GET /validation/model`, código em `domain/validation.py` e `features/validation/`) faz só o que os dados reais deixam fazer:

- **Triangulação do potencial.** Confronta as leituras publicadas do têxtil gerado por habitante e mostra a captura de 2025 que cada uma implica: 0,7 kg/mês do plano municipal (8,4 kg/ano, captura 22,9%), 5,4% × 315 kg do indiferenciado (17,0 kg/ano, 11,3%) e 4,55% × 517 kg da composição dos RSU em Portugal (23,5 kg/ano, 8,2%). Em nenhuma Guimarães passa de 22,9%; todas são **estimativa**. A referência francesa (4,27 kg/hab/ano) continua marcada «por verificar».
- **Validação cruzada espacial (deixar uma de fora).** Cada freguesia é prevista só com as outras 47, na proporção da população, e comparada com os contentores municipais que lá estão. Resultado (48 freguesias): R² 0,76 e erro mediano de 36% em todos os contentores; 0,84 nos enterrados; 0,06 nos de superfície, onde a população não diz onde estão. Não prova a procura de têxtil: mostra que a população é um proxy razoável do sítio onde a recolha existe, e onde deixa de ser.
- **O que não se testa (e como se resolve):** série temporal (precisa dos quilos mensais por entidade; a H Sarah Trading tem-nos por mês), custos locais (a Vitrus ainda não os enviou) e contentores de têxteis (localizações por receber). O piloto de três meses fecha o ciclo previsto contra observado.
