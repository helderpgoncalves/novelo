# Guião de ensaio — apresentação à Vitrus e à Câmara

A fala corrida, palavra a palavra, da apresentação de **12 de novembro de 2026** (25 min + perguntas, Flávio sozinho). Complementa o [plano completo](apresentacao-vitrus-camara.md), que tem as decisões, as perguntas esperadas e as checklists. A spec dos slides para construir o deck está em [Slides](apresentacao-vitrus-slides.md); o vídeo, em [Vídeo](apresentacao-vitrus-video.md).

**Como ensaiar:** ler em voz alta com cronómetro; as marcações «PALCO» são gestos e cliques; a fala adapta-se ao teu natural, mas **os números não se mudam nem se arredondam à sorte**. Alvo: 25:30. Três ensaios cronometrados (um com falha simulada, ver plano §9).

**Linha do tempo**

| Tempo | Bloco | Suporte | Ao vivo? |
| --- | --- | --- | --- |
| 0:00–1:30 | Abertura | slide 1 | — |
| 1:30–2:30 | O problema em 4 números | slide 2 | — |
| 2:30–3:30 | A mesma página, na app | app `/` | — |
| 3:30–4:00 | Ponte: o que está a funcionar | slide 3 | — |
| 4:00–6:30 | Cenários A/B | app `/scenarios` | — |
| 6:30–9:00 | «E se...?» | app cenário B | **ao vivo 1** |
| 9:00–12:00 | Um dia de viatura (piloto) | app cenário «Piloto» | — |
| 12:00–16:00 | Do saco ao fio | app `/triage` → QR → Sankey → `/brands` | **ao vivo 2** |
| 16:00–16:30 | «Vai no saco?» | app `/bag-check` | — |
| 16:30–18:00 | A rede no terreno | app `/municipal` | — |
| 18:00–19:30 | Relatório RAP | app `/reports` + PDF impresso | — |
| 19:30–24:00 | Triagem: escala, abordagens, proposta | slides 4–7 | — |
| 24:00–25:30 | Os três pedidos e fecho | app `/pilot` + slides 8–9 | — |
| — | Perguntas | slide 9 no ecrã | — |

**Antes de entrar na sala** (−5 min; detalhe no plano §4.0): login com password feito, hotspot do telemóvel ativo, camisola com etiqueta legível + toalha velha em cima da mesa, saco de demonstração com o QR do lote `NOV-BXS4UW` colado, separadores abertos por ordem, zoom testado no ecrã da sala.

**Regras de ouro** (plano §8): nunca procurar ecrã ao vivo; só dois momentos ao vivo; se falhar, a frase do plano B e segue-se, sem desculpas longas; «estimativa» diz-se sempre; não sabes — «boa pergunta, anoto e respondo com número»; um objetivo por ecrã, uma frase e aponta-se; o QR lê-se no telemóvel **do presidente**; falar **com** a Vitrus, não para o projetor.

---

## 1. Abertura — slide 1 (0:00–1:30)

> Bom dia, senhor presidente. Bom dia, Lucas, equipa da Vitrus. Obrigado por receberem o Novelo — e obrigado, já agora, pelos dados: sem os números que vocês nos abriram, nada do que vou mostrar existiria.
>
> Sou o Flávio Fernandes; o Hélder Gonçalves, que hoje não pôde estar, segue connosco à distância. Há três semanas, o Hack4Guimarães pôs uma pergunta: como desenhar a rede de recolha de têxteis de Guimarães ao menor custo. Ganhámos esse desafio — mas o prémio que interessa está aqui: uma ferramenta a funcionar, em produção, que responde em números à pergunta que vocês fizeram: **onde** recolher, **como**, e **a quanto fica** cada tonelada tirada do aterro.
>
> Nos próximos 25 minutos, a app é a apresentação — os slides servem só para duas coisas: uma decisão que vos quero propor sobre a triagem, e três pedidos. Começo pelo princípio: onde estamos.

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
> **PALCO:** aponta o mapa em meio-tom. O mapa mostra onde o têxtil se perde, freguesia a freguesia, sobre a vossa rede municipal — 2 751 contentores em 2 026 locais, o pacote que nos deram a 20 de outubro.
>
> **PALCO:** desce até à barra de confiança. E esta barra é a confiança dos dados: o que é medido, o que é estimado, o que falta. Quando o piloto correr, o «estimado» vai-se tornando «medido».

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
> Com 60 mil euros por ano, o B capta 431 toneladas a 101,9 euros por tonelada — estimativa. E o custo líquido: o aterro evitado, 45 542 euros, paga a operação — e sobra, por pouco: menos 1 628 euros por ano no caso central. Nos cenários pessimistas já não sobra — é mais uma razão para o piloto.
>
> **PALCO:** aponta a etiqueta «Por estrada». Uma nota de rigor: os quilómetros destas rotas não são linha reta — são medidos pelas estradas reais, com o OpenStreetMap, num servidor nosso, sem custos. Cada rota diz se é «por estrada» ou estimada.

## 6. «E se...?» — ao vivo 1 — app cenário B (6:30–9:00)

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

## 7. Um dia de viatura — app cenário «Piloto» (9:00–12:00)

**PALCO:** cenário «Piloto · Aldão + Arosa e Castelões», criado na véspera. **Plano B:** cenário por freguesias de referência; captura.

> E se isto descesse ao concreto? Isto é o vosso piloto, já calculado: **Aldão** e **Arosa e Castelões** — as duas freguesias que o próprio Novelo recomenda, porque juntas têm um modo de recolha de cada tipo e máxima aprendizagem. É também a única freguesia predominantemente rural que fica sem serviço nos 60 mil euros — com o piloto, deixa de ficar.
>
> **PALCO:** zoom a uma rota no mapa; aponta o selo «Por estrada». Isto é o plano do dia da viatura: sai do estaleiro da Polvoreira, faz a ronda com as paragens nos locais, e volta. Os quilómetros e o traçado vêm das estradas reais.
>
> E para quem pergunta «o motorista anda com quê?»: um Android da viatura — não o telemóvel pessoal de ninguém, 150 a 300 euros — com três botões grandes e leitor de QR, a funcionar offline. A rota é o plano do dia; **o motorista não navega pela app**. Isso chega no piloto.
>
> **PALCO:** plano de recolha filtrado a uma freguesia. Aqui está a folha de serviço: dia fixo, ronda de 15 em 15 dias, quilos por ronda, quilómetros e horas por ano — cada número com o pressuposto à vista e editável. É isto que o piloto calibra: troca-se pressuposto por medido.
>
> E uma regra simples, dita já: no piloto, **paramos sempre**. Com dados, a paragem sem sacos três rondas seguidas sai da rota — sempre anunciado, nunca em silêncio.

## 8. Do saco ao fio — ao vivo 2 — app `/triage` → QR → Sankey → `/brands` (12:00–16:00)

**PALCO:** `/triage` com lote novo pronto; camisola à mão. **Plano B:** peça e etiqueta pré-fotografadas; ou a miniatura do lote.

> Passo ao segundo momento ao vivo — e é o problema do dia a dia de vocês: a contaminação na entrega.
>
> **PALCO:** fotografa a peça; depois a etiqueta. Uma fotografia na entrega, outra na etiqueta. O modelo sugere: tipo, estado, composição, marca.
>
> **PALCO:** a sugestão aparece. E o operador confirma ou corrige — a decisão é sempre humana; a fotografia é o instrumento de medição, é o controlo de qualidade.
>
> **PALCO:** confirma; a peça entra no lote em curso `NOV-BXS4UW`. A peça acabou de entrar num lote.
>
> **PALCO:** pega no saco de demonstração com o QR colado e **passa-o ao presidente**. Senhor presidente, faça-me o favor de ler este QR com o seu telemóvel.
>
> **PALCO:** o passaporte abre no telemóvel dele; dá-lhe uns segundos. O que abriu agora é o **passaporte do lote**: origem, composição, peso e o histórico — recolhido, triado, reservado, entregue. É público, não precisa de conta, e responde à pergunta que todo o munícipe faz: «para onde foi a minha roupa?»
>
> **PALCO:** volta à app, ecrã inicial com o Sankey. E entretanto, o fio engrossou: cada peça triada alimenta o fluxo — freguesia, modo de recolha, resultado da triagem, destino. A rede deixa de ser uma promessa e passa a ser medição.
>
> **PALCO:** 20 segundos em `/brands`. E agrega: quilos por marca e por composição. Em 2028, com a ecomodulação, quem vende moda rápida pode pagar mais — e Guimarães chega a essa conversa com **dados próprios**, não com médias europeias.

## 9. «Vai no saco?» — app `/bag-check` (16:00–16:30)

**PALCO:** fotografa a toalha velha. **Plano B:** captura no slide 6 (se o deploy não saiu).

> Uma resposta direta à vossa sugestão de 4 de novembro — a triagem começar em casa: o «Vai no saco?». O munícipe fotografa a peça e recebe um conselho numa frase: esta toalha, molhada, fica fora. Nada é guardado, ninguém é bloqueado — é um conselho, não uma portagem. E volto à triagem já a seguir, porque a intenção de vocês tem consequências de escala.

## 10. A rede no terreno — app `/municipal` (16:30–18:00)

**PALCO:** separador candidatos. **Plano B:** captura.

> Onde é que a viatura para? Em locais que já existem: 1 187 lugares públicos candidatos e 86 escolas, saídos do vosso pacote QGIS. E notem: **o candidato é o lugar, não é um contentor.** A paragem é um encontro anunciado — o saco entrega-se à mão, nunca fica na rua, à chuva.
>
> Nas escolas, o saco espera **dentro** — acumulador coberto, continuação da campanha escolar que já existe.
>
> E no piloto a escolha é vossa: a Vitrus passa a fixar, excluir e acrescentar pontos na plataforma. Há 350 lugares com coordenada aproximada — confirmam-se no terreno, convosco. E para a equipa técnica: exportação GeoJSON num clique — o vosso QGIS entra aqui.

## 11. Relatório RAP — app `/reports` + PDF impresso (18:00–19:30)

**PALCO:** RAP pré-gerado; abre o PDF. **Plano B:** as 2 cópias impressas (presidente + Lucas).

> Tudo o que vimos desagua aqui: o relatório para a responsabilidade alargada do produtor, num clique. Custo por tonelada **por tipo de território** — urbano, médio, rural —, toneladas por fibra, evidência por marca com o tamanho da amostra, e método e fontes de cada número.
>
> É o dossiê com que a câmara se senta à mesa de 2028.
>
> **PALCO:** ergue as cópias impressas. E está impresso na pasta do senhor presidente e do Lucas — não depende do wi-fi.

## 12. Triagem: a escala muda tudo — slide 4 (19:30–20:45)

> Volto à vossa sugestão de 4 de novembro, porque a levámos a sério — está analisada linha a linha. A intuição está certa na direção: a triagem tem de começar antes de o saco chegar à vossa mão. Mas levada à letra — o cidadão a triar peça a peça, em casa — destrói o que a rede existe para proteger. Vejam a escala:
>
> Hoje recolhem-se 301 toneladas — cerca de um milhão de peças por ano. O alvo são 3 003 toneladas: **dez milhões de peças por ano.** A triagem peça a peça, a 20 a 30 segundos cada, dá 55 a 83 mil horas por ano — entre 32 e 48 pessoas a tempo inteiro, mais 25 a 100 mil euros por ano só de inteligência artificial. Estimativas, mas a ordem de grandeza não muda.
>
> E o outro extremo também não serve: o canal que hoje chega sem controlo — os contentores escolares — deu **56,9 por cento de rejeito**. À escala do alvo, seria desperdiçar 1 709 toneladas por ano do material que a rede existe para salvar.
>
> Nem peça a peça, nem sem controlo. A pergunta certa é outra: a que granularidade é que cada decisão tem de ser tomada.

## 13. As sete abordagens — slide 5 (20:45–21:55)

> Olhámos a tudo o que existe — na Europa e na literatura — e pusemos em linha sete abordagens.
>
> **PALCO:** percorre a matriz, rápida. A atual, peça a peça: não escala — 32 a 48 pessoas. O cidadão peça a peça em casa: a participação morre — duas fotografias por peça, dezenas de peças por saco. A declaração sem verificação: reproduz os 56,9 por cento — ensina a **declarar** bem, não a **separar** bem. Externalizar nos licenciados: é o hoje — e o município fica sem dados próprios para 2028. Os pontos comunitários são um complemento de educação, não um processo.
>
> **PALCO:** para na linha D. A que recomendamos é esta: **triagem partilhada em camadas** — e a variante mínima ao lado, para começar. Nenhum sistema conhecido pede ao cidadão a triagem por peça: os que funcionam fazem separação simples em fluxos, um momento de controlo com pessoas, e medição por amostragem.

## 14. A proposta — slide 6 (21:55–23:20)

> A proposta desenha-se em cinco camadas.
>
> **Primeira: dois sacos de cor**, no dia fixo da freguesia — «vestir de novo» e «deu a vida» — com a regra de três perguntas impressa no saco. Nunca peça a peça; dois é o número. E o saco vem da Vitrus, porque o saco é o instrumento: a cor é o sinal, o QR vem impresso, e a entrega do saco é a própria campanha.
>
> **Segunda: declaração opcional**, 30 segundos pelo QR. Sem app, tudo funciona na mesma — a rede física é o serviço.
>
> **Terceira: a porta.** O motorista espreita dez segundos: conforme, em dúvida, recusado. É o controlo da contaminação, embutido numa paragem que já acontece.
>
> **Quarta: auditoria por amostragem** — cerca de 20 por cento dos sacos no início, com a triagem por fotografia que já está construída. 385 sacos por trimestre dão mais ou menos 5 pontos percentuais com 95 por cento de confiança — evidência auditável, a preço de estatística.
>
> **Quinta: o resultado volta ao cidadão** — mensagem educativa, nunca multa.
>
> A conta: **2 a 3 pessoas para o concelho inteiro**, contra 32 a 48. Os sacos custam 50 a 200 mil euros por ano no pico — e as 3 003 toneladas evitam **317 269 euros** de aterro por ano: o custo evitado paga os sacos, e é dinheiro já gasto hoje. E o arranque pode ser mínimo: dois sacos e a verificação à porta; o digital liga ao segundo mês.

## 15. Desenhemos juntos — slide 7 (23:20–24:00)

> E aqui pára a nossa parte de desenhadores. Isto não se decide hoje, numa sala: desenha-se convosco, com quem recusa sacos à porta.
>
> Propomos uma **sessão de desenho com a operação** — os sacos, o dia fixo, a recusa, a auditoria no depósito — e depois é o piloto que decide, com números: participação, conformidade acima de 80 por cento, rejeito do saco verde abaixo de 15.
>
> O hackathon deu a pergunta; a solução desenha-se com quem a opera.

## 16. Os três pedidos — app `/pilot` + slides 8 e 9 (24:00–25:30)

**PALCO:** `/pilot` com as freguesias recomendadas; depois slide 8.

> O ecrã do piloto: Aldão e Arosa e Castelões, mais freguesias de controlo semelhantes; 8 a 12 semanas; e as métricas que decidem o escalonamento — participação, captura contra o controlo, conformidade, rejeito.
>
> **PALCO:** slide 8. Termino com os três pedidos.
>
> **Primeiro: o piloto.** Duas freguesias, três meses; propomos começar em janeiro.
>
> **Segundo: os dados que só a Vitrus tem.** Os euros por hora e por quilómetro das viaturas, que o financeiro ainda não enviou; os quilos mensais por entidade; o tempo de uma paragem; e o orçamento dos sacos. Com isto, os pressupostos saem e entram os vossos números.
>
> **Terceiro: a direção da triagem.** Aprovar a triagem partilhada em camadas, com arranque mínimo, e agendar a sessão de desenho — daqui a duas semanas.
>
> **PALCO:** slide 9; abranda. Deixo a frase com que comecei: **com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia 431 toneladas por ano do aterro, a 101,9 euros por tonelada — e o tratamento evitado paga a operação.** Estimativa — e é exatamente por isso que há um piloto a pedir.
>
> Obrigado, senhor presidente; obrigado, equipa. Fico para as vossas perguntas.

---

## Perguntas (slide 9 no ecrã)

As respostas de 20 segundos, tema a tema, estão no plano §6. Resumo dos gatilhos:

- **Contaminação / lixo no saco** → peso denuncia, recusa à porta com nota educativa, nunca se paga por quilo.
- **«Não são contentores ao ar livre?»** → o candidato é o lugar; encontro anunciado; o saco nunca fica na rua.
- **«Podemos escolher os pontos?»** → sim, no piloto, na plataforma.
- **«Quanto custa ao município?»** → 60 k€/ano: evitado 45 542 € paga a operação; líquido −1 628 €/ano no caso central; pessimista não chega — piloto.
- **«E as entidades que hoje recolhem?»** → não substitui; camada de decisão e evidência; a bolsa liga-as.
- **«E o RGPD?»** → fotografias em memória; miniatura opcional sem metadados, 90 dias; marca é de empresa, não de pessoa.
- Não sabes → «boa pergunta; anoto e respondo com número». Bloco de notas ao lado.
