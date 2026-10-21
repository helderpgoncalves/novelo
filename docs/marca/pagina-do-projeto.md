![Novelo: recolha seletiva de têxteis, desenhada ao menor custo](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/banner-projeto.png)

# Guimarães recolhe 23% do têxtil que podia. O Novelo diz como chegar ao resto, ao menor custo.

**Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis de Guimarães.** Entram um orçamento e uma meta; saem cenários comparáveis lado a lado em **euros, toneladas e €/tonelada**, construídos sobre os números reais da Vitrus Ambiente.

**Experimenta já: [novelo.helder.si](https://novelo.helder.si)** · **Código aberto: [github.com/helderpgoncalves/novelo](https://github.com/helderpgoncalves/novelo)**

*Hack4Guimarães 2035 · Desafio 5 TexVitrus · Hélder Gonçalves e Flávio Fernandes*

---

## O problema: um nono recolhido, o resto no lixo

Em 2025, as entidades que recolhem têxteis em Guimarães apanharam **301,3 toneladas**, ou 0,16 kg por habitante por mês. No mesmo ano a Vitrus recolheu **43 051 toneladas** de resíduos urbanos e, segundo a APA, 5,4% disso é têxtil: cerca de **2 324,8 toneladas por ano** que ainda vão para o lixo (estimativa). A recolha atual capta **cerca de 11,5%** do têxtil gerado: o resto vai parar ao lixo indiferenciado, que o município paga para tratar, e perde-se matéria-prima que a indústria têxtil do Vale do Ave sabe aproveitar.

E o tempo conta. Desde 1 de janeiro de 2025 a recolha seletiva de têxteis é obrigatória. A **17 de abril de 2028**, a responsabilidade alargada do produtor passa a pôr os produtores a pagar a recolha e o tratamento, mas **só os custos economicamente eficientes**. Quem não souber o que custa cada tonelada não tem como defender o seu número.

![Cerca de 11,5% do têxtil gerado chega à recolha seletiva: 301,3 t recolhidas em 2025 contra cerca de 2 324,8 t ainda no lixo, destino do recolhido e rede atual](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-problema.jpg)

A pergunta que a Vitrus nos fez:

> Como criar um serviço de recolha seletiva de têxteis pós-consumo que garanta material reutilizável e reciclável, com o menor investimento e o menor custo de operação?

## A nossa resposta: uma camada de decisão, não mais um contentor

O Novelo não propõe um equipamento melhor. Responde, com números, a três perguntas que hoje não têm resposta: **onde investir, com que modo de recolha em cada zona e quanto custa cada tonelada.**

![Do saco ao fio: cada passo alimenta o seguinte](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/diagrama-do-saco-ao-fio.png)

![Do saco ao fio, num só lugar: simulador da rede, cenários e comparação, "E se...?", mapa, lotes com QR e passaporte, bolsa de fibra, evidência por marca, relatório RAP, triagem por foto e aplicação instalável](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-produto.jpg)

### 1. Planear: o simulador da rede

O decisor escolhe um orçamento e uma meta de captura. O otimizador (**OR-Tools**, com CP-SAT para a localização e VRP para as rotas) decide que pontos abrir e que modo serve cada zona:

- **pontos em locais existentes, sem contentor novo**, com investimento perto de zero;
- **recolha a pedido** nas zonas dispersas, aproveitando os circuitos que já passam lá, sem quilómetros novos.

Sem contentores de têxtil: a Vitrus não os quer, porque o têxtil de contentor vem contaminado e perde a reutilização, que é onde está o valor.

Parte da rede real: **40 circuitos, 29 viaturas e 82 localidades** da Vitrus, a população por freguesia do INE, a geometria oficial das 48 freguesias (CAOP) e os **2 751 contentores municipais** (indiferenciado, orgânico e seletivo) entregues a 20 de outubro: mostram onde o têxtil se perde no lixo e onde a viatura já passa, e servem de locais de paragem de investimento quase nulo.

Cada cenário mostra **investimento, custo anual, toneladas desviadas do aterro, €/t e população coberta**, num mapa, e compara-se com outro lado a lado.

### 2. Decidir: "E se...?" em português, com números verificados

O decisor pergunta como falaria a um colega: *"e se passássemos esta freguesia a recolha a pedido?"* O Novelo percebe a pergunta, mostra o que entendeu, corre o otimizador e explica a diferença.

**A IA nunca faz contas.** O modelo só traduz a pergunta num pedido estruturado. Todos os números vêm do otimizador ou da base de dados, e um **verificador rejeita qualquer número que não esteja na origem**. Se o modelo inventar um valor, o sistema recusa a resposta. Sem IA, tudo o resto continua a funcionar.

![Copiloto: pergunta em português, o otimizador responde e um verificador confere cada número](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-copiloto.png)

### 3. Recolher e triar: uma foto, uma peça, um lote

No ponto de entrega, uma fotografia da peça e da etiqueta classifica o estado, a fibra e a marca. O operador confirma; a IA assiste, não decide.

### 4. Seguir: lote com QR e passaporte público

Cada lote ganha um **código QR e um passaporte público**: origem, composição, peso e histórico. O recetor lê o QR com o telemóvel e sabe exatamente o que está a receber.

### 5. Valorizar: bolsa de fibra para a indústria do Vale do Ave

Os lotes agregam-se por fibra numa **bolsa para recicladores e indústria**. A indústria têxtil tem capacidade; faltam-lhe lotes limpos e homogéneos. O Novelo é a ponte.

### 6. Prestar contas: o relatório RAP num clique

Um **PDF pronto para a câmara**, com custo por tipo de território (tipologia de áreas urbanas do INE), toneladas por fibra e marcas encontradas: o dossiê de custo eficiente de que o município vai precisar em 2028 para negociar com os produtores.

## Rigor: dados reais e honestidade sobre a incerteza

![Como o Novelo decide, passo a passo: dados, procura calibrada com o recolhido, otimizador CP-SAT e VRP, cenários em euros, toneladas e €/t, copiloto com verificador de números](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-metodo.png)

![Dos dados abertos a cenários com preço; o terreno corrige o modelo](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/diagrama-como-funciona.png)

Tudo o que é número parte dos dados recebidos da Vitrus Ambiente: as toneladas por entidade e destino (**59,4% reutilização, 26,5% reciclagem, 14,1% rejeito**), os circuitos, as viaturas e as localidades, cruzados com INE, CAOP e OpenStreetMap.

Onde ainda não há dado, **dizemo-lo no ecrã**:

- Os custos unitários são **pressupostos visíveis e etiquetados**, com a origem de cada um.
- Todo o valor estimado leva a palavra **"estimativa"**.
- A incerteza é resultado, não nota de rodapé: **análise de tornado e simulação de Monte Carlo** mostram se o plano proposto aguenta, e por quanto, se os pressupostos estiverem errados.
- O modelo **calibra-se com o que for realmente recolhido**, semana a semana. Até lá, as taxas de captura por modo são pressupostos visíveis.

Nenhum número aparece sem fonte nem sem a sua etiqueta.

![Antes de gastar um euro, vê o que cada meta exige: mini simulador da meta de captação e intervalo P10, P50 e P90 do custo por tonelada (estimativa)](https://raw.githubusercontent.com/helderpgoncalves/novelo/main/docs/img/pagina-prova.png)

## Porque importa

- **Para a Vitrus e a câmara:** decidir com números comparáveis, em vez de a olho, e chegar a 2028 com o dossiê de custo pronto.
- **Para o ambiente:** menos têxtil no aterro, mais material limpo para reutilizar e reciclar.
- **Para a indústria do Vale do Ave:** lotes rastreáveis e homogéneos, o que os recicladores pedem.
- **Para outros municípios:** a diretiva é europeia e o problema é o mesmo em todo o lado; o Novelo é replicável com dados abertos.

## Próximo passo: um piloto de 3 meses

Propomos à Vitrus um **piloto de 3 meses em duas freguesias**, com indicadores medidos e um piso de sinal que diz quando a rede está a funcionar, e a calibração do modelo com o que for realmente recolhido.

## Como foi feito

- **Web:** React, Vite, TanStack Router e Query, Tailwind v4, shadcn/ui; aplicação instalável (PWA), em pt-PT e inglês, com tema claro e escuro, mobile primeiro e acessibilidade AA.
- **API:** FastAPI (Python 3.12), PostgreSQL, **OR-Tools** para otimização, contrato OpenAPI com cliente TypeScript gerado.
- **IA:** via OpenRouter, **identificada e limitada**: devolve JSON validado, nunca faz contas, e um verificador rejeita números fora da origem.
- **Qualidade:** mais de 800 testes automáticos (pytest, Vitest, Playwright) e verificação do contrato antes de cada entrega.
- **Em produção** em [novelo.helder.si](https://novelo.helder.si) (Coolify, Docker), com **código aberto**.

## Equipa

**Hélder Gonçalves** e **Flávio Fernandes**. Construído durante o Hack4Guimarães 2035, em cinco dias.

---

## In English

**Novelo is the decision tool that designs Guimarães' textile collection network.** Give it a budget and a target; it returns side-by-side scenarios in **euros, tonnes and € per tonne**, built on real data from Vitrus Ambiente, the municipal waste company.

**The problem.** In 2025 Guimarães collected **301.3 tonnes** of textiles. Vitrus collected 43,051 tonnes of municipal waste that year and, per the Portuguese Environment Agency, 5.4% of it is textiles: about **2,324.8 tonnes a year** still going to waste (estimate), so today's capture is roughly **11.5%**. From **17 April 2028**, extended producer responsibility will make producers pay for collection and treatment, but only for *cost-efficient* operations. A municipality that cannot say what a tonne costs cannot defend its number.

**What it does.**

- **Network simulator:** an OR-Tools optimiser (CP-SAT for placement, VRP for routes) picks which points to open and which mode serves each area (drop-off at existing venues with no new container, or on-demand pickup; Vitrus does not want textile bins, because contaminated textiles lose their reuse value), starting from the real 40 circuits and 29 vehicles.
- **"What if...?" in plain Portuguese:** the optimiser answers with a new scenario. **The AI never does the maths**: every number comes from the optimiser or the database, and a verifier rejects anything else.
- **Bag to fibre:** photo triage of garment and label as a quality check at drop-off, lots with QR code and public passport, and a fibre marketplace for Ave Valley recyclers.
- **One-click EPR report (PDF)** with cost per territory type: the dossier the municipality will need in 2028.

**Rigour.** Real data everywhere. Where data is missing we say so: unit costs are labelled assumptions, every estimate is marked "estimate", and tornado and Monte Carlo analyses show whether the plan holds if the assumptions are wrong.

**Next step.** A 3-month pilot in two parishes.

Live at [novelo.helder.si](https://novelo.helder.si) · Open source at [github.com/helderpgoncalves/novelo](https://github.com/helderpgoncalves/novelo)
