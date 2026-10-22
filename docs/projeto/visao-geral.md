![Novelo: recolha seletiva de têxteis, desenhada ao menor custo](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/banner-projeto.png)

# Mais de 9 em cada 10 quilos de têxtil de Guimarães acabam no lixo. O Novelo desenha a recolha que os traz de volta: uma viatura nova só para o têxtil, sem um único contentor novo.

**Novelo é a ferramenta de decisão que desenha a rede de recolha seletiva de têxteis de Guimarães ao menor custo.** Entram um orçamento e uma meta. Saem cenários comparáveis em **euros, toneladas, toneladas reutilizáveis e €/tonelada**, calculados por um otimizador sobre os dados reais da Vitrus Ambiente: o lixo que recolhe, o custo de o tratar e os 2 751 contentores municipais.

**[Experimentar em novelo.helder.si](https://novelo.helder.si)** · **[Código aberto no GitHub](https://github.com/helderpgoncalves/novelo)**

*Hack4Guimarães 2035 · Desafio 5 TexVitrus · Hélder Gonçalves e Flávio Fernandes*

| **3 003,3 t** | **9,1%** | **445,8 t** | **47 093 €** | **0 contentores** |
| :---: | :---: | :---: | :---: | :---: |
| de têxtil por ano ainda no lixo indiferenciado (estimativa) | do têxtil gerado é hoje recolhido à parte (estimativa) | a mais por ano, a 102,8 €/t, com 60 000 €/ano de orçamento (estimativa) | de tratamento evitado por ano, a 105,64 €/t (Vitrus): paga a operação de 45 828 € (estimativa) | novos: uma só viatura de têxtil, sem compactação, e os locais que já existem |

![A página de entrada do Novelo: 301,3 t recolhidas à parte em 2025 e cerca de 3 003 t por ano ainda no lixo, com as fontes da Vitrus e da APA](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-hero.png)

---

## Em 30 segundos

- **O problema.** Em 2025 o concelho deitou cerca de **51 250 t** ao lixo indiferenciado (a Vitrus recolheu 43 050,5 t, 84,0% do total). Com 5,86% de têxtil (APA), são cerca de **3 003 t por ano** que não chegam à recolha seletiva, contra **301,3 t** recolhidas à parte (estimativas). A recolha seletiva é obrigatória desde 1 de janeiro de 2025 e hoje **paga-a só o município**.
- **A nossa resposta.** Não propomos um contentor melhor; a Vitrus não quer contentores de têxtil, porque o têxtil de contentor vem contaminado. O saco também não pode ir no camião do lixo: a compactação estraga-o. Propomos **uma rede sem contentores** com o que a própria Vitrus indicou, **um meio novo de recolha**: uma viatura de têxtil, sem compactação, que recolhe o saco fechado à porta num dia fixo por freguesia e para nos locais municipais que já existem e nas escolas.
- **O que poupa.** Cada tonelada que sai do lixo deixa de pagar **105,64 € de tratamento** em aterro (40 €/t de taxa de gestão de resíduos e 65,64 €/t da Resinorte, valores da Vitrus). No cenário recomendado, esta poupança paga a operação.
- **A prova.** Um otimizador (OR-Tools, CP-SAT e VRP) escolhe onde, como e com que custo. Com **60 000 €/ano**, a rede gasta **45 828 € por ano** e desvia **445,8 t a 102,8 €/t**, das quais **cerca de 265 t reutilizáveis**; a captura sobe de **9,1% para cerca de 22,6%**. O tratamento evitado, **47 093 € por ano**, cobre a operação: o custo líquido fica em −2,8 €/t. O investimento é de 57 500 €: 42 500 € na viatura e o resto em 60 pontos (estimativas). Em 8 de cada 10 simulações, o custo fica entre 82,0 e 141,3 €/t.
- **O que pedimos.** Um **piloto de 3 meses em duas freguesias**, desenhado pelo próprio Novelo, para trocar os pressupostos pelos números reais.

---

## 1. O problema: o têxtil perde-se no lixo de todos os dias

Em 2025, as quatro entidades que recolhem têxteis em Guimarães apanharam **301,3 toneladas**. No mesmo ano a Vitrus recolheu **43 050,5 toneladas** de lixo indiferenciado, **84,0%** do que o concelho produziu (Relatório e Contas 2025 da Vitrus, p. 8). O concelho todo deitou assim cerca de **51 250 t** ao indiferenciado. Segundo a APA, **5,86%** do indiferenciado é têxtil (Relatório Anual de Resíduos Urbanos 2025, p. 24), a base que a Vitrus nos indicou: cerca de **3 003 toneladas por ano** a caminho do aterro (estimativa). O concelho gera cerca de 3 305 t de têxtil por ano e só **9,1%** chega à recolha seletiva.

Do pouco que se recolhe, o destino mostra onde está o valor: **59,4% reutilização, 26,5% reciclagem, 14,1% rejeito** (dados da Vitrus, 2025). A reciclagem custa mais do que a fibra virgem; o valor está na **reutilização**, e a reutilização exige têxtil limpo e seco.

![Cerca de 9,1% do têxtil gerado chega à recolha seletiva: 301,3 t recolhidas em 2025 contra cerca de 3 003 t ainda no lixo, e o destino do que se recolhe](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-problema.jpg)

O têxtil não desaparece longe: perde-se nos **2 751 contentores municipais** de indiferenciado, orgânico e seletivo, em todas as freguesias. E cada tonelada que lá cai paga **105,64 € de tratamento** em aterro (Vitrus).

![Onde se perdem as 3 003 t por ano: os locais municipais com contentores, com o têxtil que se estima perder em cada um](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-mapa.png)

### A pergunta da Vitrus

> Como criar um serviço de recolha seletiva de têxteis pós-consumo que garanta material reutilizável e reciclável, com o menor investimento e o menor custo de operação?

### O que a lei muda, e o que não muda

- **Hoje:** a recolha seletiva de têxteis é obrigatória desde 1 de janeiro de 2025 (Diretiva 2008/98/CE, alterada em 2018, e regime geral de gestão de resíduos). Não há entidade gestora de têxteis em Portugal: **paga o município**.
- **A Diretiva (UE) 2025/1892** obriga a criar, até 17 de abril de 2028, a responsabilidade alargada do produtor (RAP). Mas os produtores só pagam as peças **postas à venda depois da lei nacional** (art. 22.º-A, n.º 11). O têxtil que já está nas casas continua anos a pesar na câmara.
- **E só o custo eficiente:** os custos cobertos "não podem exceder os custos necessários à prestação economicamente eficiente" e são fixados "entre os intervenientes relevantes" (art. 22.º-A, n.º 12), entre os quais as autoridades locais (n.º 7).
- **A rede tem de cobrir todo o território**, "tendo em conta a dimensão e a densidade da população, o volume previsto [...], a acessibilidade e a proximidade [...], sem estar limitado a zonas onde a recolha [...] seja rendível" (art. 22.º-C, n.º 9, b)).

**Quem chegar à mesa sem saber o que custa cada tonelada não tem como defender o seu número.** O Novelo dá esse número, freguesia a freguesia.

---

## 2. Ouvimos a Vitrus e refizemos o modelo, duas vezes

O mentor da Vitrus respondeu-nos a 21 e a 22 de outubro. Mudámos o modelo e a história no mesmo dia:

| Data | A Vitrus disse | O que mudou no Novelo |
| --- | --- | --- |
| 21 out | Não tem contentores de têxtil e não os quer: o têxtil de contentor vem contaminado e perde a reutilização | A rede proposta deixou de ter contentores de têxtil. O contentor de rua ficou só como referência, para comparar com o modelo francês |
| 21 out | A reciclagem é muito mais cara do que a fibra virgem | O valor medido passou a ser a **reutilização**: cada cenário mostra as toneladas reutilizáveis |
| 21 out | Os ficheiros QGIS têm todos os contentores de indiferenciado, orgânico e seletivo | Os 2 751 contentores passaram a ser a base geográfica: onde o têxtil se perde |
| 22 out | O saco de têxtil não pode ir no camião compactador do porta a porta, nem na cabine, num gancho ou numa caixa lateral; um compactador também não pode fazer uma volta só de têxtil. O caminho é "a aquisição de um meio novo de recolha" | Saiu o saco no camião do porta a porta. A rede passa a ter **uma viatura de têxtil nova, sem compactação** |
| 22 out | Não há viaturas livres à tarde: a folha de turnos tinha um erro | Caiu o plano B das viaturas paradas à tarde |
| 22 out | Usar 5,86% (APA, 2025) sobre o indiferenciado do concelho todo | A procura passou a cerca de 3 003 t por ano; a captura atual, a 9,1% (estimativas). Antes: 43 051 t × 5,4% = 2 324,8 t e 11,5% |
| 22 out | O tratamento do indiferenciado em aterro custa 105,64 €/t (40 €/t de taxa de gestão de resíduos e 65,64 €/t da Resinorte) | Cada cenário conta o tratamento evitado: a rede paga parte do seu custo |
| 22 out | O depósito é o Estaleiro Operacional da Rua das Lameiras, em Polvoreira | As rotas da viatura de têxtil partem e acabam lá |

---

## 3. A resposta: uma viatura de têxtil, nenhum contentor novo

A Vitrus fechou duas portas: o saco não pode ir no camião do lixo (a compactação estraga-o) e não há viaturas livres à tarde. E abriu uma: **um meio novo de recolha**. O Novelo desenha a rede à volta dessa viatura, sem compactação, que parte do Estaleiro Operacional da Rua das Lameiras, em Polvoreira:

1. **Saco fechado à porta, num dia fixo por freguesia.** Quem tem roupa para dar deixa o saco fechado à porta nesse dia. A viatura recolhe-o seco e sem compactar. O Novelo diz em que dia passa em cada freguesia e quantos quilos se esperam por ronda.
2. **Locais municipais que já existem e escolas, sem contentor novo.** Paragens nos locais municipais e nas **86 escolas** como pontos com pessoas, onde o saco é entregue em mão e recolhido no momento.

![Plano de recolha: cada freguesia com o dia e os quilos por ronda](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-plano-recolha.png)

**Porque uma viatura nova, e não o camião que já passa?** Perguntámos à Vitrus. O saco iria para a caixa de compactação e estragava-se; cabine, gancho ou caixa lateral também não são possíveis. Um compactador não pode fazer uma volta só de têxtil, por contaminação. E a folha de turnos que parecia mostrar viaturas paradas à tarde tinha um erro: à tarde as viaturas estão em uso. A viatura nova é o caminho que a própria Vitrus indicou.

**Quem paga a viatura?** O lixo que deixa de ir para aterro. Cada tonelada desviada poupa **105,64 €** de tratamento (40 €/t de taxa de gestão de resíduos e 65,64 €/t da Resinorte, valores da Vitrus). No cenário recomendado, a viatura custa 42 500 € (5 312,50 € por ano em 8 anos) e o custo total da rede é de 45 828 € por ano; o tratamento evitado, 47 093 € por ano, cobre-o (estimativas). O Novelo põe esta poupança ao lado do custo de cada cenário.

---

## 4. O produto: decidir, provar, operar e prestar contas

### Decidir: o simulador da rede

O decisor escolhe o orçamento ou a meta. O otimizador decide que freguesias servir, com que canal, e calcula as rotas da viatura de têxtil. Cada cenário mostra **investimento, custo anual, toneladas, toneladas reutilizáveis, €/t e população servida**, num mapa.

![Simulador: orçamento de 60 000 €/ano, o mapa das freguesias servidas e os indicadores do cenário](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-simulador.png)

| Cenário (estimativas) | Custo anual | Toneladas por ano | €/t | Tratamento evitado | Reutilizável |
| --- | ---: | ---: | ---: | ---: | ---: |
| Orçamento de 40 000 €/ano | 26 909 € | 378,5 t | 71,1 | ≈ 39 985 € | ≈ 224,8 t |
| **Orçamento de 60 000 €/ano (recomendado)** | **45 828 €** | **445,8 t** | **102,8** | **47 093 €** | **264,9 t (222,9 a 324,8)** |
| Orçamento de 100 000 €/ano | 85 860 € | 571,2 t | 150,3 | ≈ 60 342 € | ≈ 339,3 t |
| Teto sem contentores (2 viaturas) | 170 623 € | 772,1 t | 221,0 | ≈ 81 565 € | 458,8 t |

Os valores com "≈" são cálculo nosso sobre as toneladas do cenário: × 105,64 €/t (Vitrus) e × 59,4% de reutilização (2025).

No cenário recomendado, a maior parte das toneladas vem das paragens nos locais municipais que já existem (60 pontos em 45 freguesias, 366,3 t); o saco à porta só vai onde compensa (4 freguesias, 79,5 t). A viatura trabalha cerca de 1,67 dias por semana. Até aos 60 000 €/ano, o tratamento evitado paga a operação; depois, o custo por tonelada sobe à medida que a rede chega às freguesias mais dispersas. **É esta curva que permite decidir com números, e não a olho.** A meta francesa (669,7 t) fica ao alcance sem contentores, entre os 100 000 e os 150 000 €/ano (estimativa).

### Decidir: só conta o que se pode reutilizar

O desafio pede material **reutilizável**. Por isso cada cenário mostra as **toneladas reutilizáveis** e o **custo por tonelada reutilizável**, com a quota observada em 2025 (59,4%) e o intervalo entre entidades (50,0% a 72,9%).

A qualidade depende de quem recolhe e como. Nos dados da Vitrus de 2025, a Ultriplo encaminhou 72,9% para reutilização; o pouco têxtil recolhido pela Vitrus, só 9,2%, com 56,9% de rejeito. É a prova, com números, do que a Vitrus nos disse sobre os contentores.

![Têxtil reutilizável no resumo do cenário e na comparação lado a lado de 60 000 e 40 000 €/ano, na rede por locais reais](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-reutilizavel.png)

### Provar: a cobertura que a diretiva exige

O separador **Cobertura** mostra, freguesia a freguesia, os quatro critérios do art. 22.º-C, n.º 9, b): população, densidade, volume previsto, proximidade e o canal usado. Com 60 000 €/ano, o cenário serve **73,9% da população nas 36 freguesias predominantemente urbanas e 60,2% nas 12 restantes** (estimativas). A rede não se fica pelas zonas fáceis, mas o separador mostra também o que falta: a única freguesia predominantemente rural, Arosa e Castelões, fica sem serviço neste orçamento.

![Separador Cobertura: os critérios do art. 22.º-C, o resumo por tipo de território e a tabela por freguesia](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-cobertura.png)

### Provar: e se os pressupostos estiverem errados?

Os custos por hora e por km das viaturas ainda não chegaram do financeiro da Vitrus. Por isso a incerteza é um resultado, não uma nota de rodapé: a **análise de tornado** mostra que pressuposto mais pesa, e a **simulação de Monte Carlo** dá o intervalo. No cenário recomendado, **em 8 de cada 10 casos o custo fica entre 82,0 e 141,3 €/t** (500 amostras, semente 7).

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

![O primeiro passo da história que o júri vê ao entrar: cerca de 3 003 t de têxtil por ano ainda vão para o lixo em Guimarães](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-onboarding.png)

![Três ecrãs no telemóvel: a página de entrada, o resumo de um cenário e o mapa](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-telemovel.png)

---

## 5. Como respondemos aos critérios do júri

| Critério | Peso | O que construímos | Onde se vê |
| --- | :---: | --- | --- |
| **Impacto e relevância** | 30% | +445,8 t por ano desviadas do lixo, 264,9 t reutilizáveis, captura de 9,1% para cerca de 22,6%; 47 093 € por ano de tratamento evitado, a 105,64 €/t (Vitrus), que paga a operação (estimativas); a resposta a "quem paga?" antes e depois da RAP; cobertura de todo o território, não só das zonas rendíveis | Simulador, separador Cobertura, relatório RAP |
| **Inovação e originalidade** | 25% | Uma rede **sem contentores**: uma só viatura de têxtil nova, o saco à porta e os locais que já existem; o otimizador decide canal a canal; a IA conduz o modelo matemático, mas um verificador impede-a de inventar números; do saco ao lote com passaporte | Plano de recolha, copiloto, passaporte |
| **Viabilidade técnica** | 25% | Em produção, com os dados reais da Vitrus (40 circuitos, 29 viaturas, 2 751 contentores, 301,3 t por destino); nenhum contentor novo e uma só viatura nova, a que a Vitrus indicou (o investimento do cenário recomendado é de 57 500 €: 42 500 € na viatura e o resto em 60 pontos, estimativa); pressupostos visíveis e etiquetados; incerteza calculada; 1 042 testes da API, 432 da web e testes de ponta a ponta no browser; 155 perguntas de avaliação ao copiloto, com 100% dos números verificados | Pressupostos, robustez, [código](https://github.com/helderpgoncalves/novelo) |
| **Apresentação e continuidade** | 20% | Uma história de seis passos para quem entra pela primeira vez; um piloto de 3 meses desenhado pelo próprio Novelo; replicável em qualquer município com dados abertos | [novelo.helder.si](https://novelo.helder.si) |

---

## 6. Rigor: nenhum número sem fonte

| Dado | Fonte | Estado |
| --- | --- | --- |
| 301,3 t recolhidas em 2025 e o destino (59,4 / 26,5 / 14,1%) | Vitrus Ambiente | Dado |
| 43 050,5 t de indiferenciado recolhido pela Vitrus em 2025, 84,0% do concelho | Vitrus Ambiente, Relatório e Contas 2025, p. 8 | Dado; o concelho todo, cerca de 51 250,6 t, é cálculo nosso |
| 5,86% de têxtil no indiferenciado | APA, Relatório Anual de Resíduos Urbanos 2025, p. 24; base indicada pela Vitrus (22 out 2026) | Média nacional; as 3 003,3 t por ano são estimativa |
| 105,64 €/t de tratamento em aterro (40 €/t de taxa de gestão de resíduos e 65,64 €/t da Resinorte) | Vitrus Ambiente (22 out 2026) | Dado |
| 40 circuitos, 29 viaturas, 101 turnos, 82 localidades; depósito na Rua das Lameiras, Polvoreira | Vitrus Ambiente | Dado |
| 2 751 contentores municipais em 2 026 locais | Vitrus Ambiente (pacote QGIS) | Dado |
| População e tipologia de cada freguesia | INE; contornos oficiais CAOP 2019 | Dado |
| Custos por hora e por km das viaturas, captura por canal | Pressupostos da equipa, visíveis no ecrã | Por receber do financeiro da Vitrus |

- Todo o valor estimado leva no ecrã a palavra **"estimativa"**.
- Os pressupostos mudam-se no ecrã e o resultado recalcula de imediato.
- A procura conta o indiferenciado do **concelho todo**, não só os 84,0% que a Vitrus recolhe, como a Vitrus nos indicou a 22 de outubro.
- O que ainda não sabemos, dizemo-lo: o custo por hora e por km das viaturas e a sazonalidade (os quilos por mês só se partilham com o município).

![Como o Novelo decide, passo a passo: dados, procura, otimizador, cenários e verificação](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-metodo.png)

---

## 7. Depois do hackathon

1. **Piloto de 3 meses em duas freguesias.** O Novelo escolhe-as para aprender o máximo pelo menor custo, pesando o contraste urbano e rural, a densidade e o custo de arranque. Mede toneladas, €/t e rejeito contra o previsto. A recomendação atual é Aldão e Arosa e Castelões. Para a medição valer, o piloto precisa de pelo menos **1,71 t em 3 meses** (cálculo do tamanho da amostra); a previsão é de 2,43 t (estimativa).
2. **Calibração contínua.** Cada lote triado devolve dados reais, e as taxas de captura deixam de ser pressupostos.
3. **Escala.** A obrigação é a mesma em todos os municípios portugueses e europeus. O Novelo funciona com os dados abertos de cada concelho e com o inventário de contentores que todas as câmaras já têm.

---

## Como foi feito

- **Web:** React, Vite, TanStack Router e Query, Tailwind v4 e shadcn/ui; aplicação instalável (PWA), pt-PT e inglês, acessibilidade AA.
- **API:** FastAPI (Python 3.12), PostgreSQL, **OR-Tools** (CP-SAT para a localização, VRP para as rotas); contrato OpenAPI com o cliente TypeScript gerado.
- **IA, identificada e limitada:** o copiloto e a triagem usam modelos via **OpenRouter** e devolvem JSON validado, nunca fazem contas, e um verificador rejeita números fora da origem. No desenvolvimento usámos **Claude Code** e **GLM (Z.ai)** como assistentes de programação.
- **Qualidade:** 1 042 testes da API e 432 testes da web, verdes em cada entrega; testes de ponta a ponta no browser; e uma avaliação do copiloto com o modelo real, 155 perguntas, 100% dos números verificados.
- **Em produção** em [novelo.helder.si](https://novelo.helder.si) (Coolify, Docker), com **código aberto** em [GitHub](https://github.com/helderpgoncalves/novelo).

## Equipa

**Hélder Gonçalves** e **Flávio Fernandes**. Construído durante o Hack4Guimarães 2035.

---

## In English

**More than 9 in 10 kilos of Guimarães' textiles end up in the bin. Novelo designs the collection that brings them back: one new vehicle just for textiles, and not a single new container.**

Novelo is a decision tool that designs Guimarães' separate textile collection at the lowest cost. Give it a budget or a target; it returns scenarios in **euros, tonnes, reusable tonnes and € per tonne**, computed by an optimiser (OR-Tools CP-SAT and VRP) on real data from Vitrus Ambiente, the municipal waste company.

- **The problem.** In 2025 the municipality put about 51,250 t into mixed waste (Vitrus collected 43,050.5 t, 84.0% of it); at 5.86% textiles (APA), about **3,003 t a year** never reach separate collection, against 301.3 t collected separately (estimates). Separate collection has been mandatory since January 2025 and the municipality pays for it alone.
- **The answer.** No textile bins: Vitrus does not want them, because bin textiles arrive contaminated. The bag cannot ride in the refuse truck either: compaction ruins it. So, as Vitrus suggested, **one new non-compacting textile vehicle** collects the closed bag at the door on a fixed day per parish and stops at existing municipal sites and the 86 schools.
- **The saving.** Every tonne taken out of the bin saves **€105.64** in landfill treatment (Vitrus figures).
- **The numbers.** With **€60,000 a year**, the network spends €45,828 and diverts **445.8 t a year at €102.8/t**, about 265 t of it reusable, lifting capture from 9.1% to about 22.6%. The avoided treatment, €47,093 a year, pays for the operation (estimates).
- **The law.** Directive (EU) 2025/1892 makes producers pay only for items first sold after national transposition, and only the cost-efficient amount, agreed with local authorities at the table. Novelo gives the municipality that number, parish by parish.
- **AI that never does the maths.** The copilot turns questions in plain Portuguese into optimiser runs; a verifier rejects any number not in the source.
- **Next step.** A 3-month pilot in two parishes, chosen by Novelo itself.

Live at [novelo.helder.si](https://novelo.helder.si) · Open source at [github.com/helderpgoncalves/novelo](https://github.com/helderpgoncalves/novelo)

---

## Fontes

- Dados da Vitrus Ambiente: têxtil recolhido por entidade e destino em 2025, circuitos e turnos, pacote QGIS de contentores municipais, Relatório e Contas 2025 (p. 8) e respostas do mentor de 21 e 22 de outubro de 2026.
- Agência Portuguesa do Ambiente, Relatório Anual de Resíduos Urbanos 2025 (p. 24): 5,86% de têxtil no indiferenciado.
- [Diretiva (UE) 2025/1892](https://eur-lex.europa.eu/eli/dir/2025/1892/oj), Jornal Oficial da União Europeia, 26 de setembro de 2025 (artigos 22.º-A, 22.º-C e 22.º-D).
- [Perguntas frequentes sobre têxteis](https://apambiente.pt/sites/default/files/_Residuos/FluxosEspecificosResiduos/Texteis/perguntas-frequentes_texteis.pdf), Agência Portuguesa do Ambiente, dezembro de 2025.
- INE: população por freguesia (Censos 2021) e tipologia de áreas urbanas; DGT: Carta Administrativa Oficial de Portugal (CAOP 2019).
- Detalhe do modelo, dos pressupostos e de cada número: [Dados e modelo](https://github.com/helderpgoncalves/novelo/blob/main/docs/engenharia/dados-e-modelo.md) e [Registo de afirmações](https://github.com/helderpgoncalves/novelo/blob/main/docs/pesquisa/registo-de-afirmacoes.md).
