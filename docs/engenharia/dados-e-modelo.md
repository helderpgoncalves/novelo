# Dados e modelo

O modelo tem três passos: quanto têxtil há em cada zona, quanto custa cada forma de o recolher, e que combinação dá o menor custo para a meta escolhida. Cada número que entra tem fonte ou está marcado como pressuposto.

## Fontes de dados

| Dado | Fonte | Uso |
| --- | --- | --- |
| População por subsecção | INE, Censos 2021 (BGRI) | Procura por zona |
| Limites de freguesia | CAOP, Direção-Geral do Território | Agregar e mostrar no mapa |
| Estradas e locais candidatos (escolas, supermercados, juntas) | OpenStreetMap, extrato de Portugal | Rotas e pontos de recolha em locais existentes |
| Têxtil recolhido, circuitos, viaturas e caracterização do lixo | Vitrus Ambiente (ver [análise dos dados](../dados/analise-dados-recebidos.md)) | Ponto de partida e rede de circuitos |
| RSU recolhido em 2025: 43 051 t | Vitrus Ambiente, email do mentor de 21 de outubro de 2026 (ver [respostas](../dados/analise-dados-recebidos.md#respostas-da-vitrus-de-21-out-2026)) | Base da procura (secção 1) |
| Têxtil no RSU: 5,4% | APA, valor indicado pela Vitrus a 21 de outubro de 2026 | Base da procura (secção 1) |
| Contentores **municipais** de indiferenciado, orgânico e seletivo (2 751) e CAOP 2019 | Vitrus Ambiente, pacote QGIS de 20 de outubro de 2026 (ver [análise](../dados/analise-contentores-municipais.md)) | Base geográfica: onde o têxtil se perde no lixo e onde a viatura já passa. Locais candidatos sem contentor novo (investimento perto de zero, **pressuposto**), procura por local, produtores B2B, geometria oficial das freguesias, densidade. ETL `municipal_containers.py` → `data/processed/municipal_*` |
| Custos unitários (recolha, km) | Vitrus Ambiente, pedidos ao departamento financeiro a 21 de outubro (não estão no site) | Modelo de custos; até lá, pressupostos |

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
- `on_demand`: recolha a pedido, porta a porta, nos circuitos que já existem (sem km novos onde já passa um circuito).

`street` (contentor de rua) fica no modelo só como **referência** explícita (por exemplo, o desempenho francês, que é de contentores), nunca por omissão.

## 2. Modelo de custos

```latex
\text{custo anual} = \frac{\text{investimento}}{N} + \text{recolhas} \cdot c_{\text{recolha}} + \text{km} \cdot c_{\text{km}}
```

```latex
\text{EUR/t} = \frac{\text{custo anual}}{\sum_z C_z}
```

*N* = anos de vida do equipamento. Pontos em locais existentes têm investimento perto de zero (sem contentor novo); recolha a pedido não tem investimento mas tem km; o contentor de rua, só como referência, tem investimento e recolha.

**Receita.** A reciclagem é mais cara que a fibra virgem (Vitrus, 21 de outubro de 2026), por isso não conta como receita. O valor está na reutilização: têxtil limpo e seco.

## 3. Otimização

1. **Localização e modo (CP-SAT, OR-Tools):** escolher que pontos candidatos abrir e que modo serve cada zona (por omissão `existing` e `on_demand`; `street` só se pedido), para **maximizar toneladas captadas com o orçamento dado** ou **minimizar custo para uma meta de captura**. Uma zona só conta como servida se tiver um ponto dentro da distância a pé definida para esse modo.
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

- **Tornado:** cada parâmetro de custo e de procura varia ±30% (configurável, `swing`), um de cada vez, sobre o plano do cenário. Resultado: impacto em €/t, toneladas e custo anual, ordenado por impacto em €/t. Cada barra leva a origem do parâmetro (dados da Vitrus e da APA, ou pressuposto).
- **Monte Carlo:** 500 amostras (configurável), semente fixa 7, distribuição triangular `Tri(1 − s, 1 + s, moda 1)` multiplicada ao pressuposto, independente por parâmetro. Devolve P10/P50/P90 de €/t, custo anual e toneladas, e a probabilidade de o €/t ficar abaixo de um limiar.
- **Decisão: não se resolve o CP-SAT em cada amostra.** Reavalia-se o modelo de custos sobre o plano já otimizado (mesmas freguesias e modos; os km usam as rotas reais do cenário, por isso o caso central reproduz os KPIs gravados). A pergunta é "o plano que propomos aguenta se os pressupostos estiverem errados?"; reotimizar a cada amostra responderia a "quanto custaria o melhor plano se soubéssemos a verdade?", sempre mais otimista, e custaria horas.
- **Exemplo (21 out 2026, base Vitrus + APA, rede sem contentores, estimativa):** cenário por freguesia com 60 000 €/ano (gasta 46 192 €): 371,7 t a 124,3 €/t. P10 97,7, P50 124,7, P90 161,1 €/t. Os 5 maiores fatores de incerteza são todos pressupostos sem dado (cobertura e captura do local existente, ±57,6 €/t cada; kg por recolha a pedido, ±53,5; custo por recolha, ±53,1; captura da recolha a pedido, ±31,4). O kg/hab/mês saiu do topo: passou a vir da Vitrus e da APA.

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
- **Limite alcançável do modelo (21 out 2026, estimativa):** **992,8 t/ano** com todos os modos ligados em todas as freguesias (incluindo o contentor de rua à densidade francesa). A meta (669,7 t) fica **323,1 t abaixo do teto**: com a nova base o cenário "custo mínimo para a meta" deixa de ser `infeasible`. Sem contentores (só local existente e recolha a pedido), o teto do modelo por freguesia é **597,7 t/ano** (orçamento sem limite: 156 530 €/ano, 261,9 €/t), ainda acima da meta francesa.
- É o único sítio onde o modo `street` entra: a referência francesa é de contentores de rua, que a Vitrus não quer. Serve para comparar, não para propor.

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

- **Locais candidatos** (modo `existing`): os 1 187 locais com contentor municipal de rua (`municipal_sites.csv`, `textile_candidate = true`). Nenhum recebe contentor de têxtil: a viatura para e recolhe sacos fechados no momento. O investimento perto de zero é pressuposto nosso; falta confirmar com a Vitrus o tempo e o custo da paragem.
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

Regra: nenhum valor entra em `apps/api/src/novelo/features/planning/params.py` sem uma linha nesta tabela. Os custos e as taxas por modo estão lá marcados como `assumption` e aparecem com a sua origem no ecrã "Pressupostos".

## 7. Validação do modelo

Só há um ano de têxtil (2025, totais anuais por entidade), por isso **não há backtest temporal e não se finge um**. O ecrã «Validação» (`/validation`, `GET /validation/model`, código em `domain/validation.py` e `features/validation/`) faz só o que os dados reais deixam fazer:

- **Triangulação do potencial.** A leitura principal é a da Vitrus e da APA: 5,4% × 43 051 t de RSU = 14,8 kg/hab/ano por desviar, captura de 2025 de 11,5%. As outras leituras publicadas ficam só como triangulação: 4,55% × 517 kg da composição dos RSU em Portugal (23,5 kg/ano, captura 8,2%) e duas leituras do plano municipal, **não usadas pela Vitrus**: 5,4% × 315 kg do indiferenciado (17,0 kg/ano, 11,3%) e 0,7 kg/mês (8,4 kg/ano, 22,9%). Todas são **estimativa**. A referência francesa (4,27 kg/hab/ano) continua marcada «por verificar».
- **Validação cruzada espacial (deixar uma de fora).** Cada freguesia é prevista só com as outras 47, na proporção da população, e comparada com os contentores municipais que lá estão. Resultado (48 freguesias): R² 0,76 e erro mediano de 36% em todos os contentores; 0,84 nos enterrados; 0,06 nos de superfície, onde a população não diz onde estão. Não prova a procura de têxtil: mostra que a população é um proxy razoável do sítio onde a recolha existe, e onde deixa de ser.
- **O que não se testa (e como se resolve):** série temporal (precisa dos quilos mensais por entidade; a H Sarah Trading tem-nos por mês), custos locais (pedidos ao departamento financeiro da Vitrus) e têxtil por contentor ou por freguesia (a Vitrus não tem dados de deposição de têxtil). O piloto de três meses fecha o ciclo previsto contra observado.

## 8. Rede por locais reais

O modelo por freguesia (secções 1 a 3) decide **que modo** serve cada freguesia, com um ponto no centro dela. A rede por locais reais decide **que locais abrir**: usa os 1 187 locais públicos de contentores municipais que a Vitrus enviou a 20 de outubro de 2026 (`municipal_sites`, `textile_candidate = true`) como candidatos. São sítios onde a viatura já passa; nenhum recebe contentor de têxtil. Código em `domain/siting.py` (funções puras) e `features/planning/site_service.py`; escolhe-se no simulador («Rede: Locais reais») ou com `siting: "sites"` no pedido de cenário. O resultado tem o mesmo contrato do cenário por freguesia (alocações, rotas, KPIs), mais `result.sites` e `result.siting`.

**Procura por ponto.** Os habitantes não estão localizados abaixo da freguesia (o BGRI não chegou). Cada freguesia reparte a sua procura pelos seus locais públicos com contentores (1 574 pontos de procura), na proporção do número de contentores do local: `t_i = D_z · w_i / Σ w · c`. Representa onde o têxtil se perde no lixo (indiferenciado, orgânico, seletivo), não onde pôr contentores. É um proxy, validado ao nível da freguesia (R² 0,76; ver secção 7), e por isso tudo o que daqui sai leva «estimativa».

**Cobertura.** Um ponto fica servido se houver um local aberto a menos de `radius_m` (200, 300 ou 500 m; 300 por omissão). Vários locais a servir o mesmo ponto não captam duas vezes (cobertura por união).

**Escolha dos locais.** Cobertura máxima com orçamento (ou custo mínimo para uma meta) em CP-SAT: `x_j` = abrir o local `j`, `y_i` ≤ Σ `x_j` dos locais ao alcance, maximizar Σ `t_i · y_i` com Σ `custo_j · x_j` ≤ orçamento. O custo fixo de um local é `capex/N + recolhas/ano · c_recolha`, com os pressupostos do modo `existing` por omissão (investimento quase nulo, captura pressuposto da equipa); o modo `street` só entra se for pedido como referência. Pontos com os mesmos locais ao alcance juntam-se (não muda o ótimo). Uma solução gulosa (o local com mais têxtil novo por euro) entra como dica completa, por isso o CP-SAT nunca devolve pior do que ela; semente fixa e um só trabalhador (determinismo).

**Rotas e km.** O VRP (a mesma função da rede por freguesia) corre sobre os locais abertos, com capacidade das viaturas e o desvio da estrada. Como os km não são lineares nos locais escolhidos, o orçamento do solver sobe ou desce pela folga ou excesso do custo real (locais + km) até o cenário caber no orçamento pedido (até 4 voltas).

**Recolha a pedido como complemento** (`site_on_demand`, ligado por omissão). Os dois canais captam de forma independente, como no modelo por freguesia: `t_i = D_i · (1 − (1 − c_s · y_i)(1 − c_o · z_p))`, com `z_p` = recolha a pedido ligada na freguesia `p` (custo do `mode_cost` do modelo por zonas, que aproveita os circuitos que já passam).

**Limites.**
- Os contentores são de **outras frações** e não recebem têxtil. A paragem nesses locais, com sacos fechados recolhidos no momento, é um pressuposto a confirmar com a Vitrus (tempo, custo).
- Cobertura de **população por proxy**, não por quarteirão. A coordenada aproximada (3 casas, ~100 m) de 350 locais é assinalada.
- A sensibilidade (tornado e Monte Carlo) e a robustez também funcionam nos cenários por locais, mas sobre os locais e as rotas já escolhidos (não reotimiza): ver «Sensibilidade por locais» abaixo. Cenários por locais calculados antes de existir `served_share` têm de ser recalculados (a API responde 409).
- Os locais de produtores (hotelaria, lares, escolas: 452) não entram como candidatos nem como procura; ficam para um módulo B2B.

**O que os locais reais mudam (21 out 2026, base Vitrus + APA, pressupostos por omissão, estimativa).** Mesmo orçamento (60 000 €/ano) em todas as linhas; o têxtil por desviar é 2 324,8 t/ano. As duas últimas linhas usam o contentor de rua só como **referência** (a Vitrus não quer contentores de têxtil).

| Rede | Gasta | Têxtil | €/t | Locais | Cobertura |
| --- | --- | --- | --- | --- | --- |
| Por freguesia (local existente e recolha a pedido) | 46 192 € | 371,7 t | 124,3 | 59 pontos | 74,1% |
| Locais reais, local existente sem contentor novo, 300 m, com recolha a pedido | 59 502 € | 377,5 t | 157,6 | 181 locais + 13 freguesias a pedido | 83,0% |
| Locais reais, local existente sem contentor novo, 500 m, com recolha a pedido | 59 616 € | 441,7 t | 134,9 | 132 locais + 17 freguesias a pedido | 90,8% |
| Referência: locais reais, contentor de rua, 300 m | 59 347 € | 518,6 t | 114,4 | 189 locais | 78,0% |
| Referência: locais reais, contentor de rua, 500 m, com recolha a pedido | 59 831 € | 627,4 t | 95,4 | 150 locais + 9 freguesias a pedido | 91,7% |

Leitura: sem contentores, a rede por locais reais a 500 m desvia 441,7 t (19% do têxtil no lixo) a 134,9 €/t, mais 70 t do que a rede por freguesia a quase o mesmo €/t; a 300 m o €/t sobe 17%. O contentor de rua parece mais barato por tonelada só porque o seu pressuposto de captura (28,6%) é mais alto que o do local existente (18%); o modelo **não conta a contaminação** que a Vitrus aponta (têxtil de contentor perde valor de reutilização), por isso não é comparável e fica só como referência. Os locais escolhidos são locais onde a viatura já passa (contentores municipais), sem contentor novo.

**Correção de 21 out 2026.** O ciclo de orçamento podia ficar preso com o custo real ligeiramente acima do pedido (ex.: 60 095 € para 60 000 €) e devolver `infeasible` com dinheiro de sobra; agora o corte parte do custo que o solver viu para a solução escolhida, e se o CP-SAT não tiver solução no tempo dado usa-se a dica gulosa.

**Sensibilidade por locais.** `domain/sensitivity.py` reavalia o plano fixo (locais abertos, rotas e freguesias com recolha a pedido) sem solver. Por freguesia, com `a` = fração da procura servida por locais (`allocation.served_share`) e `z` = recolha a pedido ligada: `têxtil = D · (c_s·a + c_o·z − c_s·c_o·a·z)`; `custo = locais · (capex/N + recolhas · c_recolha) + km das rotas · c_km + custo da recolha a pedido`, com os km das rotas a escalar com o desvio de estrada e com as recolhas por ano. Com os pressupostos centrais reproduz os KPIs do cenário (teste `test_sensitivity_reproduces_the_site_scenario`). O tornado só varia os parâmetros que contam para esta rede (captura, investimento, vida útil, recolhas, custos por recolha e por km, desvio, kg/hab/mês e, se houver recolha a pedido, os seus parâmetros).

**Velocidade.** Cada cenário por locais demora 20 a 40 s (CP-SAT, VRP e até 4 voltas de orçamento). Um pedido igual (mesmos dados, pressupostos e opções; só o nome muda) sai da cache em memória em milissegundos (32 entradas, um só cálculo para pedidos simultâneos iguais). No arranque, com `SEED_REFERENCE_SCENARIOS=true`, criam-se em segundo plano 5 cenários de referência (20 000, 40 000, 60 000, 100 000 e 150 000 €/ano) se ainda não houver nenhum por locais.
