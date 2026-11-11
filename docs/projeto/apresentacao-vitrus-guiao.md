# Guião de ensaio — apresentação à Vitrus e à Câmara

A fala corrida, palavra a palavra, da apresentação de **12 de novembro de 2026** (~23 min estruturados + folga natural dos momentos ao vivo ≈ 25 min, + perguntas; Flávio sozinho). Complementa o [plano completo](apresentacao-vitrus-camara.md), que tem as decisões, as perguntas esperadas e as checklists. A spec dos slides está em [Slides](apresentacao-vitrus-slides.md); o vídeo, em [Vídeo](apresentacao-vitrus-video.md).

**Linha do discurso:** a gestão é a espinha dorsal — o que cada decisão custa, rende e arrisca, em números verificáveis. A operação (triagem, motorista, sacos) entra como **convite para desenhar junto**, não como aula: quem sabe operar está na sala, não no palco.

**Como ensaiar:** ler em voz alta com cronómetro; as marcações «PALCO» são gestos e cliques; a fala adapta-se ao teu natural, mas **os números não se mudam**. Três ensaios cronometrados (um com falha simulada, plano §9). O QR no telemóvel do presidente calha aos ~14:30 — dentro da janela em que ele está na sala.

**Linha do tempo**

| Tempo | Bloco | Suporte | Ao vivo? |
| --- | --- | --- | --- |
| 0:00–1:30 | Abertura | slide 1 | — |
| 1:30–2:30 | O problema em 4 números | slide 2 | — |
| 2:30–3:30 | A mesma página, na app | app `/` | — |
| 3:30–4:00 | Ponte: o que está a funcionar | slide 3 | — |
| 4:00–6:30 | Cenários A/B: a mesma pergunta, dois desenhos | app `/scenarios` | — |
| 6:30–9:30 | «E se...?» | app cenário B | **ao vivo 1** |
| 9:30–11:00 | A conversa do orçamento | app `/scenarios` (cadeia) | — |
| 11:00–12:30 | O piloto: um dia de viatura | app cenário «Piloto» | — |
| 12:30–16:30 | A prova: do saco ao fio | app `/triage` → QR → Sankey → `/brands` | **ao vivo 2** |
| 16:30–17:00 | «Vai no saco?» | app `/bag-check` | — |
| 17:00–18:30 | A rede no terreno — e as empresas | app `/municipal` (+ B2B) | — |
| 18:30–20:00 | Relatório RAP | app `/reports` + PDF impresso | — |
| 20:00–21:30 | A resposta sobre a triagem | slide 4 | — |
| 21:30–23:00 | Os três pedidos e fecho | app `/pilot` + slides 5–6 | — |
| — | Perguntas | slide 6 no ecrã | — |

**Antes de entrar na sala** (−5 min; detalhe no plano §4.0): login com password feito, hotspot do telemóvel ativo, camisola com etiqueta legível + toalha velha em cima da mesa, saco de demonstração com o QR do lote `NOV-BXS4UW` colado, separadores abertos por ordem, zoom testado no ecrã da sala.

**Regras de ouro** (plano §8): nunca procurar ecrã ao vivo; só dois momentos ao vivo; se falhar, a frase do plano B e segue-se, sem desculpas longas; «estimativa» diz-se sempre; não sabes — «boa pergunta, anoto e respondo com número»; um objetivo por ecrã, uma frase e aponta-se; o QR lê-se no telemóvel **do presidente**; falar **com** a Vitrus, não para o projetor.

---

## 1. Abertura — slide 1 (0:00–1:30)

> Bom dia, senhor presidente. Bom dia, Lucas, equipa da Vitrus. Obrigado por receberem o Novelo — e obrigado, já agora, pelos dados: sem os números que vocês nos abriram, nada do que vou mostrar existiria.
>
> Sou o Flávio Fernandes; o Hélder Gonçalves, que hoje não pôde estar, segue connosco à distância. Há três semanas, o Hack4Guimarães pôs uma pergunta: como desenhar a rede de recolha de têxteis de Guimarães ao menor custo. Ganhámos esse desafio — mas o prémio que interessa está aqui: uma ferramenta a funcionar, em produção, que responde em números à pergunta que vocês fizeram: **onde** recolher, **como**, e **a quanto fica** cada tonelada tirada do aterro.
>
> O que vos mostro é sobretudo isto: **a gestão da rede em números** — o que cada decisão custa, o que rende e o que arrisca. No fim, três pedidos. Começo pelo princípio: onde estamos.

## 2. O problema em 4 números — slide 2 (1:30–2:30)

**PALCO:** muda para o slide 2; aponta um número de cada vez.

> Quatro números, e são todos vossos.
>
> **301,3 toneladas** de têxtil recolhidas à parte em 2025 — medido, são os vossos dados.
>
> **Cerca de 3 003 toneladas por ano** ainda vão no indiferenciado — estimativa: 5,86 por cento do indiferenciado do concelho, a base da APA que vocês próprios nos indicaram.
>
> **105,64 euros** é o que cada tonelada desviada do aterro deixa de custar.
>
> E o relógio: **17 de abril de 2028**, prazo da responsabilidade alargada do produtor.
>
> Isto resume o desafio: nove em cada dez quilos de têxtil que Guimarães gera ainda vão para o lixo — e em 2028 a fatura muda de dono. Quem chegar a essa mesa a saber o seu custo por tonelada defende o seu número.
>
> E a frase que resume o que encontramos: **com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia 431 toneladas por ano do aterro, a 101,9 euros por tonelada — e os 45 542 euros de tratamento evitado pagam a operação.** Estimativa — e é por isso que há um piloto para confirmar.

## 3. A mesma página, na app — app `/` (2:30–3:30)

**PALCO:** muda para a app, ecrã inicial.

> Isto é a primeira página do Novelo, em produção — é a página que se abre todos os dias.
>
> **PALCO:** aponta a faixa de situação. A faixa de cima são os mesmos quatro números — e reparem no selo: cada um diz se é «medido» ou «estimativa». Nenhum número aqui se apresenta como dado quando é estimativa — é a regra da casa, do início ao fim.
>
> **PALCO:** aponta o comando de orçamento. Este comando é a conversa de gestão: mexo no orçamento e vejo logo a recolha que esse orçamento compra — sem esperar por cálculos, porque interpola entre cenários guardados.
>
> **PALCO:** aponta o mapa em meio-tom; desce à barra de confiança. O mapa mostra onde o têxtil se perde, sobre a vossa rede municipal — 2 751 contentores em 2 026 locais, o pacote de 20 de outubro. E a barra no fundo é a confiança dos dados: medido, estimado, em falta. Quando o piloto correr, o «estimado» vai-se tornando «medido».

## 4. Ponte: o que está a funcionar — slide 3 (3:30–4:00)

> O que está a funcionar cabe em três verbos: **planear** — simulador, cenários e rotas medidas pelas estradas reais; **decidir em português** — perguntar «e se...?» e receber números verificados; e **provar** — da peça triada ao relatório de 2028. Tudo funciona, e tudo se vê agora, ao vivo. Vamos lá.

## 5. Cenários A/B — app `/scenarios` (4:00–6:30)

**PALCO:** comparação A/B pré-aberta. **Plano B:** capturas no slide.

> A pergunta que fizeram foi: qual é a rede de menor custo? A resposta começa por comparar desenhos — mesma pergunta, dois desenhos, números comparáveis.
>
> **PALCO:** aponta o cenário A. O cenário A é o modelo clássico: contentores de têxtil em todo o concelho. É a referência — e é o modelo que a Vitrus **não** quer, e com razão: o têxtil de contentor vem contaminado e perde a reutilização, que é onde está o valor.
>
> **PALCO:** aponta o cenário B. O cenário B segue o desenho que vocês indicaram a 22 de outubro: uma viatura nova, só para têxtil, sem compactação; o saco fechado à porta, num dia fixo por freguesia; e paragens em locais que já existem — os vossos locais municipais e as escolas. Nem um contentor novo.
>
> **PALCO:** pausa de 3 segundos no €/t de cada um. Deixa o ecrã falar.
>
> Com 60 mil euros por ano, o B capta 431 toneladas a 101,9 euros por tonelada — estimativa. E a conta que interessa ao município, o custo líquido: o aterro evitado, 45 542 euros, paga a operação — e sobra, por pouco: menos 1 628 euros por ano no caso central.
>
> **PALCO:** aponta a etiqueta «Por estrada». Uma nota de rigor: os quilómetros destas rotas não são linha reta — são medidos pelas estradas reais, com o OpenStreetMap, num servidor nosso, sem custos. Cada rota diz se é «por estrada» ou estimada.

## 6. «E se...?» — ao vivo 1 — app cenário B (6:30–9:30)

**PALCO:** separador do cenário B, campo «E se...?» visível. **Plano B:** pergunta de reserva em cache: «E se o orçamento subir de 60 000 para 90 000 €?».

> Chego à parte de que mais gosto: a ferramenta não obriga a saber de otimização. Pergunta-se em português.
>
> **PALCO:** olha para o Lucas. Lucas, dê-me lá uma pergunta sobre esta rede — «e se...?». Orçamento, uma freguesia, um modo de recolha — o que lhe passar pela cabeça.
>
> **PALCO:** escreve a pergunta tal como for dita; espera. Antes de calcular, o Novelo mostra o que entendeu — «Entendi: ...» — para confirmarmos que não foi atrás de outra coisa.
>
> **PALCO:** confirma; o otimizador corre. Quem calcula é o otimizador, o mesmo que fez os cenários todos. A inteligência artificial só traduz a pergunta e explica o resultado — e um verificador rejeita qualquer número que não tenha saído da conta. **A IA nunca faz contas.**
>
> **PALCO:** lê a resposta: a diferença em toneladas, euros por tonelada, custo. Adapta um comentário ao que saiu. É isto para a mesa de decisão: a pergunta muda, a resposta sai sempre em números comparáveis, com a fonte.

## 7. A conversa do orçamento — app `/scenarios` (9:30–11:00)

**PALCO:** comparação com a cadeia de orçamentos (20 · 40 · 60 · 90 · 150 mil €/ano). **Plano B:** falar sobre o A/B e a frase do intervalo.

> E a pergunta que toda a gestão faz: e se o orçamento for outro? Aqui está a cadeia inteira — vinte, quarenta, sessenta, noventa, cento e cinquenta mil euros por ano. Todos calculados, todos comparáveis.
>
> É a fronteira de decisão, sem opinião pelo meio: cada orçamento compra toneladas a um custo por tonelada que está aqui — e vê-se onde o euro extra começa a ficar caro. Quem propõe o orçamento da rede responde com esta curva; quem corta o orçamento, também.
>
> E como toda a estimativa tem intervalo: cada cenário traz o seu. Nos casos pessimistas, o aterro evitado não chega para pagar a operação — está no ecrã, está assumido, e é mais uma razão para o piloto medir.
>
> Uma nota de conformidade, senhor presidente: a diretiva pede uma rede que não se limite às zonas rendíveis. A ferramenta mostra a cobertura por tipo de território — e o nosso piloto começa precisamente pela freguesia rural que este orçamento deixa de fora.

## 8. O piloto: um dia de viatura — app cenário «Piloto» (11:00–12:30)

**PALCO:** cenário «Piloto · Aldão + Arosa e Castelões», criado na véspera. **Plano B:** cenário por freguesias de referência; captura.

> E isto desce ao concreto: é o vosso piloto, já calculado — **Aldão** e **Arosa e Castelões**, as freguesias que o próprio Novelo recomenda: um modo de recolha de cada tipo, máxima aprendizagem.
>
> **PALCO:** zoom a uma rota no mapa; aponta o selo «Por estrada». Isto é o plano do dia da viatura: sai do estaleiro da Polvoreira, ronda com as paragens nos locais, e volta. Quilómetros e traçado vêm das estradas reais.
>
> O motorista não navega pela app: um Android da viatura, três botões grandes, leitor de QR, offline — chega no piloto. A rota é o plano do dia.
>
> **PALCO:** plano de recolha filtrado a uma freguesia. A folha de serviço: dia fixo, ronda de 15 em 15 dias, quilos por ronda, quilómetros e horas por ano — pressupostos à vista e editáveis; o piloto troca-os por medidos.
>
> E uma regra, dita já: no piloto **paramos sempre**; com dados, a paragem vazia três rondas seguidas sai da rota — sempre anunciado, nunca em silêncio.

## 9. A prova: do saco ao fio — ao vivo 2 — app `/triage` → QR → Sankey → `/brands` (12:30–16:30)

**PALCO:** `/triage` com lote novo pronto; camisola à mão. **Plano B:** peça e etiqueta pré-fotografadas; ou a miniatura do lote.

> Uma rede destas ou se mede ou é opinião. O que vos mostro agora é a parte que mede — e começa no vosso problema do dia a dia: a contaminação na entrega.
>
> **PALCO:** fotografa a peça; depois a etiqueta. Uma fotografia na entrega, outra na etiqueta. O modelo sugere: tipo, estado, composição, marca.
>
> **PALCO:** a sugestão aparece. E o operador confirma ou corrige — a decisão é sempre humana; a fotografia é o instrumento de medição.
>
> **PALCO:** confirma; a peça entra no lote em curso `NOV-BXS4UW`. A peça acabou de entrar num lote.
>
> **PALCO:** pega no saco de demonstração com o QR colado e **passa-o ao presidente**. Senhor presidente, faça-me o favor de ler este QR com o seu telemóvel.
>
> **PALCO:** o passaporte abre no telemóvel dele; dá-lhe uns segundos. O que abriu agora é o **passaporte do lote**: origem, composição, peso e o histórico — recolhido, triado, reservado, entregue. É público, não precisa de conta, e responde à pergunta que todo o munícipe faz: «para onde foi a minha roupa?» Isto é a rede a prestar contas ao cidadão.
>
> **PALCO:** volta à app, ecrã inicial com o Sankey. E entretanto, o fio engrossou: cada peça triada alimenta o fluxo — freguesia, modo de recolha, resultado da triagem, destino. A rede deixa de ser uma promessa e passa a ser medição.
>
> **PALCO:** 30 segundos em `/brands`. E agrega — e aqui voltam as empresas, do lado de quem paga: quilos por marca e por composição. Em 2028, com a ecomodulação, quem vende moda rápida pode pagar mais — e Guimarães chega a essa conversa com **dados próprios**, não com médias europeias.
>
> E do lado de quem recicla: os lotes juntam-se por fibra numa bolsa que os recicladores consultam — é o material limpo e homogéneo que falta ao Vale do Ave.
>
> Como é que isto escala para as três mil toneladas? É a pergunta certa — e tem a sua resposta daqui a pouco, num slide. Primeiro, o resto da rede.

## 10. «Vai no saco?» — app `/bag-check` (16:30–17:00)

**PALCO:** fotografa a toalha velha. **Plano B:** captura no slide 4 (se o deploy não saiu).

> Uma resposta direta à vossa sugestão de 4 de novembro — a triagem começar em casa: o «Vai no saco?». O munícipe fotografa a peça e recebe um conselho numa frase: esta toalha, molhada, fica fora. Nada é guardado, ninguém é bloqueado — é um conselho, não uma portagem. Volto já à triagem.

## 11. A rede no terreno — e as empresas — app `/municipal` (17:00–18:30)

**PALCO:** separador candidatos; depois separador B2B. **Plano B:** capturas.

> Onde para a viatura? Em locais que já existem: 1 187 lugares públicos candidatos e 86 escolas, saídos do vosso pacote QGIS. E notem: **o candidato é o lugar, não é um contentor.** A paragem é um encontro anunciado — o saco entrega-se à mão, nunca fica na rua, à chuva. Nas escolas, o saco espera **dentro**.
>
> E no piloto a escolha é vossa: a Vitrus passa a fixar, excluir e acrescentar pontos na plataforma; há 350 lugares com coordenada aproximada, confirmam-se no terreno, convosco. Para a equipa: exportação GeoJSON num clique — o vosso QGIS entra aqui.
>
> **PALCO:** muda para o separador B2B (lares e hotelaria). E há têxtil que não vem das casas: os **lares e a hotelaria** da vossa rede — roupa de cama e toalhas, têxtil limpo, do mais alto valor de reutilização. É um canal à parte da rede aos habitantes, já contado do pacote municipal, freguesia a freguesia; as toneladas medem-se no piloto. É provavelmente a tonelada mais barata e mais limpa que esta rede consegue captar — e são as empresas a entregá-la à porta.

## 12. Relatório RAP — app `/reports` + PDF impresso (18:30–20:00)

**PALCO:** RAP pré-gerado; abre o PDF. **Plano B:** as 2 cópias impressas (presidente + Lucas).

> Tudo o que vimos desagua aqui: o relatório para a responsabilidade alargada do produtor, num clique. Custo por tonelada **por tipo de território** — urbano, médio, rural —, toneladas por fibra, evidência por marca com o tamanho da amostra, e método e fontes de cada número.
>
> É o dossiê com que a câmara se senta à mesa de 2028 — e a mesa muda: até abril de 2028, são os produtores, as empresas, a pagar o custo eficiente. Quem lá chegar com números próprios por tipo de território e por marca, chega em posição de força.
>
> **PALCO:** ergue as cópias impressas. E está impresso na pasta do senhor presidente e do Lucas — não depende do wi-fi.

## 13. A resposta sobre a triagem — slide 4 (20:00–21:30)

> Falta a resposta à vossa sugestão de 4 de novembro — a triagem passar a ser feita pelo munícipe, em casa. Analisámo-la a sério, linha a linha. A conclusão: **a direção está certa; a escala muda a letra.**
>
> Hoje são 301 toneladas — cerca de um milhão de peças por ano. O alvo são 3 003: **dez milhões de peças.** Peça a peça, seja quem for a fazê-la, não escala: com operadores, são 32 a 48 pessoas a tempo inteiro e 25 a 100 mil euros por ano de inteligência artificial — estimativas. E sem controlo nenhum à entrada, é o cenário que vocês conhecem: o canal sem triagem deu 56,9 por cento de rejeito — à escala do alvo, 1 709 toneladas por ano desperdiçadas.
>
> O que propomos não é uma decisão fechada — é o ponto de partida para **desenhar convosco**: dois sacos de cor no dia fixo; a verificação de dez segundos à porta; e a auditoria por amostragem com a triagem por fotografia que já está construída. Duas a três pessoas para o concelho inteiro, em vez de 32 a 48. Começa pelo mínimo — dois sacos e a porta — e o digital liga ao segundo mês.
>
> A matriz das sete abordagens e as camadas todas estão no anexo, se quiserem entrar nelas.

## 14. Os três pedidos — app `/pilot` + slides 5 e 6 (21:30–23:00)

**PALCO:** `/pilot` com as freguesias recomendadas; depois slide 5.

> O ecrã do piloto: Aldão e Arosa e Castelões, mais freguesias de controlo semelhantes; 8 a 12 semanas; e as métricas que decidem o escalonamento — participação, captura contra o controlo, conformidade, rejeito.
>
> **PALCO:** slide 5. Termino com os três pedidos.
>
> **Primeiro: o piloto.** Duas freguesias, três meses; propomos começar em janeiro.
>
> **Segundo: os dados que só a Vitrus tem.** Os euros por hora e por quilómetro das viaturas, que o financeiro ainda não enviou; os quilos mensais por entidade; o tempo de uma paragem; e o orçamento dos sacos. Com isto, os pressupostos saem e entram os vossos números.
>
> **Terceiro: a direção da triagem.** Aprovar a triagem partilhada em camadas, com arranque mínimo, e agendar a sessão de desenho — daqui a duas semanas.
>
> **PALCO:** slide 6; abranda. Deixo a frase com que comecei: **com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia 431 toneladas por ano do aterro, a 101,9 euros por tonelada — e o tratamento evitado paga a operação.** Estimativa — e é exatamente por isso que há um piloto a pedir.
>
> Obrigado, senhor presidente; obrigado, equipa. Fico para as vossas perguntas.

---

## Perguntas (slide 6 no ecrã)

As respostas de 20 segundos, tema a tema, estão no plano §6. Resumo dos gatilhos:

- **Contaminação / lixo no saco** → peso denuncia, recusa à porta com nota educativa, nunca se paga por quilo.
- **«Não são contentores ao ar livre?»** → o candidato é o lugar; encontro anunciado; o saco nunca fica na rua.
- **«E os lares e a hotelaria — quem trata disso?»** → canal à parte no piloto; os contactos são da Vitrus; as toneladas medem-se lá.
- **«Podemos escolher os pontos?»** → sim, no piloto, na plataforma.
- **«Quanto custa ao município?»** → 60 k€/ano: evitado 45 542 € paga a operação; líquido −1 628 €/ano no caso central; pessimista não chega — piloto.
- **«Como sabem que a triagem em camadas funciona?»** → não sabemos ao certo — por isso é piloto com métricas (conformidade ≥ 80%, rejeito ≤ 15%) e desenho com a operação; a matriz A–G está no anexo.
- **«E as entidades que hoje recolhem?»** → não substitui; camada de decisão e evidência; a bolsa liga-as.
- **«E o RGPD?»** → fotografias em memória; miniatura opcional sem metadados, 90 dias; marca é de empresa, não de pessoa.
- **Detalhe da triagem (camadas, auditoria, sacos)** → abrir o anexo A4/A5 e responder a partir dele.
- Não sabes → «boa pergunta; anoto e respondo com número». Bloco de notas ao lado.
