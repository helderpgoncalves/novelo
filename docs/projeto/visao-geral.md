![Novelo: recolha seletiva de têxteis, desenhada ao menor custo](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/banner-projeto.png)

# Quase 9 em cada 10 quilos de têxtil de Guimarães acabam no lixo. O Novelo desenha a recolha que os traz de volta, sem um único contentor novo.

**Novelo é a ferramenta de decisão que desenha a rede de recolha seletiva de têxteis de Guimarães ao menor custo.** Entram um orçamento e uma meta. Saem cenários comparáveis em **euros, toneladas, toneladas reutilizáveis e €/tonelada**, calculados por um otimizador sobre os dados reais da Vitrus Ambiente: os seus circuitos, as suas viaturas e os 2 751 contentores municipais.

**[Experimentar em novelo.helder.si](https://novelo.helder.si)** · **[Código aberto no GitHub](https://github.com/helderpgoncalves/novelo)**

*Hack4Guimarães 2035 · Desafio 5 TexVitrus · Hélder Gonçalves e Flávio Fernandes*

| **2 324,8 t** | **11,5%** | **396,5 t** | **0 contentores** |
| :---: | :---: | :---: | :---: |
| de têxtil por ano ainda no lixo indiferenciado (estimativa) | do têxtil gerado é hoje recolhido à parte (estimativa) | a mais por ano, a 120,6 €/t, com 60 000 €/ano de orçamento (estimativa) | novos: a rede usa os circuitos e as viaturas que já existem |

![A página de entrada do Novelo: 301,3 t recolhidas à parte em 2025 e cerca de 2 325 t por ano ainda no lixo, com as fontes da Vitrus e da APA](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-hero.png)

---

## Em 30 segundos

- **O problema.** Em 2025 a Vitrus recolheu 43 051 t de lixo indiferenciado. Com 5,4% de têxtil, são **2 324,8 t por ano** que não chegam à recolha seletiva, contra **301,3 t** recolhidas à parte. A recolha seletiva é obrigatória desde 1 de janeiro de 2025 e hoje **paga-a só o município**.
- **A nossa resposta.** Não propomos um contentor melhor; a Vitrus não quer contentores de têxtil, porque o têxtil de contentor vem contaminado. Propomos **uma rede sem contentores**, montada sobre o que já existe: o saco fechado à porta no dia em que o camião do porta a porta já passa (**22 freguesias, 0 km novos**), os locais por onde a viatura já passa e as escolas.
- **A prova.** Um otimizador (OR-Tools, CP-SAT e VRP) escolhe onde, como e com que custo. Com **60 000 €/ano**, desvia **396,5 t por ano a 120,6 €/t**, com 13 750 € de investimento e sem contentores, das quais **cerca de 236 t reutilizáveis**, e a captura sobe de **11,5% para cerca de 27%** (estimativas). Em 8 de cada 10 simulações, o custo fica entre 96,9 e 154,7 €/t.
- **O que pedimos.** Um **piloto de 3 meses em duas freguesias**, desenhado pelo próprio Novelo, para trocar os pressupostos pelos números reais.

---

## 1. O problema: o têxtil perde-se no lixo, nos sítios por onde o camião já passa

Em 2025, as quatro entidades que recolhem têxteis em Guimarães apanharam **301,3 toneladas**. No mesmo ano a Vitrus recolheu **43 051 toneladas** de resíduos indiferenciados e, segundo os valores que nos indicou, **5,4% são têxtil**: cerca de **2 324,8 toneladas por ano** a caminho do aterro (estimativa). O concelho gera assim cerca de 2 626 t de têxtil por ano e só **11,5%** chega à recolha seletiva.

Do pouco que se recolhe, o destino mostra onde está o valor: **59,4% reutilização, 26,5% reciclagem, 14,1% rejeito** (dados da Vitrus, 2025). A reciclagem custa mais do que a fibra virgem; o valor está na **reutilização**, e a reutilização exige têxtil limpo e seco.

![Cerca de 11,5% do têxtil gerado chega à recolha seletiva: 301,3 t recolhidas em 2025 contra cerca de 2 324,8 t ainda no lixo, e o destino do que se recolhe](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-problema.jpg)

O têxtil não desaparece longe: perde-se nos **2 751 contentores municipais** de indiferenciado, orgânico e seletivo, exatamente onde a viatura da Vitrus já passa todos os dias.

![Onde se perdem as 2 325 t por ano: os locais municipais onde a viatura já passa, com o têxtil que se estima perder em cada um](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-mapa.png)

### A pergunta da Vitrus

> Como criar um serviço de recolha seletiva de têxteis pós-consumo que garanta material reutilizável e reciclável, com o menor investimento e o menor custo de operação?

### O que a lei muda, e o que não muda

- **Hoje:** a recolha seletiva de têxteis é obrigatória desde 1 de janeiro de 2025 (Diretiva 2008/98/CE, alterada em 2018, e regime geral de gestão de resíduos). Não há entidade gestora de têxteis em Portugal: **paga o município**.
- **A Diretiva (UE) 2025/1892** obriga a criar, até 17 de abril de 2028, a responsabilidade alargada do produtor (RAP). Mas os produtores só pagam as peças **postas à venda depois da lei nacional** (art. 22.º-A, n.º 11). O têxtil que já está nas casas continua anos a pesar na câmara.
- **E só o custo eficiente:** os custos cobertos "não podem exceder os custos necessários à prestação economicamente eficiente" e são fixados "entre os intervenientes relevantes" (art. 22.º-A, n.º 12), entre os quais as autoridades locais (n.º 7).
- **A rede tem de cobrir todo o território**, "tendo em conta a dimensão e a densidade da população, o volume previsto [...], a acessibilidade e a proximidade [...], sem estar limitado a zonas onde a recolha [...] seja rendível" (art. 22.º-C, n.º 9, b)).

**Quem chegar à mesa sem saber o que custa cada tonelada não tem como defender o seu número.** O Novelo dá esse número, freguesia a freguesia.

---

## 2. Ouvimos a Vitrus e refizemos o modelo em 24 horas

A 21 de outubro o mentor da Vitrus respondeu-nos. Mudámos tudo no mesmo dia:

| A Vitrus disse | O que mudou no Novelo |
| --- | --- |
| Não tem contentores de têxtil e não os quer: o têxtil de contentor vem contaminado e perde a reutilização | A rede proposta deixou de ter contentores de têxtil. O contentor de rua ficou só como referência, para comparar com o modelo francês |
| Contem 5,4% de têxtil nas 43 051 t de RSU de 2025 | A procura passou a 2 324,8 t por ano ainda no lixo; a captura atual, a 11,5% (estimativas) |
| A reciclagem é muito mais cara do que a fibra virgem | O valor medido passou a ser a **reutilização**: cada cenário mostra as toneladas reutilizáveis |
| Os ficheiros QGIS têm todos os contentores de indiferenciado, orgânico e seletivo | Os 2 751 contentores passaram a ser a base geográfica: onde o têxtil se perde e onde a viatura já passa |

---

## 3. A resposta: uma rede sem contentores, sobre o que já existe

O Novelo combina, em cada freguesia, o canal mais barato que funciona:

1. **Saco fechado à porta, no dia em que o camião já passa.** Em **22 freguesias** (67 349 habitantes) há circuito porta a porta de indiferenciado com viatura atribuída. O Novelo diz qual circuito, em que dia, com que viatura e quantos quilos por ronda. **Zero quilómetros novos.**
2. **Locais onde a viatura já passa, sem contentor novo.** As paragens nos locais municipais e as **86 escolas** como pontos com pessoas, onde o saco é entregue em mão e recolhido no momento.
3. **Recolha a pedido com desvio**, nas freguesias sem porta a porta, aproveitando os dias em que já passa um circuito.

![Plano de recolha: cada freguesia com o circuito, o dia, a viatura e os quilos por ronda; zero quilómetros novos no porta a porta](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-plano-recolha.png)

**E se o saco não puder ir no camião compactador?** O Novelo também mostra o plano B, com os dados de turnos da Vitrus: **numa tarde de dia útil há pelo menos 15 viaturas sem circuito.** Uma volta dedicada ao têxtil à tarde não precisa de viatura nova. Falta só validar com a Vitrus o tipo de caixa e a equipa.

---

## 4. O produto: decidir, provar, operar e prestar contas

### Decidir: o simulador da rede

O decisor escolhe o orçamento ou a meta. O otimizador decide que freguesias servir, com que canal, e calcula as rotas. Cada cenário mostra **investimento, custo anual, toneladas, toneladas reutilizáveis, €/t e população servida**, num mapa.

![Simulador: orçamento de 60 000 €/ano, o mapa das freguesias servidas e os indicadores do cenário](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-simulador.png)

| Cenário (estimativas) | Custo anual | Toneladas por ano | €/t | Reutilizável |
| --- | ---: | ---: | ---: | ---: |
| Orçamento de 40 000 €/ano | 27 709 € | 323,9 t | 85,6 | 192,4 t |
| **Orçamento de 60 000 €/ano (recomendado)** | **47 839 €** | **396,5 t** | **120,6** | **235,6 t (198 a 289)** |
| Teto sem contentores | 138 866 € | 597,7 t | 232,3 | 355,1 t |

O custo por tonelada sobe depressa depois do cenário recomendado: as primeiras toneladas são as do porta a porta que já existe; as últimas exigem desvios longos. **É esta curva que permite decidir com números, e não a olho.**

### Decidir: só conta o que se pode reutilizar

O desafio pede material **reutilizável**. Por isso cada cenário mostra as **toneladas reutilizáveis** e o **custo por tonelada reutilizável**, com a quota observada em 2025 (59,4%) e o intervalo entre entidades (50,0% a 72,9%).

A qualidade depende de quem recolhe e como. Nos dados da Vitrus de 2025, a Ultriplo encaminhou 72,9% para reutilização; o pouco têxtil recolhido pela Vitrus, só 9,2%, com 56,9% de rejeito. É a prova, com números, do que a Vitrus nos disse sobre os contentores.

![Têxtil reutilizável no resumo do cenário e na comparação lado a lado de 60 000 e 40 000 €/ano, na rede por locais reais](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-reutilizavel.png)

### Provar: a cobertura que a diretiva exige

O separador **Cobertura** mostra, freguesia a freguesia, os quatro critérios do art. 22.º-C, n.º 9, b): população, densidade, volume previsto, proximidade e o canal usado. Com 60 000 €/ano, o cenário serve **76,0% da população nas freguesias predominantemente urbanas e 68,8% fora delas**, a um custo por tonelada mais alto onde a recolha é menos rendível (estimativas). A rede não se fica pelas zonas fáceis.

![Separador Cobertura: os critérios do art. 22.º-C, o resumo por tipo de território e a tabela por freguesia](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-cobertura.png)

### Provar: e se os pressupostos estiverem errados?

Os custos unitários da Vitrus ainda não chegaram. Por isso a incerteza é um resultado, não uma nota de rodapé: a **análise de tornado** mostra que pressuposto mais pesa, e a **simulação de Monte Carlo** dá o intervalo. No cenário recomendado, **em 8 de cada 10 casos o custo fica entre 96,9 e 154,7 €/t**.

![Robustez do cenário: o tornado dos pressupostos e o intervalo do custo por tonelada](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-incerteza.png)

### Decidir em português: o copiloto que nunca faz contas

O decisor pergunta como falaria a um colega: *"e se passássemos Serzedelo a recolha a pedido?"*. O copiloto percebe a pergunta, corre o otimizador e explica a diferença.

**A IA nunca faz contas.** Só traduz a pergunta num pedido estruturado. Todos os números vêm do otimizador ou da base de dados, e um **verificador rejeita qualquer número que não esteja na origem**. Sem IA, tudo o resto funciona.

![Copiloto: pergunta em português, o otimizador responde e um verificador confere cada número](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-copiloto.png)

### Operar: do saco ao lote, com passaporte

- **Controlo de qualidade na entrega:** uma foto da peça e da etiqueta sugere o estado, a fibra e a marca; o operador confirma.
- **Lote com QR e passaporte público:** origem, composição, peso e histórico, lidos com o telemóvel por quem recebe. São quase os campos que a diretiva vai pedir por fardo exportado (art. 22.º-D, n.º 9).
- **Bolsa de fibra** para os recicladores do Vale do Ave, para o que não se pode reutilizar.

![Lote com código QR e o passaporte público que o recetor abre no telemóvel](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-rastreio.png)

### Prestar contas: o relatório RAP num clique

Um **PDF pronto para a câmara**, com o custo por tipo de território (tipologia de áreas urbanas do INE), as toneladas por destino e as marcas encontradas: o dossiê para a mesa onde se vai fixar o custo eficiente.

![Relatório RAP gerado pela aplicação: a capa e o resumo, com o têxtil por desviar, o recolhido e o custo por tipo de território](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-relatorio.png)

### Em qualquer ecrã

Aplicação instalável, em português e inglês, tema claro e escuro, pensada primeiro para o telemóvel. Quem entra pela primeira vez vê uma história de seis passos, do problema ao piloto.

![O primeiro passo da história que o júri vê ao entrar: cerca de 2 325 t de têxtil por ano ainda vão para o lixo em Guimarães](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-onboarding.png)

![Três ecrãs no telemóvel: a página de entrada, o resumo de um cenário e o mapa](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-telemovel.png)

---

## 5. Como respondemos aos critérios do júri

| Critério | Peso | O que construímos | Onde se vê |
| --- | :---: | --- | --- |
| **Impacto e relevância** | 30% | +396,5 t por ano desviadas do lixo, 235,6 t reutilizáveis, captura de 11,5% para cerca de 27% (estimativas); a resposta a "quem paga?" antes e depois da RAP; cobertura de todo o território, não só das zonas rendíveis | Simulador, separador Cobertura, relatório RAP |
| **Inovação e originalidade** | 25% | Uma rede **sem contentores**, sobre os circuitos e as viaturas que já existem; o otimizador decide canal a canal; a IA conduz o modelo matemático, mas um verificador impede-a de inventar números; do saco ao lote com passaporte | Plano de recolha, copiloto, passaporte |
| **Viabilidade técnica** | 25% | Em produção, com os dados reais da Vitrus (40 circuitos, 29 viaturas, 2 751 contentores, 301,3 t por destino); nenhuma viatura nem contentor novo (o investimento do cenário recomendado é de 13 750 € em 55 pontos, estimativa); pressupostos visíveis e etiquetados; incerteza calculada; 1 037 testes da API, 437 da web e testes de ponta a ponta no browser; 155 perguntas de avaliação ao copiloto, com 100% dos números verificados | Pressupostos, robustez, [código](https://github.com/helderpgoncalves/novelo) |
| **Apresentação e continuidade** | 20% | Uma história de seis passos para quem entra pela primeira vez; um piloto de 3 meses desenhado pelo próprio Novelo; replicável em qualquer município com dados abertos | [novelo.helder.si](https://novelo.helder.si) |

---

## 6. Rigor: nenhum número sem fonte

| Dado | Fonte | Estado |
| --- | --- | --- |
| 301,3 t recolhidas em 2025 e o destino (59,4 / 26,5 / 14,1%) | Vitrus Ambiente | Dado |
| 43 051 t de RSU em 2025 e 5,4% de têxtil | Vitrus Ambiente (21 out 2026) | Dado; o produto, 2 324,8 t, é estimativa |
| 40 circuitos, 29 viaturas, 101 turnos, 82 localidades | Vitrus Ambiente | Dado |
| 2 751 contentores municipais em 2 026 locais | Vitrus Ambiente (pacote QGIS) | Dado |
| População e tipologia de cada freguesia | INE; contornos oficiais CAOP 2019 | Dado |
| Custos por recolha e por km, captura por canal | Pressupostos da equipa, visíveis no ecrã | Por validar com a Vitrus |

- Todo o valor estimado leva no ecrã a palavra **"estimativa"**.
- Os pressupostos mudam-se no ecrã e o resultado recalcula de imediato.
- A procura é **conservadora**: as 43 051 t da Vitrus são 84,0% do indiferenciado do concelho (Relatório e Contas 2025 da Vitrus, p. 8).
- O que ainda não sabemos, dizemo-lo: o custo por km da Vitrus, se o saco pode ir no camião compactador, e quanto se poupa no tratamento de cada tonelada que sai do lixo.

![Como o Novelo decide, passo a passo: dados, procura, otimizador, cenários e verificação](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-metodo.png)

---

## 7. Depois do hackathon

1. **Piloto de 3 meses em duas freguesias.** O Novelo escolhe-as para aprender o máximo pelo menor custo, pesando o contraste urbano e rural, a densidade, os circuitos porta a porta e o custo de arranque. Mede toneladas, €/t e rejeito contra o previsto. Para a medição valer, o piloto precisa de pelo menos **1,71 t em 3 meses** (cálculo do tamanho da amostra).
2. **Calibração contínua.** Cada lote triado devolve dados reais, e as taxas de captura deixam de ser pressupostos.
3. **Escala.** A obrigação é a mesma em todos os municípios portugueses e europeus. O Novelo funciona com os dados abertos de cada concelho e com o inventário de contentores que todas as câmaras já têm.

---

## Como foi feito

- **Web:** React, Vite, TanStack Router e Query, Tailwind v4 e shadcn/ui; aplicação instalável (PWA), pt-PT e inglês, acessibilidade AA.
- **API:** FastAPI (Python 3.12), PostgreSQL, **OR-Tools** (CP-SAT para a localização, VRP para as rotas); contrato OpenAPI com o cliente TypeScript gerado.
- **IA, identificada e limitada:** o copiloto e a triagem usam modelos via **OpenRouter** e devolvem JSON validado, nunca fazem contas, e um verificador rejeita números fora da origem. No desenvolvimento usámos **Claude Code** e **GLM (Z.ai)** como assistentes de programação.
- **Qualidade:** 1 037 testes da API e 437 testes da web, verdes em cada entrega; testes de ponta a ponta no browser; e uma avaliação do copiloto com o modelo real, 155 perguntas, 100% dos números verificados.
- **Em produção** em [novelo.helder.si](https://novelo.helder.si) (Coolify, Docker), com **código aberto** em [GitHub](https://github.com/helderpgoncalves/novelo).

## Equipa

**Hélder Gonçalves** e **Flávio Fernandes**. Construído durante o Hack4Guimarães 2035.

---

## In English

**Nearly 9 in 10 kilos of Guimarães' textiles end up in the bin. Novelo designs the collection that brings them back, with no new containers.**

Novelo is a decision tool that designs Guimarães' separate textile collection at the lowest cost. Give it a budget or a target; it returns scenarios in **euros, tonnes, reusable tonnes and € per tonne**, computed by an optimiser (OR-Tools CP-SAT and VRP) on real data from Vitrus Ambiente, the municipal waste company.

- **The problem.** In 2025 Vitrus collected 43,051 t of mixed municipal waste; at 5.4% textiles, about **2,324.8 t a year** never reach separate collection, against 301.3 t collected separately (estimates). Separate collection has been mandatory since January 2025 and the municipality pays for it alone.
- **The answer.** No textile bins: Vitrus does not want them, because bin textiles arrive contaminated. Instead, a closed bag at the door on the day the door-to-door truck already passes (**22 parishes, zero new kilometres**), the stops the trucks already make, and the 86 schools.
- **The numbers.** With **€60,000 a year**, the network diverts **396.5 t a year at €120.6/t**, about 236 t of it reusable, lifting capture from 11.5% to about 27% (estimates).
- **The law.** Directive (EU) 2025/1892 makes producers pay only for items first sold after national transposition, and only the cost-efficient amount, agreed with local authorities at the table. Novelo gives the municipality that number, parish by parish.
- **AI that never does the maths.** The copilot turns questions in plain Portuguese into optimiser runs; a verifier rejects any number not in the source.
- **Next step.** A 3-month pilot in two parishes, chosen by Novelo itself.

Live at [novelo.helder.si](https://novelo.helder.si) · Open source at [github.com/helderpgoncalves/novelo](https://github.com/helderpgoncalves/novelo)

---

## Fontes

- Dados da Vitrus Ambiente: têxtil recolhido por entidade e destino em 2025, circuitos e turnos, pacote QGIS de contentores municipais, e email do mentor de 21 de outubro de 2026.
- [Diretiva (UE) 2025/1892](https://eur-lex.europa.eu/eli/dir/2025/1892/oj), Jornal Oficial da União Europeia, 26 de setembro de 2025 (artigos 22.º-A, 22.º-C e 22.º-D).
- [Perguntas frequentes sobre têxteis](https://apambiente.pt/sites/default/files/_Residuos/FluxosEspecificosResiduos/Texteis/perguntas-frequentes_texteis.pdf), Agência Portuguesa do Ambiente, dezembro de 2025.
- INE: população por freguesia (Censos 2021) e tipologia de áreas urbanas; DGT: Carta Administrativa Oficial de Portugal (CAOP 2019).
- Detalhe do modelo, dos pressupostos e de cada número: [Dados e modelo](https://github.com/helderpgoncalves/novelo/blob/main/docs/engenharia/dados-e-modelo.md) e [Registo de afirmações](https://github.com/helderpgoncalves/novelo/blob/main/docs/pesquisa/registo-de-afirmacoes.md).
