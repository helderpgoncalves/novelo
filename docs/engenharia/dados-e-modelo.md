# Dados e modelo

O modelo tem três passos: quanto têxtil há em cada zona, quanto custa cada forma de o recolher, e que combinação dá o menor custo para a meta escolhida. Cada número que entra tem fonte ou está marcado como pressuposto.

## Fontes de dados

| Dado | Fonte | Uso |
| --- | --- | --- |
| População por subsecção | INE, Censos 2021 (BGRI) | Procura por zona |
| Limites de freguesia | CAOP 2019, Direção-Geral do Território (no pacote QGIS da Vitrus) | Agregar, mostrar no mapa, área e densidade, e freguesia de cada localidade dos circuitos |
| Estradas e locais candidatos (escolas, supermercados, juntas) | OpenStreetMap, extrato de Portugal | Rotas e pontos de recolha em locais existentes |
| Têxtil recolhido, circuitos, viaturas e caracterização do lixo | Vitrus Ambiente (ver [análise dos dados](../dados/analise-dados-recebidos.md)) | Ponto de partida e rede de circuitos |
| RSU recolhido em 2025: 43 051 t | Vitrus Ambiente, email do mentor de 21 de outubro de 2026 (ver [respostas](../dados/analise-dados-recebidos.md#respostas-da-vitrus-de-21-out-2026)) | Base da procura (secção 1) |
| Têxtil no RSU: 5,4% | APA, valor indicado pela Vitrus a 21 de outubro de 2026 | Base da procura (secção 1) |
| Contentores **municipais** de indiferenciado, orgânico e seletivo (2 751) e CAOP 2019 | Vitrus Ambiente, pacote QGIS de 20 de outubro de 2026 (ver [análise](../dados/analise-contentores-municipais.md)) | Base geográfica: onde o têxtil se perde no lixo e onde a viatura já passa. Locais candidatos sem contentor novo (investimento perto de zero, **pressuposto**), procura por local, produtores B2B, geometria oficial das freguesias, densidade. ETL `municipal_containers.py` → `data/processed/municipal_*` |
| Circuitos porta a porta (dias, localidades) e planeamento de turnos (viatura e tripulação por dia) | Vitrus Ambiente (`data/processed/circuits.csv`, `shifts.csv`, `localities.csv`) | Recolha de têxtil nos circuitos PAP que já passam, sem km novos (secção 9) |
| Custos unitários (recolha, km) e custo de tratamento do indiferenciado por tonelada | Vitrus Ambiente, pedidos ao departamento financeiro a 21 de outubro (não estão no site) | Modelo de custos e poupança no tratamento; até lá, pressupostos ou «por validar» |

**Localidades dos circuitos → freguesia (22 out 2026).** As 82 localidades escritas nos circuitos ligam cada circuito às freguesias. O ETL (`scripts/etl/locality_parishes.py`, chamado por `build_processed.py`) usa a CAOP 2019, por esta ordem: (1) uma tabela explícita de correções pelo nome (`CORRECTIONS`: localidade → freguesia, com a razão), só quando o nome é uma freguesia ou freguesia antiga que aparece, sem ambiguidade, no nome oficial de **uma só** freguesia da CAOP (o ETL verifica-o e falha se não for assim; ex.: «Donin» → Donim, na União de Briteiros Santo Estêvão e Donim); as coordenadas ficam as do Nominatim se caírem dentro dessa freguesia, senão o **centroide CAOP** do polígono; (2) ponto-em-polígono na CAOP para as restantes com coordenadas do Nominatim; (3) as outras ficam **por resolver**. Resultado: 79 de 82 com freguesia (18 pelo nome, 61 pelo ponto); antes eram 71 com coordenadas e 61 com freguesia. Por resolver: «Ruas Estreitas», «Selho Ruas Estreitas» (há três Selhos) e «São Torcato Rua Estreitas Vermil Creixomil (5ª)» (três freguesias numa linha). «Santo Eufémia» (Prazins Santa Eufémia ou Prazins Santo Tirso?) e «Selho» ficam com a freguesia do ponto, por confirmar. Tudo vai para os alertas de qualidade 101 e 102 (`data_alerts.csv`); `localities_geo.csv` guarda o método de cada uma (`parish_method`, `coord_method`, `note`). O que mudou: o C7 (PAP, 60-93-ZG, «Donin; Briteiros S. Estevão») passa a contar; «São Salvador de Briteiros» (C11) sai de Barco, onde o Nominatim a punha (uma empresa), para a sua união; «Senhora da Conceição» (C2) passa de Fermentões para Azurém (o ponto está na fronteira, a 0,5 m; vale a CAOP).

**Não há contentores de têxteis.** A Vitrus não os tem nem os quer (21 de outubro de 2026): o têxtil de contentor vem contaminado e perde a reutilização. A rede proposta é sem contentores. O Plano de Ação Integrado para a Circularidade Têxtil (Município de Guimarães / URBACT) deixou de ser fonte de números do modelo: a Vitrus não o usa; os números vêm da Vitrus e da APA.

## 1. Procura por zona

Têxtil que ainda vai para o lixo na zona *z* por ano, a partir da população e do têxtil por habitante calculado com os valores da Vitrus e da APA:

```latex
D_z = P_z \cdot q \cdot 12 \qquad q = \frac{43\,051\ \text{t} \times 5{,}4\%}{156\,830 \times 12} = 1{,}235\ \text{kg por habitante por mês}
```

No concelho (156 830 habitantes, soma das freguesias, INE) dá 43 051 × 0,054 = **2 324,8 t por ano** por desviar (**estimativa**). As 301,3 t que as quatro entidades recolheram em 2025 foram recolhidas à parte, fora do RSU. O têxtil gerado é 2 324,8 + 301,3 = **2 626,0 t** e a captura atual é 301,27 ÷ 2 626,02 = **11,5%** (estimativa). Onde uma caracterização da Vitrus mostrar mais têxtil (rotas com microconfeções), *q* sobe nessa zona. No código, *q* deriva das constantes (43 051 t, 5,4%, população); não se escreve 1,235 à mão.

**Pressuposto e incerteza.** Os 5,4% são uma média da APA, não uma caracterização do lixo de Guimarães, e o modelo aplica-os por igual a todas as freguesias. Por isso a procura leva «estimativa» em todo o ecrã e o kg/hab/mês entra na sensibilidade como parâmetro de maior incerteza. Até 21 de outubro de 2026 usávamos 0,7 kg/hab/mês do plano municipal (≈ 1 317 t, captura 22,9%); a Vitrus não conhece esse plano e indicou os seus valores (pergunta [Q6](../projeto/perguntas-aos-orientadores.md#q6-o-que-significam-07-kghabmês-e-54), respondida). A nova base é quase o dobro da antiga.

Têxtil captado depende do modo de recolha *m* que serve a zona:

```latex
C_z = D_z \cdot c_m
```

A taxa de captura *c* por modo não tem fonte local: é **pressuposto**, visível no ecrã, até haver dados do piloto. Antes calibrávamos o contentor de rua para reproduzir as 301 t de 2025; essa calibração saiu, porque as 301 t são recolhidas por terceiros e não há contentor de têxtil que as reproduza.

**Modos.** Por omissão o modelo só oferece dois, ambos sem contentor:

- `existing`: local existente, sem contentor novo. Entrega assistida num sítio com pessoas (ecocentro, junta, escola) ou, na rede por locais reais, paragem nos locais municipais onde a viatura já passa, com sacos fechados recolhidos no momento. Investimento perto de zero. Menos contaminação que um contentor (pressuposto qualitativo, sem número).
- `on_demand`: recolha a pedido, porta a porta, nos circuitos que já existem. Tem dois canais, sem valor novo no enum (secção 9): **(i) no circuito porta a porta (PAP)**, nas freguesias onde passa um circuito PAP com viatura no planeamento: saco fechado à porta num dia fixo, 0 km novos, custo = recolhas × custo de uma recolha PAP; **(ii) a pedido com desvio**, nas outras: pequeno desvio onde já passa um circuito, senão ida e volta ao depósito (como antes).

`street` (contentor de rua) fica no modelo só como **referência** explícita (por exemplo, o desempenho francês, que é de contentores), nunca por omissão.

## 2. Modelo de custos

```latex
\text{custo anual} = \frac{\text{investimento}}{N} + \text{recolhas} \cdot c_{\text{recolha}} + \text{km} \cdot c_{\text{km}}
```

```latex
\text{EUR/t} = \frac{\text{custo anual}}{\sum_z C_z}
```

*N* = anos de vida do equipamento. Pontos em locais existentes têm investimento perto de zero (sem contentor novo); recolha a pedido não tem investimento mas tem km; o contentor de rua, só como referência, tem investimento e recolha.

**Receita.** A reciclagem é mais cara que a fibra virgem (Vitrus, 21 de outubro de 2026), por isso não conta como receita. O valor está na reutilização: têxtil limpo e seco (59,4% do recolhido em 2025 foi reutilizado); não se conta receita de reutilização, porque não há preço com fonte.

**Poupança no tratamento (custo evitado).** Cada tonelada desviada deixa de ir para tratamento de indiferenciado:

```latex
\text{poupança} = \sum_z C_z \cdot c_{\text{tratamento}}
```

*c*<sub>tratamento</sub> (`rsu_treatment_eur_per_t`, €/t) foi pedido ao departamento financeiro da Vitrus a 21 de outubro de 2026. Até chegar fica **nulo** e o KPI `kpis.avoided_treatment_eur` sai nulo, mostrado «por validar»; nunca um valor inventado. Código: `domain/costs.avoided_treatment_eur`.

## 3. Otimização

1. **Localização e modo (CP-SAT, OR-Tools):** escolher que pontos candidatos abrir e que modo serve cada zona (por omissão `existing` e `on_demand`; `street` só se pedido), para **maximizar toneladas captadas com o orçamento dado** ou **minimizar custo para uma meta de captura**. Uma zona só conta como servida se tiver um ponto dentro da distância a pé definida para esse modo.
2. **Rotas (VRP, OR-Tools):** com os pontos abertos, calcular rotas por veículo com capacidade e frequência de recolha, com distâncias em linha reta (haversine) e um fator de desvio de 1,3. Não há ainda cliente OSRM: a variável `OSRM_URL` existe mas não é usada, e distâncias por estrada ficam para quando houver dados de GPS ou um motor de rotas. A recolha a pedido aproveita os circuitos que já passam pela localidade, sem quilómetros novos.
3. **KPIs:** investimento, custo anual, toneladas, €/t, % de população coberta e **têxtil reutilizável** (abaixo).

**Têxtil reutilizável (22 out 2026).** O desafio pede material reutilizável e a Vitrus diz que o valor está na reutilização. Os KPIs de cada cenário (por freguesia e por locais) trazem, com `domain/reuse.py`:

```latex
r = \frac{\sum_e \text{reutilização}_e}{\sum_e \text{recolhido}_e} \qquad \text{reutilizável} = T \cdot r \qquad \text{EUR/t reutilizável} = \frac{\text{custo anual}}{T \cdot r}
```

*r* (`reuse_share`) calcula-se dos fluxos de têxtil na base (`textile_flows`, as 4 entidades de 2025): 178,99 ÷ 301,27 = **59,4%**. O intervalo (`reuse_share_low` e `_high`, `reusable_t_low` e `_high`) usa a menor e a maior quota **só das entidades pesadas** (kg exatos por destino): H Sarah Trading 59,316 ÷ 118,632 = **50,0%** e Ultriplo 97,722 ÷ 134,130 = **72,9%**. Nova Etapa (50%, percentagens de relatório) e a amostra Vitrus (9,2%, To Be Green, 5,6 t) entram na quota central mas não no intervalo; os 9,2% ficam como nota, não como limite. Aplica-se igual a todos os modos: **não há dado de qualidade por canal** (o modelo também não desconta a contaminação do contentor de rua, que fica só como referência). Tudo é **estimativa**; os campos são opcionais e ficam nulos nos cenários calculados antes.

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

- **Tornado:** cada parâmetro de custo e de procura varia ±30% (configurável, `swing`), um de cada vez, sobre o plano do cenário. Resultado: impacto em €/t, toneladas e custo anual, ordenado por impacto em €/t. Cada barra leva a origem do parâmetro (dados da Vitrus e da APA, ou pressuposto).
- **Monte Carlo:** 500 amostras (configurável), semente fixa 7, distribuição triangular `Tri(1 − s, 1 + s, moda 1)` multiplicada ao pressuposto, independente por parâmetro. Devolve P10/P50/P90 de €/t, custo anual e toneladas, e a probabilidade de o €/t ficar abaixo de um limiar.
- **Decisão: não se resolve o CP-SAT em cada amostra.** Reavalia-se o modelo de custos sobre o plano já otimizado (mesmas freguesias e modos; os km usam as rotas reais do cenário, por isso o caso central reproduz os KPIs gravados). A pergunta é "o plano que propomos aguenta se os pressupostos estiverem errados?"; reotimizar a cada amostra responderia a "quanto custaria o melhor plano se soubéssemos a verdade?", sempre mais otimista, e custaria horas.
- **Exemplo (22 out 2026, base Vitrus + APA, rede sem contentores, recolha a pedido no circuito porta a porta onde há, localidades na freguesia CAOP, estimativa):** cenário por freguesia com 60 000 €/ano (gasta 47 839 €): 396,5 t a 120,6 €/t, das quais **235,6 t reutilizáveis** (198,3 a 288,9 t) a **203,1 € por tonelada reutilizável**. P10 96,9, P50 122,5, P90 154,7 €/t (iguais a 21 out à décima). Os 5 maiores fatores de incerteza são todos pressupostos sem dado (kg por recolha a pedido, ±54,8 €/t; custo de uma recolha no circuito PAP, ±49,9; cobertura e captura do local existente, ±49,2 cada; captura da recolha a pedido, ±27,7). O kg/hab/mês saiu do topo: passou a vir da Vitrus e da APA.

### Robustez

`GET /planning/compare-robustness`: com amostras **emparelhadas** (os mesmos fatores perturbam os pressupostos de ambos os cenários), mede em que fração das amostras o cenário recomendado é estritamente melhor que o alternativo (€/t, custo ou toneladas). `holds` é verdadeiro se a fração for pelo menos `min_share` (por omissão 80%).

### Cenário de referência: desempenho francês

| Pressuposto | Valor | Estado e fonte |
| --- | --- | --- |
| Recolha por habitante | 4,27 kg/hab/ano | **Por verificar.** Registo de afirmações C1 (Refashion via F10), fonte secundária, `docs/pesquisa/registo-de-afirmacoes.md` |
| Densidade de pontos | 1 por 1 414 habitantes (contentor de rua) | **Por verificar.** Registo C2 (F10), fonte secundária |

Só entra como cenário de comparação (`GET /planning/benchmarks`, `POST /planning/benchmarks/{key}/scenario`), nunca como pressuposto base. Consequências com os dados reais (registo C13 a C15):

- Meta: 4,27 × 156 830 / 1000 = **669,7 t/ano** (2,2 vezes as 301,3 t de hoje; hoje são 1,92 kg/hab/ano).
- Equivale a captar **25,5%** do têxtil gerado (669,7 / 2 626,0, cálculo, estimativa); a Vitrus capta 11,5%.
- **Limite alcançável do modelo (21 out 2026, estimativa):** **992,8 t/ano** com todos os modos ligados em todas as freguesias (incluindo o contentor de rua à densidade francesa). A meta (669,7 t) fica **323,1 t abaixo do teto**: com a nova base o cenário "custo mínimo para a meta" deixa de ser `infeasible`. Sem contentores (só local existente e recolha a pedido), o teto do modelo por freguesia é **597,7 t/ano** (orçamento sem limite, 22 out 2026: 138 866 €/ano, 232,3 €/t, com a recolha a pedido no circuito porta a porta em 22 freguesias; a 21 out eram 147 490 € com 19), ainda abaixo da meta francesa.
- É o único sítio onde o modo `street` entra: a referência francesa é de contentores de rua, que a Vitrus não quer. Serve para comparar, não para propor.

### Piloto de 3 meses

`POST /planning/pilot` escolhe `k` freguesias (2 a 4) por pesquisa exaustiva e determinista. Valor de aprendizagem do conjunto = soma ponderada de quatro componentes em [0, 1]:

| Componente | Peso | Definição |
| --- | --- | --- |
| Território | 0,25 | amplitude urbano-rural pela TIPAU (APU = 0, AMU = 1, APR = 2): (mais rural − mais urbano) / 2 |
| Densidade | 0,15 | contraste de ln(hab/km²) do conjunto / o de todas as freguesias |
| Circuitos | 0,30 | média de min(dias/semana de circuito / 2, 1): recolha a pedido sem km novos (`piggyback_min_days`); dias com passagem de indiferenciado com viatura (`service_days`, secção 9) |
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

- **Locais candidatos** (modo `existing`): os 1 187 locais com contentor municipal de rua (`municipal_sites.csv`, `textile_candidate = true`) e os 86 **pontos assistidos** (escolas, secção 8). Nenhum recebe contentor de têxtil: a viatura para e recolhe sacos fechados no momento. O investimento perto de zero é pressuposto nosso; falta confirmar com a Vitrus o tempo e o custo da paragem.
- **Cobertura**: parte da área a 200/300/500 m de um local público (31,4%, 47,8%, 70,9%), em CAOP 2019 e EPSG:3763. É cobertura de **área**; a de população precisa de BGRI.
- **Lacuna por freguesia** (`municipal_by_parish.csv`): têxtil que ainda vai para o lixo, `lacuna = pop × 1,235 kg × 12`, o mesmo por habitante em todas as freguesias porque não há têxtil por freguesia; **estimativa**. Ordena-se por tonelada de lacuna por local candidato.
- **Freguesias**: a atribuição de uma coordenada à freguesia usa o polígono CAOP 2019, nunca o nome escrito.
- **Na base de dados e na API**: `municipal_containers` (2 751), `municipal_sites` (2 026), `municipal_parish_stats` (48, com o contorno), `municipal_links` (394) e `municipal_meta`, importados no `seed` com a fonte e o SHA-256 do pacote; nunca na tabela `containers`. A lista candidata é ordenada por uma regra explícita sem pesos inventados (coordenada precisa; freguesia com mais lacuna estimada por candidato; enterrado; orgânico a menos de 15 m; mais contentores). Rotas e permissões em [Arquitetura](arquitetura.md#rede-municipal-municipal). **Nomes de produtores** (estabelecimentos privados): por omissão não saem da API; só um `admin` os pede, à espera da decisão da Vitrus (pergunta 12 da análise).

## Pressupostos

| Parâmetro | Valor | Estado |
| --- | --- | --- |
| RSU recolhido pela Vitrus (2025) | 43 051 t | Fonte: Vitrus, 21 de outubro de 2026 |
| Têxtil no RSU | 5,4% | Fonte: APA, indicado pela Vitrus |
| Têxtil por habitante por desviar (*q*) | 1,235 kg/hab/mês (derivado) | Cálculo: 43 051 t × 5,4% ÷ 156 830 ÷ 12; **estimativa** |
| Habitantes | 156 830 | Fonte: INE, Censos 2021 (soma das freguesias) |
| Taxa de captura por modo (*c*) | baixo / médio / alto | Pressuposto, a calibrar no piloto (já não há calibração do contentor de rua) |
| Modos por omissão | `existing` e `on_demand` | Decisão (Vitrus, 21 de outubro): sem contentores de têxtil; `street` só como referência |
| Distância máxima a pé por modo | a definir | Pressuposto, validar com o mentor |
| Custo por recolha e por km | pressuposto | Pedido ao departamento financeiro da Vitrus (21 de outubro) |
| Custo de um contentor de rua | pressuposto | Só para o cenário de referência; a Vitrus não quer contentores |
| Variação da sensibilidade | ±30%, distribuição triangular | Pressuposto da equipa (secção 5), configurável |
| Recolha francesa: 4,27 kg/hab/ano; 1 ponto por 1 414 hab | referência externa | Por verificar (registo C1, C2) |
| Pesos do piloto (0,25 / 0,15 / 0,30 / 0,30) | valor de aprendizagem | Pressuposto da equipa (secção 5) |
| Efeito de desenho do ensaio (deff) e peso médio da peça | 2; 0,415 kg | Pressuposto, a validar no piloto (secção 5) |
| Vida útil do equipamento (*N*) | pressuposto | Pedido à Vitrus |
| Paragem em locais municipais existentes sem investimento | a confirmar | Pressuposto (secção 6); perguntar à Vitrus o tempo e o custo da paragem |
| Têxtil por habitante igual em todas as freguesias | 1,235 kg/hab/mês | Pressuposto: sem caracterização nem têxtil por freguesia (secções 1 e 6) |
| Custo de uma recolha no circuito porta a porta (`pap_cost_per_pickup_eur`) | 6 € (= custo de uma recolha) | Pressuposto, teto conservador até a Vitrus dar o tempo extra de paragem (secção 9) |
| Capacidade livre para têxtil numa ronda PAP (`pap_free_capacity_kg`) | nulo, por validar | A pedir à Vitrus; sem valor, só se assinala a ronda acima da capacidade total da viatura (secção 9) |
| Custo de tratamento do indiferenciado (`rsu_treatment_eur_per_t`) | nulo, por preencher | Fonte: Vitrus, departamento financeiro (pedido a 21 out 2026); a poupança aparece «por validar» (secção 2) |
| Ponto assistido (escola) com os pressupostos do modo `existing` | captura, investimento, recolhas | Pressuposto, sem dados próprios (secção 8) |
| Litros desconhecidos de um contentor | mediana do tipo | Regra explícita (secção 8); 10 contentores, todos de produtores |
| Quota de reutilização igual em todos os modos | 59,4% (50,0% a 72,9%) | Calculada dos fluxos de 2025 na base, não escrita à mão; aplicá-la a todos os canais é **pressuposto** (não há qualidade por canal; secção 3) |
| Proximidade na matriz de cobertura | % da área a ≤ 300 m de um local municipal | Proxy de área, não de população (sem BGRI; secção 10) |
| Localidades dos circuitos sem freguesia inequívoca | ficam sem freguesia | Regra explícita (Fontes de dados); 3 por resolver e 2 por confirmar nos alertas 101 e 102 |

Regra: nenhum valor entra em `apps/api/src/novelo/features/planning/params.py` sem uma linha nesta tabela. Os custos e as taxas por modo estão lá marcados como `assumption` e aparecem com a sua origem no ecrã "Pressupostos".

## 7. Validação do modelo

Só há um ano de têxtil (2025, totais anuais por entidade), por isso **não há backtest temporal e não se finge um**. O ecrã «Validação» (`/validation`, `GET /validation/model`, código em `domain/validation.py` e `features/validation/`) faz só o que os dados reais deixam fazer:

- **Triangulação do potencial.** A leitura principal é a da Vitrus e da APA: 5,4% × 43 051 t de RSU = 14,8 kg/hab/ano por desviar, captura de 2025 de 11,5%. As outras leituras publicadas ficam só como triangulação: 4,55% × 517 kg da composição dos RSU em Portugal (23,5 kg/ano, captura 8,2%) e duas leituras do plano municipal, **não usadas pela Vitrus**: 5,4% × 315 kg do indiferenciado (17,0 kg/ano, 11,3%) e 0,7 kg/mês (8,4 kg/ano, 22,9%). Todas são **estimativa**. A referência francesa (4,27 kg/hab/ano) continua marcada «por verificar».
- **Validação cruzada espacial (deixar uma de fora).** Cada freguesia é prevista só com as outras 47, na proporção da população, e comparada com os contentores municipais que lá estão. Resultado (48 freguesias): R² 0,76 e erro mediano de 36% em todos os contentores; 0,84 nos enterrados; 0,06 nos de superfície, onde a população não diz onde estão. Não prova a procura de têxtil: mostra que a população é um proxy razoável do sítio onde a recolha existe, e onde deixa de ser. Em **capacidade** (litros) em vez de número de contentores o R² sobe para 0,80; por isso a rede por locais reparte a procura pela capacidade (secção 8).
- **Coerência da rede de circuitos com as freguesias (22 out 2026).** Cada localidade dos circuitos fica na freguesia oficial (CAOP 2019) pelo nome, quando o nome decide, ou pelo ponto (Fontes de dados). Testes: `test_etl_localities.py` (regras com polígonos feitos à mão e o C7 em Donim no ficheiro real) e `test_service_days_count_only_undifferentiated_circuits_with_a_vehicle` (dias de serviço à mão: Ronfe 6, centro histórico 0, Pinheiro 0, Donim 3). As 3 localidades por resolver ficam fora das passagens por freguesia e estão nos alertas, não escondidas.
- **O que não se testa (e como se resolve):** série temporal (precisa dos quilos mensais por entidade; a H Sarah Trading tem-nos por mês), custos locais (pedidos ao departamento financeiro da Vitrus) e têxtil por contentor ou por freguesia (a Vitrus não tem dados de deposição de têxtil). O piloto de três meses fecha o ciclo previsto contra observado.

## 8. Rede por locais reais

O modelo por freguesia (secções 1 a 3) decide **que modo** serve cada freguesia, com um ponto no centro dela. A rede por locais reais decide **que locais abrir**: usa os 1 187 locais públicos de contentores municipais que a Vitrus enviou a 20 de outubro de 2026 (`municipal_sites`, `textile_candidate = true`) como candidatos. São sítios onde a viatura já passa; nenhum recebe contentor de têxtil. Código em `domain/siting.py` (funções puras) e `features/planning/site_service.py`; escolhe-se no simulador («Rede: Locais reais») ou com `siting: "sites"` no pedido de cenário. O resultado tem o mesmo contrato do cenário por freguesia (alocações, rotas, KPIs), mais `result.sites` e `result.siting`.

**Procura por ponto.** Os habitantes não estão localizados abaixo da freguesia (o BGRI não chegou). Cada freguesia reparte a sua procura pelos seus locais públicos com contentores (1 574 pontos de procura), na proporção da **capacidade** dos contentores do local, em litros: `t_i = D_z · w_i / Σ w · c`, com `w_i` = litros no local (`domain/siting.capacity_weights`). Litros desconhecidos (10 contentores, todos de produtores de orgânico) valem a **mediana do tipo** de contentor (enterrado e plataforma 5 000 L; superfície, orgânico coletivo e verdes 1 100 L; orgânico de produtor 80 L); um tipo sem nenhum valor conhecido usaria a mediana de todos. Representa onde o têxtil se perde no lixo (indiferenciado, orgânico, seletivo), não onde pôr contentores. É um proxy e por isso tudo o que daqui sai leva «estimativa».

**Contagem ou capacidade (decisão de 21 out 2026).** Validado como na secção 7, por freguesia, contra a população (INE): nos 1 574 pontos de procura, R² população × **litros = 0,80** contra população × **número de contentores = 0,64**; em todos os contentores (o ecrã «Validação»), 0,80 contra 0,76. A capacidade segue melhor a população (um enterrado de 5 000 L serve mais gente do que um de superfície de 1 100 L), por isso o modelo passou a repartir pela capacidade. Teste: `test_demand_weight_by_capacity_follows_population_better_than_by_count`. O mapa da landing (`apps/web/scripts/gen-landing-data.mjs`) usa a mesma regra.

**Candidatos** (`site_candidates`, por omissão `both`):

- `public`: os 1 187 locais públicos de contentores municipais (`textile_candidate = true`): a viatura para e recolhe sacos fechados no momento.
- `staffed`: os 86 **pontos assistidos**, escolas da rede municipal (`producer_types` com Escola): têxtil entregue no interior, com pessoas (caixa ou saco, esvaziado pela recolha), sem contentor de rua. As escolas já têm uma campanha de têxteis com a Vitrus. Usam os pressupostos de captura e custo do modo `existing` (pressuposto marcado; não há dados próprios). Os lares ficam no canal B2B. Nomes de produtores nunca saem num cenário (`result.sites[].kind = "staffed"` e `producer_types`).
- `both`: os dois conjuntos (1 273 candidatos). É o que dá mais toneladas e menor €/t (tabela abaixo), por isso é o valor por omissão. Com `site_mode = street` (só referência) os candidatos são sempre os públicos.

**Canal B2B** (`GET /municipal/b2b-channel`): lares e hotelaria da rede municipal (roupa de cama e toalhas, têxtil limpo de alto valor de reutilização), com os locais reais e contagens por tipo e freguesia; sem nomes, salvo admin que os peça. Não há quilos por estabelecimento: `tonnes_year` é nulo, «a medir no piloto».

**Cobertura.** Um ponto fica servido se houver um local aberto a menos de `radius_m` (200, 300 ou 500 m; 300 por omissão). Vários locais a servir o mesmo ponto não captam duas vezes (cobertura por união).

**Escolha dos locais.** Cobertura máxima com orçamento (ou custo mínimo para uma meta) em CP-SAT: `x_j` = abrir o local `j`, `y_i` ≤ Σ `x_j` dos locais ao alcance, maximizar Σ `t_i · y_i` com Σ `custo_j · x_j` ≤ orçamento. O custo fixo de um local é `capex/N + recolhas/ano · c_recolha`, com os pressupostos do modo `existing` por omissão (investimento quase nulo, captura pressuposto da equipa); o modo `street` só entra se for pedido como referência. Pontos com os mesmos locais ao alcance juntam-se (não muda o ótimo). Uma solução gulosa (o local com mais têxtil novo por euro) entra como dica completa, por isso o CP-SAT nunca devolve pior do que ela; semente fixa e um só trabalhador (determinismo).

**Rotas e km.** O VRP (a mesma função da rede por freguesia) corre sobre os locais abertos, com capacidade das viaturas e o desvio da estrada. Como os km não são lineares nos locais escolhidos, o orçamento do solver sobe ou desce pela folga ou excesso do custo real (locais + km) até o cenário caber no orçamento pedido (até 4 voltas).

**Recolha a pedido como complemento** (`site_on_demand`, ligado por omissão). Os dois canais captam de forma independente, como no modelo por freguesia: `t_i = D_i · (1 − (1 − c_s · y_i)(1 − c_o · z_p))`, com `z_p` = recolha a pedido ligada na freguesia `p` (custo do `mode_cost` do modelo por zonas, que aproveita os circuitos que já passam).

**Limites.**
- Os contentores são de **outras frações** e não recebem têxtil. A paragem nesses locais, com sacos fechados recolhidos no momento, é um pressuposto a confirmar com a Vitrus (tempo, custo).
- Cobertura de **população por proxy**, não por quarteirão. A coordenada aproximada (3 casas, ~100 m) de 350 locais é assinalada.
- A sensibilidade (tornado e Monte Carlo) e a robustez também funcionam nos cenários por locais, mas sobre os locais e as rotas já escolhidos (não reotimiza): ver «Sensibilidade por locais» abaixo. Cenários por locais calculados antes de existir `served_share` têm de ser recalculados (a API responde 409).
- Os locais de produtores (452) não entram como procura. Das escolas fazem-se pontos assistidos; lares e hotelaria são o canal B2B; restauração, estabelecimentos e grandes produtores ficam de fora.

**O que os locais reais mudam (22 out 2026, base Vitrus + APA, procura pela capacidade, recolha a pedido no circuito porta a porta onde há, localidades na freguesia CAOP, pressupostos por omissão, estimativa).** Mesmo orçamento (60 000 €/ano) em todas as linhas, todas com recolha a pedido a completar; o têxtil por desviar é 2 324,8 t/ano. «Reutilizável» = têxtil × 59,4% (secção 3). As duas últimas linhas usam o contentor de rua só como **referência** (a Vitrus não quer contentores de têxtil).

| Rede | Gasta | Têxtil | €/t | Reutilizável | Locais | Cobertura |
| --- | --- | --- | --- | --- | --- | --- |
| Por freguesia (local existente e recolha a pedido) | 47 839 € | 396,5 t | 120,6 | 235,6 t | 55 pontos + 20 freguesias no circuito PAP | 75,0% |
| Locais reais, públicos e escolas (`both`, por omissão), 300 m | 59 416 € | 416,8 t | 142,6 | 247,6 t | 154 públicos + 8 escolas + 13 freguesias a pedido | 85,2% |
| Locais reais, públicos e escolas (`both`, por omissão), 500 m | 59 571 € | 481,0 t | 123,9 | 285,8 t | 114 públicos + 10 escolas + 14 freguesias a pedido | 93,4% |
| Locais reais, só públicos, 300 m | 59 571 € | 412,6 t | 144,4 | 245,1 t | 157 locais + 14 freguesias a pedido | 83,5% |
| Locais reais, só públicos, 500 m | 59 805 € | 471,4 t | 126,9 | 280,1 t | 116 locais + 17 freguesias a pedido | 89,4% |
| Locais reais, só escolas (`staffed`), 300 m | 59 634 € | 288,1 t | 207,0 | 171,2 t | 43 escolas + 28 freguesias a pedido | 50,8% |
| Locais reais, só escolas (`staffed`), 500 m | 59 528 € | 387,5 t | 153,6 | 230,2 t | 54 escolas + 26 freguesias a pedido | 69,7% |
| Referência: locais reais, contentor de rua, 300 m | 59 374 € | 567,5 t | 104,6 | 337,2 t | 170 locais + 7 freguesias a pedido | 84,2% |
| Referência: locais reais, contentor de rua, 500 m | 59 832 € | 649,0 t | 92,2 | 385,6 t | 129 locais + 12 freguesias a pedido | 90,8% |

Leitura: sem contentores, a rede por locais reais a 500 m com públicos e escolas desvia 481,0 t (20,7% do têxtil no lixo) a 123,9 €/t, mais 84,4 t do que a rede por freguesia a quase o mesmo €/t; a 300 m o €/t sobe 15%. Só com escolas a rede fica curta (86 candidatos): as escolas valem como complemento, não como rede única. Com a procura pela capacidade e o canal PAP, os números subiram face à versão de 21 out de manhã (por freguesia 371,7 → 396,2 t; locais a 500 m 441,7 → 479,9 t); a 22 out, com as localidades na freguesia CAOP e os dias de serviço só de indiferenciado, mudaram pouco (por freguesia 396,2 → 396,5 t; locais a 500 m 479,9 → 481,0 t). O contentor de rua parece mais barato por tonelada só porque o seu pressuposto de captura (28,6%) é mais alto que o do local existente (18%); o modelo **não conta a contaminação** que a Vitrus aponta (têxtil de contentor perde valor de reutilização; a quota reutilizável é a mesma para todos os modos), por isso não é comparável e fica só como referência. Os locais escolhidos são locais onde a viatura já passa (contentores municipais), sem contentor novo.

**Correção de 21 out 2026.** O ciclo de orçamento podia ficar preso com o custo real ligeiramente acima do pedido (ex.: 60 095 € para 60 000 €) e devolver `infeasible` com dinheiro de sobra; agora o corte parte do custo que o solver viu para a solução escolhida, e se o CP-SAT não tiver solução no tempo dado usa-se a dica gulosa.

**Sensibilidade por locais.** `domain/sensitivity.py` reavalia o plano fixo (locais abertos, rotas e freguesias com recolha a pedido) sem solver. Por freguesia, com `a` = fração da procura servida por locais (`allocation.served_share`) e `z` = recolha a pedido ligada: `têxtil = D · (c_s·a + c_o·z − c_s·c_o·a·z)`; `custo = locais · (capex/N + recolhas · c_recolha) + km das rotas · c_km + custo da recolha a pedido`, com os km das rotas a escalar com o desvio de estrada e com as recolhas por ano. Com os pressupostos centrais reproduz os KPIs do cenário (teste `test_sensitivity_reproduces_the_site_scenario`). O tornado só varia os parâmetros que contam para esta rede (captura, investimento, vida útil, recolhas, custos por recolha e por km, desvio, kg/hab/mês e, se houver recolha a pedido, os seus parâmetros).

**Velocidade.** Cada cenário por locais demora 20 a 40 s (CP-SAT, VRP e até 4 voltas de orçamento). Um pedido igual (mesmos dados, pressupostos e opções; só o nome muda) sai da cache em memória em milissegundos (32 entradas, um só cálculo para pedidos simultâneos iguais). No arranque, com `SEED_REFERENCE_SCENARIOS=true`, garantem-se em segundo plano 5 cenários de referência por locais (20 000, 40 000, 60 000, 100 000 e 150 000 €/ano) e 1 por freguesia (60 000 €/ano), recalculados quando mudam o modelo (`REFERENCE_MODEL_VERSION`) ou os pressupostos ativos, ou quando lhes falta o plano de recolha (ver [Arquitetura](arquitetura.md#cenários-de-referência)).

## 9. Recolha no circuito porta a porta (PAP)

O canal principal sem contentores: um saco de têxtil fechado, posto à porta num dia fixo da semana, segue na viatura do circuito porta a porta que **já passa** nessa freguesia nesse dia. Sem km novos e sem contentor. Código em `domain/door_to_door.py` (funções puras), `network.mode_cost` (custo) e `features/planning/collection_plan.py` (plano no resultado).

**Que freguesias.** Circuitos de **indiferenciado** com `collection_key = door_to_door` (C7 a C24). O BIO 1 (porta a porta de orgânico) fica de fora: numa viatura de biorresíduos o têxtil molha-se e perde o valor de reutilização, que é a contaminação que a Vitrus quer evitar, ligados à freguesia pelas suas localidades (freguesia CAOP 2019, ver Fontes de dados). Só contam os dias com **viatura no planeamento de turnos** desse grupo de dias (segunda a sexta, sábado, domingo): os 8 circuitos PAP sem viatura (C8, C12, C15, C20 a C24) não contam, porque sem viatura ninguém leva o saco (pergunta à Vitrus). Resultado (22 out 2026): **22 das 48 freguesias** (67 349 habitantes) têm passagem PAP com viatura; está em `ZoneOut.door_to_door` (circuito, dia, viatura, tripulação). Eram 19 (61 597 habitantes): entram a União de Briteiros Santo Estêvão e Donim (C7), a de Briteiros São Salvador e Santa Leocádia (C9, C11), a de Leitões, Oleiros e Figueiredo (C16) e a de Souto e Gondomar (C10), e sai Barco (o C11 só lá estava pela geocodificação errada de «São Salvador de Briteiros»).

**Dias de serviço (`service_days`, 22 out 2026).** Dias distintos da semana com passagem de um circuito de **indiferenciado** (porta a porta ou moloks) **com viatura** no planeamento de turnos: os mesmos critérios das passagens PAP, com qualquer tipo de recolha de indiferenciado (`domain/door_to_door.weekdays_served`). Decidem o desvio da recolha a pedido (`piggyback_min_days`) e o critério «Circuitos» do piloto. Antes contava o máximo de dias de qualquer circuito da localidade, mesmo de orgânico, recicláveis ou sem viatura; o têxtil nunca vai num circuito de orgânico. Mudou em 7 freguesias: Oliveira, São Paio e São Sebastião (só o BIO 1, orgânico) 7 → 0; Pinheiro (só o C22, sem viatura) 6 → 0; Aldão, Gonça, Atães e Rendufe, e Candoso São Tiago e Mascotelos 3 → 0; Creixomil 7 → 6.

**Custo.** Mesma captura do modo `on_demand` (`c · f`); muda o custo:

```latex
\text{recolhas} = \frac{C_z \cdot 1000}{\text{kg por recolha}} \qquad \text{custo} = \text{recolhas} \cdot c_{\text{PAP}} \qquad \text{km novos} = 0
```

*c*<sub>PAP</sub> (`pap_cost_per_pickup_eur`) é o tempo extra de paragem, que a Vitrus ainda não deu: até lá, 6 €, o mesmo que uma recolha normal (teto conservador, porque a viatura já para nessa porta). Nas freguesias sem PAP com viatura, a recolha a pedido continua **com desvio** (1,5 km por recolha onde passa um circuito de indiferenciado com viatura 2 ou mais dias por semana, `service_days`; senão ida e volta ao depósito).

**Dia fixo (regra explícita e determinista).** As freguesias entram por ordem decrescente de toneladas (empate: código) e cada uma fica com a passagem (circuito, dia) com menos kg de têxtil já atribuídos; empate: o dia mais cedo, depois o código do circuito. A carga reparte-se pelas rondas em vez de cair toda na primeira.

**Capacidade.** kg por ronda = t/ano × 1000 / 52. A capacidade livre de uma viatura PAP para sacos de têxtil (`pap_free_capacity_kg`) é **por validar** com a Vitrus: enquanto for nula, `fits_capacity` é nulo, exceto se a ronda passar a capacidade total da viatura (`vehicle_capacity_t`), e aí é `false`. Não se inventa capacidade.

**No resultado.** `result.collection_plan`: por freguesia com recolha a pedido, o canal (`door_to_door` ou `detour`), circuito e todos os circuitos PAP, dia, viatura, tripulação, km novos, toneladas, recolhas por ano, kg por ronda e da ronda, e se cabe. Nulo nos cenários calculados antes; a sensibilidade desses cenários reavalia-os sem o canal PAP, para reproduzir os KPIs guardados.

**Números (22 out 2026, 60 000 €/ano, estimativa).** Por freguesia: 20 freguesias no circuito PAP (das 22 possíveis; as uniões de Sande Vila Nova e Sande São Clemente e de Selho São Lourenço e Gominhães ficam só com local existente), 129,3 t/ano, 0 km novos, nenhuma a pedido com desvio (a 21 out: 19 freguesias, 128,7 t). Exemplos: Creixomil · C14 (PAP) · segunda · BD-86-EN · 0 km novos · 20,1 t/ano (387 kg por ronda); Ponte · C14 · terça · BD-86-EN · 13,8 t; Caldelas · C11 · segunda · 49-GC-80 · 13,1 t; Fermentões · C13 · segunda · 79-CN-84 · 11,9 t. A ronda mais carregada leva 387 kg; cabe na viatura (4 t), mas o espaço livre está por validar. Com orçamento sem limite, as 22 freguesias PAP levam 139,5 t e as outras 26 vão a pedido com desvio (185,3 t, 34 394 km/ano); a 21 out eram 19 com 127,6 t e 29 com 197,2 t e 42 235 km/ano.

**Limites.** Três localidades continuam sem freguesia («Ruas Estreitas» do C22; «Selho Ruas Estreitas» e «São Torcato Rua Estreitas Vermil Creixomil (5ª)» do C14) e duas ficam com a freguesia do ponto, por confirmar («Santo Eufémia» do C3 e C13; «Selho» do C4): alertas 101 e 102. C14 lista localidades com dia próprio («Campelos (4ª)»); o modelo usa os dias do circuito. Mesmo no indiferenciado, a viatura compacta o lixo: como o saco de têxtil vai separado (compartimento, gancho ou caixa na viatura) é pergunta à Vitrus.

## 10. Matriz de cobertura (Diretiva 2025/1892)

O art. 22.º-C, n.º 9, alínea b) da Diretiva (UE) 2025/1892 pede que a rede de recolha tenha em conta a dimensão e a densidade da população, o volume previsto, a acessibilidade e a proximidade, e que não se limite às zonas onde a recolha é mais rendível. `GET /planning/scenarios/{scenario_id}/coverage` (`get_scenario_coverage`, mesma sessão que o GET do cenário) devolve, para um cenário guardado, sem números novos:

- **Por freguesia:** TIPAU (INE), população (Censos 2021), área CAOP 2019 e densidade (população ÷ área), volume previsto (`demand_t`, a procura do modelo), **proximidade** (`area_within_300m_pct`: % da área a ≤ 300 m de um local de contentores municipais, `municipal_parish_stats.cover_pct_300m`; é área, não população, porque não há população por quarteirão), **acessibilidade** (`door_to_door_days_week`: dias com passagem PAP de indiferenciado com viatura; `service_days`, secção 9) e, do cenário, modos, canais (`door_to_door`, `detour`, `existing`, `street`; `on_demand` nos cenários sem plano de recolha), toneladas, população servida e fração servida, custo anual.
- **Por TIPAU** (APU, AMU, APR) e no total: freguesias, população, população servida e %, toneladas, custo e €/t.
- **Não limitado às zonas rendíveis** (`equity`): % da população servida nas freguesias não predominantemente urbanas (AMU e APR) contra as urbanas (APU) e a razão entre as duas (1 = a mesma cobertura).

Código: `domain/coverage_matrix.py` (funções puras, testadas à mão), `features/planning/coverage_service.py`. A rede atual (circuitos, contentores) é a de hoje; o resto é o que o cenário gravou.

**Cenário por freguesia de 60 000 €/ano (22 out 2026, estimativa).**

| TIPAU | Freguesias | População | Servida | % servida | Têxtil | Custo | €/t |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Predominantemente urbana (APU) | 36 | 135 460 | 102 948 | 76,0% | 344,3 t | 39 182 € | 113,8 |
| Mediamente urbana (AMU) | 11 | 20 671 | 14 277 | 69,1% | 50,7 t | 8 284 € | 163,6 |
| Predominantemente rural (APR) | 1 | 699 | 419 | 59,9% | 1,6 t | 373 € | 240,0 |
| Concelho | 48 | 156 830 | 117 644 | 75,0% | 396,5 t | 47 839 € | 120,6 |

Fora das freguesias urbanas (21 370 habitantes) o cenário serve 68,8% da população, contra 76,0% nas urbanas (razão 0,905), mesmo a um €/t mais alto (163,6 e 240,0 contra 113,8): a rede proposta não fica só onde a tonelada sai mais barata. A freguesia APR é uma só (Arosa e Castelões, 699 habitantes), por isso a linha APR vale pouco sozinha.

