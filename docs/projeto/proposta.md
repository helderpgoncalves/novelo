# Novelo: proposta para o Desafio 5 do Hack4Guimarães 2035

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../img/banner-escuro.png">
  <img src="../img/banner-proposta.png" alt="Novelo: recolha seletiva de têxteis, desenhada ao menor custo" width="100%">
</picture>

*19 de outubro de 2026 · Hélder Gonçalves e Flávio Fernandes*

**Novelo, proposta para o Desafio 5 (TexVitrus) do Hack4Guimarães 2035:** uma ferramenta de decisão que desenha a rede de recolha de têxteis de Guimarães ao menor custo, com cenários comparáveis em euros, toneladas e €/t.

## Escolha: Desafio 5, com dois riscos

Recomendamos o TexVitrus. É o único desafio proposto por uma entidade com um problema real e dados próprios, encaixa no que fazemos (plataforma, IA, otimização) e não precisa de hardware.

**A Vitrus não é um cliente privado.** É a empresa municipal de Guimarães, fundada em 2010, com autonomia administrativa e financeira. Vender-lhe algo depois passa por contratação pública. O argumento comercial fica até melhor: todos os municípios têm o mesmo problema, e a diretiva obriga a criar um regime de responsabilidade alargada do produtor para têxteis e calçado até 17 de abril de 2028. Os produtores passam a cobrir o custo eficiente de recolha, triagem, preparação para reutilização e reciclagem das peças postas à venda depois da lei nacional (art. 22.º-A, n.º 11); esse custo determina-se com as autoridades locais (n.º 7 e 12). Uma ferramenta que diga quanto custa por tonelada recolher têxteis num território interessa à câmara, aos sistemas de gestão de resíduos e às futuras entidades gestoras.

**Riscos:**

- Tem menos "wow de IA" à partida que o Desafio 1. O coração da pergunta é custo e logística, não visão computacional. Se fizermos só um classificador de roupa, perdemos.
- Já há quem faça triagem por app em Guimarães: a To-Be-Green valoriza roupa em fim de vida com triagem e "lojas sociais digitais". Não podemos chegar com isso como ideia principal.

## O que já se sabe

Guimarães publicou em novembro de 2025 um Plano de Ação Integrado para a Circularidade Têxtil. Serve de contexto público. A 21 de outubro de 2026 a Vitrus disse não o conhecer: os números do modelo vêm da Vitrus e da APA (desde 22 de outubro, 51 250,6 t de indiferenciado do concelho × 5,86% ≈ 3 003 t por ano ainda no lixo, estimativa).

| Tema | O que diz o plano | Porque nos interessa |
| --- | --- | --- |
| Quanto têxtil há | 5,4% do lixo indiferenciado (UE 4,7%, PT ~4%), 0,7 kg/hab/mês | Substituído pelos valores da Vitrus e da APA: 51 250,6 t de indiferenciado do concelho × 5,86% ≈ 3 003,3 t/ano (22 out; cálculo nosso, estimativa) |
| Território | Ocupação dispersa, 48 freguesias; porta a porta pode ser inviável | O custo está nas zonas dispersas: é aí que se ganha |
| Fluxo escondido | Microempresas têxteis deitam retalhos no lixo urbano; com menos de 10 trabalhadores não têm mapa de resíduos | Ninguém sabe onde está esse têxtil |
| Custo operacional | As fibras enrolam-se nas máquinas | Tirar têxtil do indiferenciado poupa dinheiro além do aterro (o aterro custa 105,64 €/t, Vitrus, 22 out) |
| Triagem | Ainda manual; automação (NIR) cara e incipiente | Espaço para triagem barata por imagem |
| Destino de valor | 27 operadores licenciados na zona, só 4 reciclam ou valorizam | Ligação à indústria é um gargalo real |
| Meta oficial | Serviço público de recolha têxtil, +30% recolha seletiva até 2026: rotas, tipos de contentor, frequência | É literalmente o que nos pedem |
| PAYT | Desde 2016, paga-se por saco de indiferenciado; recicláveis grátis; ~10 000 utilizadores em 2022 | Incentivo económico pronto a ligar aos têxteis |

## A proposta

O Novelo é uma ferramenta de decisão para a Vitrus planear e operar a rede de recolha têxtil ao menor custo. Três peças, por ordem de importância.

### 1. Simulador da rede de recolha (a estrela)

O decisor escolhe um orçamento e uma meta de captura; a ferramenta devolve a rede ótima e os números.

- **Procura por zona:** população por subsecção (INE, BGRI 2021) × kg/hab × taxa de captura esperada, ajustada com a caracterização do lixo da Vitrus e as rotas onde já se encontrou mais têxtil.
- **Mistura de modos de recolha**, onde está a poupança:
    - saco fechado à porta num dia fixo por freguesia, recolhido por uma viatura de têxtil nova, sem compactação (o "meio novo de recolha" que a Vitrus indicou a 22 out: o saco não pode ir no compactador e não há viaturas livres);
    - pontos em locais existentes, sem contentor novo (juntas, escolas, ecocentros, paragem nos locais municipais), servidos pela mesma viatura;
    - sem contentores de rua de têxteis: a Vitrus não os quer, porque o têxtil de contentor vem contaminado (21 out 2026).
- **Otimização:** localização dos pontos (cobertura máxima / p-median) e rotas (VRP), ambas com OR-Tools.
- **Saída:** "Cenário A: 40 pontos, X € de investimento, Y €/ano de operação, Z t desviadas do aterro, W €/t" contra "Cenário B". O ecrã de comparação lado a lado é o que mostramos em palco.

### 2. Triagem na entrega, pelo telemóvel

Não é o produto principal: é o **controlo de qualidade na entrega**. O problema da Vitrus é a contaminação, e a foto confirma o estado no momento em que o saco chega. Uma foto da peça e outra da etiqueta de composição:

- um modelo de visão classifica o estado (reutilizável / reciclável / rejeito);
- OCR da etiqueta lê a composição (ex.: 60% algodão, 40% poliéster) e indica o destino certo. A reciclagem mecânica funciona bem com algodão e lã; misturas com elastano não.

Alimenta dados de qualidade por ponto de recolha, que hoje ninguém tem. E a qualidade varia muito com quem recolhe: em 2025 a Ultriplo reutilizou 72,9% e o têxtil recolhido pela Vitrus 9,2%, com 56,9% de rejeito (dados da Vitrus; registo A19). Por isso cada cenário mostra também as toneladas reutilizáveis e o € por tonelada reutilizável (estimativa). Diferencia-nos da To-Be-Green porque é triagem para o operador, não para o cidadão.

### 3. Incentivo e ligação à indústria (slides, pouco código)

- Créditos PAYT por entrega de têxteis: menos indiferenciado (que a câmara paga para tratar) e mais captura.
- Mapa dos fluxos para os poucos operadores de valorização e empresas do Vale do Ave, com toneladas estimadas por tipo de fibra.
- Opcional: recolha B2B para microconfeções. Retalho pré-consumo é limpo, homogéneo e vale mais. O desafio fala em pós-consumo, por isso fica como extensão.

## Execução

### Os 5 dias

1. **Dia 1:** reunião com o mentor (Lucas Nascimento, Vitrus). Obter dados, definir 2 a 3 cenários e custos unitários reais. Montar o mapa base.
2. **Dia 2:** modelo de procura e otimização de localização a funcionar com dados reais ou aproximados.
3. **Dia 3:** rotas e custos por cenário. Em paralelo, triagem por foto (rápida com um modelo de visão via API).
4. **Dia 4:** ecrã de comparação, polimento, números finais.
5. **Dia 5:** pitch e ensaio. Frase-âncora: "X t a menos em aterro, Y € por tonelada, sem comprar um único contentor nas zonas dispersas."

### Perguntas para o mentor no dia 1

- [ ] Quantos contentores têxteis existem hoje e quem os opera? (Se forem operadores privados ou IPSS que vivem da revenda, o cálculo de custo muda.)
- [ ] Custo por recolha e por km
- [ ] Custo por tonelada de indiferenciado
- [ ] Dá para cruzar com dados do PAYT?
- [ ] Como se divide o território entre a área da Vitrus e a da Resinorte?

### Stack

A stack, o deploy e o plano técnico completos estão no guia de desenvolvimento.

## Fontes

- [Plano de Ação Integrado para a Circularidade Têxtil de Guimarães](https://urbact.eu/sites/default/files/2026-01/Guimaraes_IAP_PT.pdf), Município de Guimarães / URBACT, 25 nov. 2025: dados de resíduos, PAYT, Vitrus, To-Be-Green, operadores e metas. Contexto público, não usado pela Vitrus; os números do modelo vêm da Vitrus e da APA.
- [Diretiva 2025/1892 que altera a Diretiva-Quadro dos Resíduos](https://www.vda.pt/pt/publicacoes/insights/diretiva-20251892-que-altera-a-diretiva-quadro-dos-residuos-diretiva-200898ce/28063/), VdA, 21 out. 2025: prazo de 17 abr. 2028 para a RAP têxtil e custos cobertos pelos produtores.
- [Resumo oficial do ato final (Diretiva (UE) 2025/1892)](https://oeil.europarl.europa.eu/oeil/en/procedure-document-summary/pdf?id=1845495), Parlamento Europeu: entrada em vigor a 16 out. 2025.
- [Diretiva (UE) 2025/1892, texto oficial em português](https://eur-lex.europa.eu/legal-content/PT/TXT/HTML/?uri=OJ:L_202501892), lido integralmente a 22 out. 2026 a partir do Jornal Oficial (Cellar). Leitura em [Enquadramento regulatório](../pesquisa/enquadramento-regulatorio.md).
- Desafio 5 TexVitrus, slide oficial do Hack4Guimarães 2035: pergunta, pontos de partida, dados disponíveis e mentor.
