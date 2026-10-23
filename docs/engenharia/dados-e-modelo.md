# Dados e modelo

O modelo tem três passos: quanto têxtil há em cada zona, quanto custa cada forma de o recolher, e que combinação dá o menor custo para a meta escolhida. Cada número que entra tem fonte ou está marcado como pressuposto.

## Fontes de dados

| Dado | Fonte | Uso |
| --- | --- | --- |
| População por subsecção | INE, Censos 2021 (BGRI) | Procura por zona |
| Limites de freguesia | CAOP 2019, Direção-Geral do Território (no pacote QGIS da Vitrus) | Agregar, mostrar no mapa, área e densidade, e freguesia de cada localidade dos circuitos |
| Estradas e locais candidatos (escolas, supermercados, juntas) | OpenStreetMap, extrato de Portugal (Geofabrik, ODbL; © colaboradores do OpenStreetMap) | Km e traçado das rotas pela estrada (OSRM próprio, [Rotas por estrada](rotas-reais.md)) e pontos de recolha em locais existentes |
| Têxtil recolhido, circuitos, viaturas e caracterização do lixo | Vitrus Ambiente (ver [análise dos dados](../dados/analise-dados-recebidos.md)) | Ponto de partida e rede de circuitos |
| Indiferenciado recolhido pela Vitrus em 2025: 43 050,5 t, 84,0% do concelho (concelho ≈ 51 250,6 t) | Vitrus Ambiente, Relatório e Contas 2025, p. 8; base indicada pelo mentor a 22 de outubro de 2026 | Base da procura (secção 1) |
| Têxtil no indiferenciado: 5,86% | APA, RARU 2025, p. 24 (indiferenciado nacional de 2025), indicado pela Vitrus a 22 de outubro de 2026 | Base da procura (secção 1) |
| Tratamento do indiferenciado: 105,64 €/t (40 €/t de taxa de gestão de resíduos + 65,64 €/t de tarifa da Resinorte) | Vitrus Ambiente, mentor, 22 de outubro de 2026 | Tratamento evitado e custo líquido (secção 2) |
| Estaleiro Operacional, Rua das Lameiras, Polvoreira: 41,41823, −8,30164 | Vitrus Ambiente (confirmado pelo mentor a 22 de outubro de 2026); coordenadas do link «Localização GPS» do estaleiro em vitrusambiente.pt/contactos | Origem e fim de todas as rotas da viatura dedicada |
| Contentores **municipais** de indiferenciado, orgânico e seletivo (2 751) e CAOP 2019 | Vitrus Ambiente, pacote QGIS de 20 de outubro de 2026 (ver [análise](../dados/analise-contentores-municipais.md)) | Base geográfica: onde o têxtil se perde no lixo e onde a viatura já passa. Locais candidatos sem contentor novo (investimento perto de zero, **pressuposto**), procura por local, produtores B2B, geometria oficial das freguesias, densidade. ETL `municipal_containers.py` → `data/processed/municipal_*` |
| Circuitos porta a porta (dias, localidades) e planeamento de turnos (viatura e tripulação por dia) | Vitrus Ambiente (`data/processed/circuits.csv`, `shifts.csv`, `localities.csv`) | Rede atual: acessibilidade na matriz de cobertura e hábito de recolha no piloto. **Não levam têxtil** (secção 9) |
| Custos unitários (hora e km das viaturas) | Vitrus Ambiente, pedidos ao departamento financeiro a 21 de outubro; a 22 de outubro ainda não tinham chegado | Modelo de custos; até lá, pressupostos |
| Preço de uma viatura de caixa fechada: 42 500 € sem IVA | Município de Vila Nova de Gaia, adjudicação do lote VII («um veículo pesado de mercadorias com caixa fechada», MBP Automóveis Portugal): anúncio TED 338951-2024, adjudicação TED 72690-2025; no mesmo concurso, ligeiros de mercadorias a 41 338 € (lote V) e com plataforma elevatória a 44 300 € (lote VI) por viatura | Investimento na viatura dedicada (secção 9); **pressuposto** até a Vitrus ter um orçamento |

**Localidades dos circuitos → freguesia (22 out 2026).** As 82 localidades escritas nos circuitos ligam cada circuito às freguesias. O ETL (`scripts/etl/locality_parishes.py`, chamado por `build_processed.py`) usa a CAOP 2019, por esta ordem: (1) uma tabela explícita de correções pelo nome (`CORRECTIONS`: localidade → freguesia, com a razão), só quando o nome é uma freguesia ou freguesia antiga que aparece, sem ambiguidade, no nome oficial de **uma só** freguesia da CAOP (o ETL verifica-o e falha se não for assim; ex.: «Donin» → Donim, na União de Briteiros Santo Estêvão e Donim); as coordenadas ficam as do Nominatim se caírem dentro dessa freguesia, senão o **centroide CAOP** do polígono; (2) ponto-em-polígono na CAOP para as restantes com coordenadas do Nominatim; (3) as outras ficam **por resolver**. Resultado: 79 de 82 com freguesia (18 pelo nome, 61 pelo ponto); antes eram 71 com coordenadas e 61 com freguesia. Por resolver: «Ruas Estreitas», «Selho Ruas Estreitas» (há três Selhos) e «São Torcato Rua Estreitas Vermil Creixomil (5ª)» (três freguesias numa linha). «Santo Eufémia» (Prazins Santa Eufémia ou Prazins Santo Tirso?) e «Selho» ficam com a freguesia do ponto, por confirmar. Tudo vai para os alertas de qualidade 101 e 102 (`data_alerts.csv`); `localities_geo.csv` guarda o método de cada uma (`parish_method`, `coord_method`, `note`). O que mudou: o C7 (PAP, 60-93-ZG, «Donin; Briteiros S. Estevão») passa a contar; «São Salvador de Briteiros» (C11) sai de Barco, onde o Nominatim a punha (uma empresa), para a sua união; «Senhora da Conceição» (C2) passa de Fermentões para Azurém (o ponto está na fronteira, a 0,5 m; vale a CAOP).

**Não há contentores de têxteis.** A Vitrus não os tem nem os quer (21 de outubro de 2026): o têxtil de contentor vem contaminado e perde a reutilização. A rede proposta é sem contentores. O Plano de Ação Integrado para a Circularidade Têxtil (Município de Guimarães / URBACT) deixou de ser fonte de números do modelo: a Vitrus não o usa; os números vêm da Vitrus e da APA.

## 1. Procura por zona

Têxtil que ainda vai para o lixo na zona *z* por ano, a partir da população e do têxtil por habitante calculado com os valores da Vitrus e da APA (22 de outubro de 2026):

```latex
D_z = P_z \cdot q \cdot 12 \qquad q = \frac{(43\,050{,}5\ \text{t} \div 0{,}840) \times 5{,}86\%}{156\,830 \times 12} = 1{,}596\ \text{kg por habitante por mês}
```

A Vitrus recolhe 43 050,5 t de indiferenciado, 84,0% do concelho (Relatório e Contas 2025, p. 8): o concelho todo são 43 050,5 ÷ 0,840 ≈ **51 250,6 t**. Com 5,86% de têxtil (APA, RARU 2025, p. 24) dá ≈ **3 003,3 t por ano** por desviar (**estimativa**). As 301,3 t que as quatro entidades recolheram em 2025 foram recolhidas à parte, fora do indiferenciado. O têxtil gerado é 3 003,3 + 301,3 ≈ **3 304,6 t** e a captura atual é 301,27 ÷ 3 304,6 ≈ **9,1%** (estimativa). Onde uma caracterização da Vitrus mostrar mais têxtil (rotas com microconfeções), *q* sobe nessa zona. No código, *q* deriva das constantes (`features/textile/references.py`: 43 050,5 t, 0,840, 5,86%, população); não se escreve 1,596 à mão. Nos pressupostos guarda-se a 5 casas (1,59583): a 4 casas o potencial daria 3 003,2 t em vez de 3 003,3 t.

**Pressuposto e incerteza.** Os 5,86% são a média nacional da APA, não uma caracterização do lixo de Guimarães, e o modelo aplica-os por igual a todas as freguesias. Por isso a procura leva «estimativa» em todo o ecrã e o kg/hab/mês entra na sensibilidade. Bases anteriores, que já não se usam: 0,7 kg/hab/mês do plano municipal (≈ 1 317 t, captura 22,9%; a Vitrus não conhece esse plano, pergunta [Q6](../projeto/perguntas-aos-orientadores.md#q6-o-que-significam-07-kghabmês-e-54)) e, a 21 de outubro, 43 051 t × 5,4% = 2 324,8 t (só a parte da Vitrus e uma percentagem que afinal vinha de um estudo local de 2016, ver [análise](../dados/analise-dados-recebidos.md)). A base de 22 de outubro é 29% maior do que a de 21.

Têxtil captado depende do modo de recolha *m* que serve a zona:

```latex
C_z = D_z \cdot c_m
```

A taxa de captura *c* por modo não tem fonte local: é **pressuposto**, visível no ecrã, até haver dados do piloto. Antes calibrávamos o contentor de rua para reproduzir as 301 t de 2025; essa calibração saiu, porque as 301 t são recolhidas por terceiros e não há contentor de têxtil que as reproduza.

**Modos.** Por omissão o modelo só oferece dois, ambos sem contentor:

- `existing`: local existente, sem contentor novo. Entrega assistida num sítio com pessoas (ecocentro, junta, escola) ou, na rede por locais reais, paragem nos locais municipais onde a viatura já passa, com sacos fechados recolhidos no momento. Investimento perto de zero. Menos contaminação que um contentor (pressuposto qualitativo, sem número).
- `on_demand`: saco fechado posto à porta num dia fixo e recolhido pela **viatura dedicada ao têxtil**, numa ronda por freguesia a cada *N* semanas (secção 9). Já não há canal no circuito porta a porta nem desvio de um circuito: a Vitrus confirmou a 22 de outubro de 2026 que o saco não pode ir na compactadora (vai para a caixa de compactação e estraga-se; cabine, gancho ou caixa lateral também não) e que uma compactadora não pode fazer uma volta só de têxtil (contaminação).

Toda a recolha de têxtil, nos dois modos, é feita pela mesma viatura nova, de caixa fechada e sem compactação, a partir do estaleiro de Polvoreira (o «meio novo de recolha» que a Vitrus indicou). Também não há viaturas livres à tarde: a folha de turnos tinha um erro (Vitrus, 22 de outubro), por isso o antigo «plano B» de uma volta de têxtil à tarde com uma viatura parada saiu.

`street` (contentor de rua) fica no modelo só como **referência** explícita (por exemplo, o desempenho francês, que é de contentores), nunca por omissão.

## 2. Modelo de custos

```latex
\text{custo anual} = \frac{\text{investimento}}{N} + \text{recolhas} \cdot c_{\text{recolha}} + \text{km} \cdot c_{\text{km}}
```

```latex
\text{EUR/t} = \frac{\text{custo anual}}{\sum_z C_z}
```

*N* = anos de vida do equipamento. Pontos em locais existentes têm investimento perto de zero (sem contentor novo); recolha a pedido não tem investimento próprio mas tem km; o contentor de rua, só como referência, tem investimento e recolha. A **viatura dedicada** soma-se à rede: `⌈horas por ano ÷ horas de uma viatura⌉ × preço ÷ vida útil` (secção 9), paga logo que a rede recolha alguma coisa. Nos KPIs entra no investimento (`capex_eur`, com `vehicle_capex_eur` à parte) e no custo anual (`vehicle_annual_eur`); nas freguesias reparte-se pela proporção das horas, para a soma das freguesias (mapa, cobertura, €/t por TIPAU) bater com o cenário.

**Receita.** A reciclagem é mais cara que a fibra virgem (Vitrus, 21 de outubro de 2026), por isso não conta como receita. O valor está na reutilização: têxtil limpo e seco (59,4% do recolhido em 2025 foi reutilizado); não se conta receita de reutilização, porque não há preço com fonte.

**Poupança no tratamento (custo evitado).** Cada tonelada desviada deixa de ir para tratamento de indiferenciado:

```latex
\text{poupança} = \sum_z C_z \cdot c_{\text{tratamento}}
```

*c*<sub>tratamento</sub> (`rsu_treatment_eur_per_t`) = **105,64 €/t**: 40 €/t de taxa de gestão de resíduos (TGR) de aterro + 65,64 €/t de tarifa da Resinorte (Vitrus, 22 de outubro de 2026). É dado da Vitrus; só fica nulo se alguém o apagar nos pressupostos. Código: `domain/costs.avoided_treatment_eur`.

**Custo líquido para o município.** O que o município paga mesmo: o custo anual da rede menos o tratamento que deixa de pagar.

```latex
\text{custo líquido} = \text{custo anual} - \text{tratamento evitado} \qquad \text{EUR/t líquido} = \frac{\text{custo líquido}}{\sum_z C_z}
```

KPIs `net_annual_cost_eur` e `net_eur_per_tonne` (estimativa; podem ser negativos: o tratamento evitado paga mais do que a recolha). Código: `domain/costs.net_cost_eur`. Com 60 000 €/ano por freguesia (rotas pela estrada, 23 out 2026) o cenário custa 43 914 €/ano (operação 35 702 €) e evita 45 542 € de tratamento (431,1 t × 105,64 €/t): custo líquido de **−1 628 €/ano** (−3,8 €/t). Cobre a operação e, por pouco (3,7%), o custo total com a viatura; não é uma folga garantida (o P90 do €/t, 139,7, está acima dos 105,64 €/t evitados). Antes (22 out, linha reta × 1,3): 47 093 € contra 45 828 €, −1 264 € (−2,8 €/t).

## 3. Otimização

1. **Localização e modo (CP-SAT, OR-Tools):** escolher que pontos candidatos abrir e que modo serve cada zona (por omissão `existing` e `on_demand`; `street` só se pedido), para **maximizar toneladas captadas com o orçamento dado** ou **minimizar custo para uma meta de captura**. Uma zona só conta como servida se tiver um ponto dentro da distância a pé definida para esse modo.
2. **Rotas (VRP, OR-Tools):** com os pontos abertos, calcular as viagens da viatura dedicada a partir do estaleiro, com capacidade (2 t) e frequência de recolha, com distâncias **medidas pela estrada** (OSRM sobre o OpenStreetMap, nos dois sentidos; ver [Rotas por estrada](rotas-reais.md)). Só quando o OSRM não responde, ou um par de pontos não tem caminho, a distância é a estimativa de reserva (linha reta, haversine, × `detour_factor`) e essa rota fica marcada `source = estimate` (o resultado resume-as em `routing`: `road`, `mixed` ou `estimate`). A recolha a pedido é uma ronda por freguesia da mesma viatura (secção 9); o número de viaturas é uma variável inteira do MIP (horas ≤ viaturas × horas de uma viatura).
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
- **Exemplo (23 out 2026, rotas pela estrada; procura do concelho × 5,86%, viatura dedicada, estaleiro de Polvoreira, tratamento 105,64 €/t, estimativa):** cenário por freguesia com 60 000 €/ano (gasta 43 914 €): 431,1 t a 101,9 €/t, das quais **256,1 t reutilizáveis** (215,6 a 314,1 t). P10 81,6, P50 103,4, P90 139,7 €/t (toneladas P10 330,6, P50 426,0, P90 537,4). Os maiores fatores de incerteza são pressupostos sem dado: cobertura e captura do local existente (±53,5 €/t cada), kg/hab/mês (±38,4), custo de uma recolha (±38,1) e kg por saco (±28,7). O preço e a vida útil da viatura entram no tornado e no Monte Carlo (`vehicle_capex_eur`, `vehicle_lifetime_years`); a frequência das rondas e a capacidade só com recolha a pedido. Antes (22 out, linha reta × 1,3): 445,8 t a 102,8 €/t, 264,9 t reutilizáveis, P10/P50/P90 82,0/104,4/141,3.

### Robustez

`GET /planning/compare-robustness`: com amostras **emparelhadas** (os mesmos fatores perturbam os pressupostos de ambos os cenários), mede em que fração das amostras o cenário recomendado é estritamente melhor que o alternativo (€/t, custo ou toneladas). `holds` é verdadeiro se a fração for pelo menos `min_share` (por omissão 80%).

### Cenário de referência: desempenho francês

| Pressuposto | Valor | Estado e fonte |
| --- | --- | --- |
| Recolha por habitante | 4,27 kg/hab/ano | **Por verificar.** Registo de afirmações C1 (Refashion via F10), fonte secundária, `docs/pesquisa/registo-de-afirmacoes.md` |
| Densidade de pontos | 1 por 1 414 habitantes (contentor de rua) | **Por verificar.** Registo C2 (F10), fonte secundária |

Só entra como cenário de comparação (`GET /planning/benchmarks`, `POST /planning/benchmarks/{key}/scenario`), nunca como pressuposto base. Consequências com os dados reais (registo C13 a C15):

- Meta: 4,27 × 156 830 / 1000 = **669,7 t/ano** (2,2 vezes as 301,3 t de hoje; hoje são 1,92 kg/hab/ano).
- Equivale a captar **20,3%** do têxtil gerado (669,7 / 3 304,6, cálculo, estimativa); a Vitrus capta 9,1%.
- **Limite alcançável do modelo (23 out 2026, rotas pela estrada, viatura dedicada, estimativa):** **1 282,6 t/ano** com todos os modos ligados em todas as freguesias (incluindo o contentor de rua à densidade francesa; 221 809 €/ano, 172,9 €/t, 2 viaturas). Sem contentores (só local existente e saco à porta), o teto do modelo por freguesia é **772,1 t/ano** (orçamento sem limite, 10 000 000 €/ano no pedido: 176 734 €/ano, 228,9 €/t, 2 viaturas e 6,15 dias de viatura por semana, saco à porta nas 48 freguesias com 419,6 t e 33 858 km/ano). Com a procura do concelho a meta francesa (669,7 t) fica **abaixo do teto sem contentores**: a 21 de outubro (base 2 324,8 t, saco no circuito PAP) o teto sem contentores era 597,7 t. Antes (22 out, linha reta × 1,3): 213 910 €/ano (166,8 €/t) com contentores e 170 623 €/ano (221,0 €/t, 5,64 dias, 29 830 km/ano) sem eles.
- É o único sítio onde o modo `street` entra: a referência francesa é de contentores de rua, que a Vitrus não quer. Serve para comparar, não para propor.

### Piloto de 3 meses

`POST /planning/pilot` escolhe `k` freguesias (2 a 4) por pesquisa exaustiva e determinista. Valor de aprendizagem do conjunto = soma ponderada de quatro componentes em [0, 1]:

| Componente | Peso | Definição |
| --- | --- | --- |
| Território | 0,25 | amplitude urbano-rural pela TIPAU (APU = 0, AMU = 1, APR = 2): (mais rural − mais urbano) / 2 |
| Densidade | 0,15 | contraste de ln(hab/km²) do conjunto / o de todas as freguesias |
| Circuitos | 0,30 | média de min(dias/semana de circuito / 2, 1): **hábito** de pôr o lixo à porta em dias fixos (`pilot.HABIT_DAYS = 2`, pressuposto); dias com passagem de indiferenciado, com ou sem viatura na folha de turnos (`service_days`, secção 9). Até 22 out era «recolha a pedido sem km novos», que a Vitrus excluiu |
| Custo de arranque | 0,30 | 1 − (arranque − mín) / (máx − mín); arranque = investimento + 3 meses de operação |

Os pesos são um **pressuposto da equipa**. A densidade usa a **área geodésica** das freguesias (WGS84, `domain/parish_area.py`), calculada no seed a partir do contorno de cada freguesia em `data/processed/parishes.csv` (origem: `data/raw/public/parishes.geojson`): somam 204,7 km² em 44 das 48 freguesias (o concelho tem cerca de 241 km²). Três freguesias não têm contorno e Briteiros S. Salvador e Santa Leocádia tem um contorno claramente errado (0,004 km²), descartado; nessas quatro a densidade fica em falta e não é inventada.

**Piso de sinal.** Um piloto que capta poucos quilos não mede a taxa de rejeito. Mínimo de toneladas = células (freguesia × modo) × peças por célula × peso médio da peça:

```latex
n = \left\lceil \frac{z^2\, p(1-p)}{h^2} \cdot \mathrm{deff} \right\rceil, \qquad t_{\text{célula}} = n \cdot 0{,}415\ \text{kg}
```

*p* = 14,1% de rejeito (Vitrus, 2025); *h* = 3 pontos percentuais (meia-largura do intervalo a 95%, *z* = 1,96); *deff* = 2 (efeito de desenho: as peças de um mesmo saco não são independentes; convenção de amostragem por conglomerados, **pressuposto a validar**); 0,415 kg = média dos pesos por tipo de peça já usados no passaporte do lote (pressuposto). Dá cerca de 1 030 peças e 0,43 t por célula; com 2 freguesias × 2 modos, **1,71 t em 3 meses**. As combinações abaixo do piso são descartadas e a resposta devolve quantas foram e porquê; se nenhuma o atinge devolve-se a de mais toneladas, com `floor_met = false`. O piso pode ser imposto no pedido (`min_tonnes_pilot`).

**KPIs a medir** (valor previsto e P10-P90, todos "estimativa"): toneladas no piloto, €/t em regime e taxa de rejeito (parte dos 14,1% observados com a mesma incerteza triangular). O €/t do piloto **não** inclui o preço da viatura dedicada (é da rede inteira; um piloto de duas freguesias pode alugar uma carrinha), nem o arranque.

**Números (23 out 2026, estimativa; iguais aos de 22 out: o piloto não depende das rotas).** Piloto recomendado: Aldão e a União das freguesias de Arosa e Castelões; piso de sinal de **1,71 t** em 3 meses (2 freguesias × 2 modos), previsto 2,43 t (P10 1,87, P90 2,99); 538 €/t (424 a 706); nenhuma das 1 128 combinações fica abaixo do piso com a procura nova.

## 6. Infraestrutura municipal (pacote QGIS)

O inventário municipal de 20 de outubro (**não é de têxteis**) entra no modelo só como **apoio**, nunca como rede de têxteis. Detalhe, regras e números em [Análise dos contentores municipais](../dados/analise-contentores-municipais.md).

- **Locais candidatos** (modo `existing`): os 1 187 locais com contentor municipal de rua (`municipal_sites.csv`, `textile_candidate = true`) e os 86 **pontos assistidos** (escolas, secção 8). Nenhum recebe contentor de têxtil: a viatura para e recolhe sacos fechados no momento. O investimento perto de zero é pressuposto nosso; falta confirmar com a Vitrus o tempo e o custo da paragem.
- **Cobertura**: parte da área a 200/300/500 m de um local público (31,4%, 47,8%, 70,9%), em CAOP 2019 e EPSG:3763. É cobertura de **área**; a de população precisa de BGRI.
- **Lacuna por freguesia** (`municipal_by_parish.csv`): têxtil que ainda vai para o lixo, `lacuna = pop × 1,596 kg × 12`, o mesmo por habitante em todas as freguesias porque não há têxtil por freguesia; **estimativa**. Ordena-se por tonelada de lacuna por local candidato.
- **Freguesias**: a atribuição de uma coordenada à freguesia usa o polígono CAOP 2019, nunca o nome escrito.
- **Na base de dados e na API**: `municipal_containers` (2 751), `municipal_sites` (2 026), `municipal_parish_stats` (48, com o contorno), `municipal_links` (394) e `municipal_meta`, importados no `seed` com a fonte e o SHA-256 do pacote; nunca na tabela `containers`. A lista candidata é ordenada por uma regra explícita sem pesos inventados (coordenada precisa; freguesia com mais lacuna estimada por candidato; enterrado; orgânico a menos de 15 m; mais contentores). Rotas e permissões em [Arquitetura](arquitetura.md#rede-municipal-municipal). **Nomes de produtores** (estabelecimentos privados): por omissão não saem da API; só um `admin` os pede, à espera da decisão da Vitrus (pergunta 12 da análise).

## Pressupostos

| Parâmetro | Valor | Estado |
| --- | --- | --- |
| Indiferenciado recolhido pela Vitrus (2025) | 43 050,5 t, 84,0% do concelho | Fonte: Vitrus, Relatório e Contas 2025, p. 8 (indicado a 22 de outubro de 2026) |
| Indiferenciado do concelho | ≈ 51 250,6 t (derivado) | Cálculo: 43 050,5 ÷ 0,840; **estimativa** |
| Têxtil no indiferenciado | 5,86% | Fonte: APA, RARU 2025, p. 24 (indiferenciado nacional), indicado pela Vitrus |
| Têxtil por habitante por desviar (*q*) | 1,596 kg/hab/mês (derivado; 1,59583 nos pressupostos) | Cálculo: 51 250,6 t × 5,86% ÷ 156 830 ÷ 12; **estimativa** |
| Habitantes | 156 830 | Fonte: INE, Censos 2021 (soma das freguesias) |
| Taxa de captura por modo (*c*) | baixo / médio / alto | Pressuposto, a calibrar no piloto (já não há calibração do contentor de rua) |
| Modos por omissão | `existing` e `on_demand` | Decisão (Vitrus, 21 de outubro): sem contentores de têxtil; `street` só como referência |
| Distância máxima a pé por modo | a definir | Pressuposto, validar com o mentor |
| Desvio da estrada (`detour_factor`) | 1,3 (estrada ÷ linha reta) | Pressuposto da equipa. **Já não mede as rotas dos cenários** (vêm do OSRM): só vale na estimativa de reserva, na volta porta a porta dentro da freguesia (fórmula, secção 9) e como alavanca da sensibilidade. Calibração de 23 out 2026 contra a estrada (OSRM, `portugal-261020`): mediana **1,48** nas 48 freguesias e **1,37** em 300 locais candidatos, logo 1,3 é otimista; subir para ~1,4 a 1,5 fica por decidir ([Rotas por estrada](rotas-reais.md#calibração-23-out-2026-dados-portugal-261020)) |
| Custo por recolha (6 €, paragem ou saco) e por km (1,10 €) | pressuposto | Pedido ao departamento financeiro da Vitrus (21 de outubro); a 22 de outubro ainda não tinha chegado |
| Estaleiro (origem das rotas) | 41,41823, −8,30164 | Fonte: Vitrus (Estaleiro Operacional, Rua das Lameiras, Polvoreira; coordenadas do link «Localização GPS» em vitrusambiente.pt/contactos) |
| Viatura dedicada: preço (`vehicle_capex_eur`) | 42 500 € sem IVA | Pressuposto com fonte: adjudicação de «um veículo pesado de mercadorias com caixa fechada», Município de Vila Nova de Gaia (TED 338951-2024, lote VII; adjudicação TED 72690-2025). Valor lido do anúncio de adjudicação no TED; confirmar no Base (portal com certificado que não abriu daqui) |
| Viatura dedicada: vida útil (`vehicle_lifetime_years`) | 8 anos (5 312,50 €/ano) | Pressuposto da equipa |
| Viatura dedicada: carga útil (`vehicle_capacity_t`) | 2 t | Pressuposto da equipa para uma caixa fechada até cerca de 5 t de peso bruto; validar com a ficha técnica |
| Viatura dedicada: velocidade média em recolha | 30 km/h | Pressuposto da equipa. Inclui manobras e paragens curtas; a condução medida no OSRM é de ~40 km/h (mediana 41,4 km/h nas freguesias, 39,2 km/h nos locais, sem trânsito), mas as horas continuam a usar os 30 km/h (secção 9) |
| Perfil de condução do OSRM (`novelo-van`) | furgoneta de 2,8 m de altura, 2,1 m de largura, 6,0 m de comprimento e 3 500 kg | Pressuposto: a Vitrus ainda não indicou a viatura (ver [Rotas por estrada](rotas-reais.md)) |
| Minutos por paragem | 2 por saco à porta, 10 por local | Pressuposto da equipa |
| Horas úteis por turno | 7 h, 5 dias por semana (1 820 h por ano por viatura) | Pressuposto da equipa (8 h menos descarga e pausas) |
| Frequência da ronda porta a porta (`on_demand_every_weeks`) | a cada 2 semanas (26 rondas por ano) | Pressuposto da equipa |
| Volta dentro da freguesia (porta a porta) | 0,7124 · √(sacos por ronda · área) · desvio | Beardwood, Halton e Hammersley (1959); área CAOP 2019; cada ronda é uma viagem própria (teto dos km). **Sempre estimativa por fórmula, mesmo nos cenários `routing = road`**: não há paragens com morada para pedir ao OSRM |
| Custo de um contentor de rua | pressuposto | Só para o cenário de referência; a Vitrus não quer contentores |
| Variação da sensibilidade | ±30%, distribuição triangular | Pressuposto da equipa (secção 5), configurável |
| Recolha francesa: 4,27 kg/hab/ano; 1 ponto por 1 414 hab | referência externa | Por verificar (registo C1, C2) |
| Pesos do piloto (0,25 / 0,15 / 0,30 / 0,30) | valor de aprendizagem | Pressuposto da equipa (secção 5) |
| Efeito de desenho do ensaio (deff) e peso médio da peça | 2; 0,415 kg | Pressuposto, a validar no piloto (secção 5) |
| Vida útil do equipamento (*N*) | pressuposto | Pedido à Vitrus |
| Paragem em locais municipais existentes sem investimento | a confirmar | Pressuposto (secção 6); perguntar à Vitrus o tempo e o custo da paragem |
| Têxtil por habitante igual em todas as freguesias | 1,596 kg/hab/mês | Pressuposto: sem caracterização nem têxtil por freguesia (secções 1 e 6) |
| Custo de tratamento do indiferenciado (`rsu_treatment_eur_per_t`) | 105,64 €/t | Fonte: Vitrus, 22 de outubro de 2026: 40 €/t TGR + 65,64 €/t Resinorte (secção 2) |
| Ponto assistido (escola) com os pressupostos do modo `existing` | captura, investimento, recolhas | Pressuposto, sem dados próprios (secção 8) |
| Litros desconhecidos de um contentor | mediana do tipo | Regra explícita (secção 8); 10 contentores, todos de produtores |
| Quota de reutilização igual em todos os modos | 59,4% (50,0% a 72,9%) | Calculada dos fluxos de 2025 na base, não escrita à mão; aplicá-la a todos os canais é **pressuposto** (não há qualidade por canal; secção 3) |
| Proximidade na matriz de cobertura | % da área a ≤ 300 m de um local municipal | Proxy de área, não de população (sem BGRI; secção 10) |
| Localidades dos circuitos sem freguesia inequívoca | ficam sem freguesia | Regra explícita (Fontes de dados); 3 por resolver e 2 por confirmar nos alertas 101 e 102 |

Regra: nenhum valor entra em `apps/api/src/novelo/features/planning/params.py` sem uma linha nesta tabela. Os custos e as taxas por modo estão lá marcados como `assumption` e aparecem com a sua origem no ecrã "Pressupostos".

## 7. Validação do modelo

Só há um ano de têxtil (2025, totais anuais por entidade), por isso **não há backtest temporal e não se finge um**. O ecrã «Validação» (`/validation`, `GET /validation/model`, código em `domain/validation.py` e `features/validation/`) faz só o que os dados reais deixam fazer:

- **Triangulação do potencial.** A leitura principal é a da Vitrus e da APA: 5,86% × 51 250,6 t de indiferenciado do concelho = 19,15 kg/hab/ano por desviar, captura de 2025 de 9,1%. As outras leituras publicadas ficam só como triangulação: 4,55% × 517 kg da composição dos RSU em Portugal (23,5 kg/ano, captura 8,2%) e duas leituras do plano municipal, **não usadas pela Vitrus**: 5,4% × 315 kg do indiferenciado (17,0 kg/ano, 11,3%) e 0,7 kg/mês (8,4 kg/ano, 22,9%). Todas são **estimativa**. A referência francesa (4,27 kg/hab/ano) continua marcada «por verificar».
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

**Rotas e km.** O VRP (a mesma função da rede por freguesia) corre sobre os locais abertos, a partir do estaleiro, com a capacidade da viatura dedicada e as distâncias medidas pela estrada (OSRM; só sem OSRM ou nos pares sem caminho entra a estimativa linha reta × `detour_factor`, e a rota fica `estimate`). Como os km e as viaturas não são lineares nos locais escolhidos, o orçamento do solver sobe ou desce pela folga ou excesso do custo real (locais + km + viaturas dedicadas, secção 9) até o cenário caber no orçamento pedido (até 4 voltas); a primeira volta já desconta uma viatura.

**Recolha a pedido como complemento** (`site_on_demand`, ligado por omissão). Os dois canais captam de forma independente, como no modelo por freguesia: `t_i = D_i · (1 − (1 − c_s · y_i)(1 − c_o · z_p))`, com `z_p` = recolha a pedido ligada na freguesia `p` (custo do `mode_cost` do modelo por zonas: ronda da viatura dedicada a cada *N* semanas, secção 9).

**Limites.**
- Os contentores são de **outras frações** e não recebem têxtil. A paragem nesses locais, com sacos fechados recolhidos no momento, é um pressuposto a confirmar com a Vitrus (tempo, custo).
- Cobertura de **população por proxy**, não por quarteirão. A coordenada aproximada (3 casas, ~100 m) de 350 locais é assinalada.
- A sensibilidade (tornado e Monte Carlo) e a robustez também funcionam nos cenários por locais, mas sobre os locais e as rotas já escolhidos (não reotimiza): ver «Sensibilidade por locais» abaixo. Cenários por locais calculados antes de existir `served_share` têm de ser recalculados (a API responde 409).
- Os locais de produtores (452) não entram como procura. Das escolas fazem-se pontos assistidos; lares e hotelaria são o canal B2B; restauração, estabelecimentos e grandes produtores ficam de fora.

**O que os locais reais mudam (23 out 2026, rotas pela estrada; viatura dedicada, procura do concelho × 5,86%, tratamento 105,64 €/t, pressupostos por omissão, estimativa).** Mesmo orçamento (60 000 €/ano) em todas as linhas, todas com o saco à porta a completar onde compensa; o têxtil por desviar é 3 003,3 t/ano. «Reutilizável» = têxtil × 59,4% (secção 3); «líquido» = custo − tratamento evitado (secção 2). Todas as linhas pagam uma viatura dedicada (42 500 €). As duas últimas usam o contentor de rua só como **referência** (a Vitrus não quer contentores de têxtil). Fonte: `POST /planning/scenarios` (`max_tonnes`, 60 000 €/ano; `siting`, `site_radius_m`, `site_candidates` e `site_mode` como na linha) na API de dev, 23 out 2026. **Só a primeira linha é determinística**; as de locais têm o solver limitado por tempo e variam cerca de ±1% entre execuções e máquinas (em produção, a de públicos e escolas a 300 m deu 474,3 t, 59 085 € e 124,6 €/t).

| Rede | Gasta | Têxtil | €/t | Líquido | Reutilizável | Locais | Cobertura | Viatura |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Por freguesia (local existente e saco à porta) | 43 914 € | 431,1 t | 101,9 | −1 628 € | 256,1 t | 58 pontos + 3 freguesias com saco | 70,4% | 1,66 dias/sem. |
| Locais reais, públicos e escolas (`both`, por omissão), 300 m | 59 375 € | 477,0 t | 124,5 | 8 981 € | 283,4 t | 195 públicos + 11 escolas | 88,2% | 3,42 dias/sem. |
| Locais reais, públicos e escolas (`both`), 500 m | 59 445 € | 547,6 t | 108,6 | 1 600 € | 325,3 t | 150 públicos + 13 escolas + 3 freguesias com saco | 95,8% | 3,06 dias/sem. |
| Locais reais, só públicos, 300 m | 59 998 € | 469,7 t | 127,7 | 10 374 € | 279,1 t | 214 locais | 86,9% | 3,43 dias/sem. |
| Locais reais, só públicos, 500 m | 58 185 € | 535,4 t | 108,7 | 1 627 € | 318,1 t | 141 locais + 2 freguesias com saco | 90,9% | 2,78 dias/sem. |
| Locais reais, só escolas (`staffed`), 300 m | 59 491 € | 283,1 t | 210,2 | 29 586 € | 168,2 t | 49 escolas + 8 freguesias com saco | 41,3% | 1,87 dias/sem. |
| Locais reais, só escolas (`staffed`), 500 m | 59 624 € | 413,8 t | 144,1 | 15 912 € | 245,8 t | 58 escolas + 8 freguesias com saco | 63,0% | 2,04 dias/sem. |
| Referência: locais reais, contentor de rua, 300 m | 59 750 € | 629,2 t | 95,0 | −6 717 € | 373,8 t | 157 locais | 73,3% | 2,79 dias/sem. |
| Referência: locais reais, contentor de rua, 500 m | 59 468 € | 761,2 t | 78,1 | −20 947 € | 452,3 t | 147 locais | 88,6% | 2,88 dias/sem. |

Antes (22 out, linha reta × 1,3): por freguesia 45 828 €, 445,8 t, 102,8 €/t, −1 264 €, 264,9 t, 60 pontos + 4 freguesias com saco, 72,1%, 1,67 dias; públicos e escolas a 300 m 59 538 €, 481,9 t, 123,5, 8 631 €, 286,3 t, 87,8%, 3,28 dias; a 500 m 59 046 €, 557,7 t, 105,9, 135 €, 331,3 t, 95,0%, 2,81 dias.

Leitura: sem contentores, a rede por locais reais a 500 m com públicos e escolas desvia 547,6 t (18,2% do têxtil no lixo) a 108,6 €/t, e o tratamento evitado (57 845 €) paga quase todo o custo: o custo líquido para o município é de 1 600 €/ano. A rede por freguesia é a mais barata (43 914 €, custo líquido negativo) mas serve menos gente (70,4%). Com a viatura dedicada o saco à porta ficou mais caro (cada ronda sai do estaleiro), por isso o otimizador prefere paragens nos locais e usa o saco à porta onde não há local ao alcance. Só com escolas a rede fica curta. O contentor de rua parece mais barato por tonelada só porque o seu pressuposto de captura (28,6%) é mais alto que o do local existente (18%); o modelo **não conta a contaminação** que a Vitrus aponta, por isso fica só como referência.

**Correção de 21 out 2026.** O ciclo de orçamento podia ficar preso com o custo real ligeiramente acima do pedido (ex.: 60 095 € para 60 000 €) e devolver `infeasible` com dinheiro de sobra; agora o corte parte do custo que o solver viu para a solução escolhida, e se o CP-SAT não tiver solução no tempo dado usa-se a dica gulosa.

**Sensibilidade por locais.** `domain/sensitivity.py` reavalia o plano fixo (locais abertos, rotas e freguesias com recolha a pedido) sem solver. Por freguesia, com `a` = fração da procura servida por locais (`allocation.served_share`) e `z` = recolha a pedido ligada: `têxtil = D · (c_s·a + c_o·z − c_s·c_o·a·z)`; `custo = locais · (capex/N + recolhas · c_recolha) + km das rotas · c_km + custo da recolha a pedido`, com os km das rotas a escalar com `detour_factor` (relativo ao valor do cenário: é uma alavanca de sensibilidade sobre os km já medidos, não uma nova medição) e com as recolhas por ano. Com os pressupostos centrais reproduz os KPIs do cenário (teste `test_sensitivity_reproduces_the_site_scenario`). O tornado só varia os parâmetros que contam para esta rede (captura, investimento, vida útil, recolhas, custos por recolha e por km, desvio, kg/hab/mês e, se houver recolha a pedido, os seus parâmetros).

**Velocidade.** Cada cenário por locais demora 20 a 40 s (CP-SAT, VRP e até 4 voltas de orçamento). Um pedido igual (mesmos dados, pressupostos e opções; só o nome muda) sai da cache em memória em milissegundos (32 entradas, um só cálculo para pedidos simultâneos iguais). No arranque, com `SEED_REFERENCE_SCENARIOS=true`, garantem-se em segundo plano 5 cenários de referência por locais (20 000, 40 000, 60 000, 100 000 e 150 000 €/ano) e 1 por freguesia (60 000 €/ano), recalculados quando mudam o modelo (`REFERENCE_MODEL_VERSION`, 5 desde a viatura dedicada) ou os pressupostos ativos, ou quando lhes falta o plano de recolha (ver [Arquitetura](arquitetura.md#cenários-de-referência)).

## 9. Viatura dedicada ao têxtil (22 out 2026)

A Vitrus respondeu a 22 de outubro de 2026: o saco de têxtil **não pode** ir na compactadora do porta a porta (vai para a caixa de compactação e estraga-se; cabine, gancho ou caixa lateral também não), uma compactadora **não pode** fazer uma volta só de têxtil (contaminação) e **não há viaturas livres à tarde** (a folha de turnos tinha um erro). O caminho é a «aquisição de um meio novo de recolha». Por isso toda a recolha de têxtil, saco à porta e paragens nos locais, é feita por uma **viatura nova, de caixa fechada e sem compactação**, a partir do estaleiro da Rua das Lameiras, Polvoreira. Código: `domain/fleet.py` (funções puras), `network.mode_cost` e `network.solve` (custo e número de viaturas), `domain/siting.evaluate` (rede por locais) e `features/planning/collection_plan.py` (plano no resultado).

**Saco à porta (modo `on_demand`).** Uma ronda por freguesia a cada *N* semanas (`on_demand_every_weeks`, 2 por omissão: 26 rondas por ano), que recolhe todos os sacos da freguesia:

```latex
\text{sacos} = \frac{C_z \cdot 1000}{\text{kg por saco}} \qquad v = \left\lceil \frac{C_z \cdot 1000 / R}{\text{capacidade}} \right\rceil \qquad L = 0{,}7124 \sqrt{\tfrac{\text{sacos}}{R} \cdot A_z} \cdot \text{desvio}
```

```latex
\text{km} = R \cdot (v \cdot \text{ida e volta ao estaleiro} + L) \qquad \text{custo} = \text{sacos} \cdot c_{\text{recolha}} + \text{km} \cdot c_{\text{km}}
```

*R* = rondas por ano; *v* = viagens por ronda (cada viagem extra volta ao estaleiro para descarregar); a ida e volta ao estaleiro é medida **pela estrada** (OSRM, `with_road_distances`; sem OSRM, 2 × linha reta × desvio); *L* = volta dentro da freguesia, **estimativa por fórmula, nunca medida pela estrada** (multiplica pelo desvio, `detour_factor`), pela fórmula de Beardwood, Halton e Hammersley (1959) para a volta mais curta por *n* pontos espalhados numa área *A* (constante 0,7124), com *A* = área CAOP 2019 da freguesia (pacote municipal; todas as 48 têm área). Cada ronda é uma viagem própria a partir do estaleiro: juntar freguesias vizinhas no mesmo dia baixaria os km, por isso este valor é um **teto**. O custo por saco é o de uma recolha (6 €, pressuposto; a Vitrus ainda não deu o custo por hora).

**Paragens nos locais (modo `existing`, e `street` como referência).** Como antes: recolhas por ano em cada ponto e rotas VRP a partir do estaleiro, agora com a capacidade da viatura dedicada (2 t). Cada «veículo» do VRP é uma viagem; a mesma viatura faz várias, em dias diferentes.

**Horas e número de viaturas.** As horas da viatura são `km ÷ velocidade + paragens × minutos por paragem ÷ 60` (30 km/h; 2 min por saco à porta; 10 min por paragem num local; pressupostos). Uma viatura tem `7 h × 5 dias × 52 semanas = 1 820 h` por ano. Viaturas necessárias = `⌈horas ÷ 1 820⌉` (pelo menos 1 logo que a rede recolha alguma coisa); dias de viatura por semana = `horas ÷ 52 ÷ 7` (5 = uma viatura cheia; acima disso, segunda viatura). No MIP por freguesia o número de viaturas é uma variável inteira: as horas das opções escolhidas cabem em `viaturas × 1 820 h` e o custo soma `viaturas × 42 500 € ÷ 8 anos = 5 312,50 €/ano` cada. Na rede por locais as viaturas pagam-se no custo real de cada volta do ciclo de orçamento (a primeira volta já desconta uma).

**Dia e viatura (regra explícita e determinista).** Cada ronda porta a porta é uma tarefa; as paragens nos locais seguem a viagem do VRP que mais têxtil leva da freguesia. As tarefas entram por ordem decrescente de horas por semana (empate: o identificador) e cada uma fica no par (viatura, dia útil) com menos horas já atribuídas; empate: a viatura mais baixa, depois o dia mais cedo (`fleet.assign_weekdays`). O dia do saco não tem de coincidir com o do circuito de indiferenciado: é a viatura nova que passa.

**No resultado.** `result.collection_plan`: por freguesia e canal (`on_demand`, `existing`, `street`), dia, viatura (1, 2, ...), frequência (a cada *N* semanas), rondas por ano, viagens por ronda (porta a porta), sacos ou paragens por ano, toneladas, kg por ronda, km e horas por ano. KPIs: `vehicles`, `vehicle_days_week`, `vehicle_hours_year`, `vehicle_capex_eur`, `vehicle_annual_eur`. Os planos antigos (circuito, viatura PAP, 0 km novos) são lidos como nulos e o ecrã pede para recalcular; a sensibilidade desses cenários responde 409.

**Números (23 out 2026, estimativa; rotas pela estrada).** Por freguesia com 60 000 €/ano: 1 viatura, 1,66 dias por semana (605 h por ano, 7 543 km por ano), saco à porta em 3 freguesias (71,2 t/ano, 1 450 km/ano) e locais existentes em 43 freguesias (359,9 t/ano, 6 093 km/ano). Na rede por locais (públicos e escolas, 300 m) a 60 000 €/ano: 1 viatura, 3,42 dias por semana; a 150 000 €/ano já são precisas **2 viaturas** (5,80 dias por semana). Antes (22 out, linha reta × 1,3): 1,67 dias (606 h), saco em 4 freguesias (79,5 t, 1 761 km), locais em 45 freguesias (366,3 t); por locais 3,28 dias e 5,59 dias a 150 000 €.

**Rede atual (circuitos).** As passagens dos circuitos de indiferenciado (`ZoneOut.door_to_door`, `service_days`) ficam como dado da rede atual: acessibilidade na matriz de cobertura (secção 10) e hábito de recolha em dias fixos no piloto (secção 5). Contam todos os dias dos circuitos, com ou sem viatura na folha de turnos: a Vitrus disse que a folha tem erros e que os circuitos sem viatura (C8, C12, C15, C20 a C24) circulam. Orgânico continua fora.

## 10. Matriz de cobertura (Diretiva 2025/1892)

O art. 22.º-C, n.º 9, alínea b) da Diretiva (UE) 2025/1892 pede que a rede de recolha tenha em conta a dimensão e a densidade da população, o volume previsto, a acessibilidade e a proximidade, e que não se limite às zonas onde a recolha é mais rendível. `GET /planning/scenarios/{scenario_id}/coverage` (`get_scenario_coverage`, mesma sessão que o GET do cenário) devolve, para um cenário guardado, sem números novos:

- **Por freguesia:** TIPAU (INE), população (Censos 2021), área CAOP 2019 e densidade (população ÷ área), volume previsto (`demand_t`, a procura do modelo), **proximidade** (`area_within_300m_pct`: % da área a ≤ 300 m de um local de contentores municipais, `municipal_parish_stats.cover_pct_300m`; é área, não população, porque não há população por quarteirão), **acessibilidade** (`door_to_door_days_week`: dias com passagem porta a porta de indiferenciado na rede atual, com ou sem viatura na folha de turnos; `service_days`, secção 9) e, do cenário, modos, canais (`on_demand`, `existing`, `street`: todos na viatura dedicada), toneladas, população servida e fração servida, custo anual (com a parte da viatura dedicada, pelas horas).
- **Por TIPAU** (APU, AMU, APR) e no total: freguesias, população, população servida e %, toneladas, custo e €/t.
- **Não limitado às zonas rendíveis** (`equity`): % da população servida nas freguesias não predominantemente urbanas (AMU e APR) contra as urbanas (APU) e a razão entre as duas (1 = a mesma cobertura).

Código: `domain/coverage_matrix.py` (funções puras, testadas à mão), `features/planning/coverage_service.py`. A rede atual (circuitos, contentores) é a de hoje; o resto é o que o cenário gravou.

**Cenário por freguesia de 60 000 €/ano (23 out 2026, rotas pela estrada; viatura dedicada, procura do concelho × 5,86%, estimativa).**

| TIPAU | Freguesias | População | Servida | % servida | Têxtil | Custo | €/t |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Predominantemente urbana (APU) | 36 | 135 460 | 98 608 | 72,8% | 390,2 t | 39 717 € | 101,8 |
| Mediamente urbana (AMU) | 11 | 20 671 | 11 859 | 57,4% | 40,9 t | 4 198 € | 102,7 |
| Predominantemente rural (APR) | 1 | 699 | 0 | 0,0% | 0,0 t | 0 € | — |
| Concelho | 48 | 156 830 | 110 467 | 70,4% | 431,1 t | 43 914 € | 101,9 |

Fora das freguesias urbanas (21 370 habitantes) o cenário serve 55,5% da população, contra 72,8% nas urbanas (razão 0,762). A freguesia APR é uma só (Arosa e Castelões, 699 habitantes) e fica sem recolha neste orçamento: a ronda da viatura dedicada até lá não compensa ao lado de outras freguesias. Antes (22 out, linha reta × 1,3): 73,9% nas urbanas, 60,2% nas restantes (razão 0,814), 72,1% no concelho. Com 60 000 €/ano a rede por locais reais serve 88,2% da população (secção 8).
