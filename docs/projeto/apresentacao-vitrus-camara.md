# Apresentação à Vitrus e à Câmara — plano completo

Apresentação **amanha, 12 de novembro de 2026**, à **Vitrus** (equipa operacional, com o Lucas) e ao **presidente da Câmara de Guimarães**, **na mesma sala, na mesma sessão**. Quem apresenta: **Flávio, sozinho** (o Hélder não pode estar; fica alinhado por mensagem). Duração alvo: **25 minutos + perguntas**.

Não é o pitch do júri: ganhámos o hackathon com os dados da Vitrus; agora o objetivo é **abrir a porta** — sair da sala com os dados encaminhados, a sessão com a operação marcada e a Vitrus a saber exatamente o que somos: quem construiu a plataforma, mantém-na e desenha a rede com eles (consultoria e solução tecnológica). **O piloto deixa de ser pedido** (11 nov, Hélder): plantam-no o cenário «Duas freguesias» e o ecrã `/pilot`; se a Vitrus o propor, aceita-se na hora. Guião do hackathon (herdado com cortes): [pitch](pitch.md), [demo e entrega](../engenharia/demo-e-entrega.md), [seed de demonstração](../engenharia/seed-demo.md).

Complementos deste plano: o [guião de ensaio](apresentacao-vitrus-guiao.md) (fala corrida, palavra a palavra, com tempos e marcações de palco), a [especificação do deck](apresentacao-vitrus-slides.md) (autocontida, para construir o PowerPoint) e o [plano do vídeo](apresentacao-vitrus-video.md) (adaptação do Remotion à sessão).

## 1. Decisões já fechadas (não reabrir)

| # | Decisão | Valor |
| --- | --- | --- |
| D1 | Formato | Uma sessão conjunta (~30 min com perguntas); momentos do presidente **nos primeiros 15 min** (um presidente sai primeiro) |
| D2 | Quem apresenta | Flávio, sozinho: conduz os slides e a app; **máximo 2 momentos ao vivo** («E se...?» e triagem+QR); todo o resto pré-aberto e pré-calculado |
| D3 | Triagem | **Um slide de resposta** à sugestão de 4 nov (a direção está certa; a escala muda a letra; arranque mínimo) — a matriz A–G e as cinco camadas ficam em **anexo**, só se abrem se perguntarem. Nunca «decisão fechada»: é proposta para **desenhar juntos** (issue #21). Revisto a 11 nov: gestão primeiro, operacional como convite |
| D4 | Motorista | Compromisso de **piloto** (sem wireframe): um **Android da viatura** (150–300 €/van, não o telemóvel pessoal), 3 botões + QR, offline. A rota é o **plano do dia**; o motorista **não navega** pela app |
| D5 | Escolas/pontos assistidos | **Acumulador coberto**: os sacos esperam dentro (continuação da campanha escolar que já existe), recolha no dia anunciado, lote abre no momento. A escola **não tem ecrã no piloto** (telefone/WhatsApp; link de 1 toque fica para depois) |
| D6 | Paragens vazias | No piloto **paramos sempre**; com dados, a paragem sai da rota depois de **3 rondas consecutivas vazias** — **regra anunciada, nunca em silêncio** |
| D7 | «Vai no saco?» | Ao vivo **só se** o deploy do PR #20 sair hoje com verificação (ver checklist); senão captura nos slides. Conselho, nunca bloqueio; nada guardado |
| D8 | Cenário «Duas freguesias» | Criado na véspera em produção, com as freguesias recomendadas: **Aldão** e **União das freguesias de Arosa e Castelões** (as do ecrã `/pilot`). Etiqueta **sem a palavra «piloto»** («Duas freguesias · Aldão + Arosa e Castelões»): a ideia planta-se, o pedido não se faz |
| D9 | Pontos editáveis | Dizer que **no piloto a Vitrus passa a fixar/excluir/acrescentar pontos** na plataforma (hoje só por freguesia e tipo) — criar o issue para ter número |
| D10 | One-pager | Folha A4 (âncora, 4 números, **o que se segue**, fontes) para ficar na pasta do presidente |

Faltam fechar com o **Hélder, por mensagem, hoje** (issue #21): arranque em E, taxa de auditoria inicial (20%), evidência RAP amostral. Uma voz só na sala.

## 2. A mensagem e o que se segue

**Frase-âncora** (dizer duas vezes: no bloco do problema e no fecho):

> "Com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia **431,1 t por ano** do aterro a **101,9 € por tonelada**, e os 45 542 € de tratamento evitado pagam a operação." Estimativa (registo H3, H10).

**O que se segue** (o fecho; sem pedidos à descarada — 11 nov, Hélder):

1. **Fechar os dados que só a Vitrus tem**: custos por hora e por km das viaturas (o financeiro ainda não os enviou), kg mensais por entidade, tempo e custo de uma paragem, orçamento dos sacos. É meio dia de trabalho deles; a plataforma afina-se toda.
2. **Sessão com a operação** (dentro de duas semanas): a triagem e a rede desenham-se com quem as faz; a análise está na mesa (anexos A4–A5), falta a leitura deles. Inclui, quando houver rede: validação dos pontos no terreno (350 de 1 187 têm coordenada aproximada), **edição dos pontos pela Vitrus** na plataforma (D9) e a regra das paragens vazias (D6).

E declara-se o que somos: **consultoria e solução tecnológica** — a plataforma fica; mantemos, desenvolvemos e desenhamos a rede com a Vitrus. O piloto de 2 freguesias (Aldão + Arosa e Castelões, métricas do issue #21) **não se pede**: plantam-no o cenário «Duas freguesias» e o ecrã `/pilot`; se o propuserem, aceita-se na hora e liga-se ao plano de 48 h.

## 3. Estrutura e tempos (~23 min estruturados + folga dos momentos ao vivo ≈ 25; sozinho)

Revista a 11 nov: **a gestão é a espinha dorsal** (o que cada decisão custa, rende e arrisca); a operação entra como convite para desenhar junto. O QR no telemóvel do presidente calha aos ~14:30, dentro da janela em que ele está na sala.

| Bloco | Tempo | Suporte | Objetivo em uma frase |
| --- | --- | --- | --- |
| 0. Pronto antes de começar | −5 min | app (separadores abertos) | Nunca procurar ecrã ao vivo |
| 1. Abertura | 0:00–1:30 | slide 1 | Quem somos; gestão em números; no fim, o que se segue |
| 2. O problema em 4 números | 1:30–3:30 | slide 2 + app `/` | O problema em números deles, com selo medido/estimativa e comando de orçamento |
| 3. Ponte | 3:30–4:00 | slide 3 | A app é a apresentação |
| 4. Cenários A/B | 4:00–6:30 | app `/scenarios` | Mesma pergunta, dois desenhos, números comparáveis; custo líquido |
| 5. «E se...?» **[ao vivo 1]** | 6:30–9:30 | app cenário B | A ferramenta responde à pergunta **deles**, na hora |
| 6. A conversa do orçamento | 9:30–11:00 | app `/scenarios` (cadeia 20–150 k€) | O que cada orçamento compra; intervalos («nos pessimistas não chega»); cobertura da diretiva numa frase |
| 7. Duas freguesias: um dia de viatura | 11:00–12:30 | app cenário «Duas freguesias» | A rede ao concreto, sem ser pedido; motorista não navega |
| 8. A prova: do saco ao fio **[ao vivo 2]** | 12:30–16:30 | app `/triage` → QR → Sankey → `/brands` | Medição e evidência; o QR abre no telemóvel do presidente (~14:30); marcas = quem paga em 2028; bolsa = indústria |
| 9. «Vai no saco?» | 16:30–17:00 | app `/bag-check` (ou captura) | A resposta visual à sugestão deles de 4 nov |
| 10. Rede no terreno — e as empresas | 17:00–18:30 | app `/municipal` (+ separador B2B) | O candidato é o lugar; nenhum saco na rua; a escolha é deles; canal B2B de lares e hotelaria |
| 11. Relatório RAP | 18:30–20:00 | app `/reports` + PDF impresso | O dossiê de 2028 num clique; em 2028 são os produtores a pagar |
| 12. A resposta sobre a triagem | 20:00–21:30 | slide 4 | Direção certa; a escala muda a letra; desenhamos juntos (A–G e camadas em anexo) |
| 13. O que se segue | 21:30–23:00 | slides 5–6 | Fechar os dados; sessão com a operação; a plataforma fica — e ouvir |
| Perguntas | — | slide 6 no ecrã | Quem responde o quê: tudo tu (ver §8) |

## 4. Fluxo na aplicação, clique a clique

**Os tempos e a fala corrida de cada passo estão no [guião de ensaio](apresentacao-vitrus-guiao.md)** (revisto a 11 nov, gestão primeiro: bloco novo de orçamentos, B2B no `/municipal`, triagem num slide). As tabelas abaixo mantêm os planos B por passo — esses não mudaram.

Regra geral: **um objetivo por ecrã; diz-se uma frase e aponta-se; não se lê o ecrã em voz alta.** Se algo falhar ao vivo, usa-se a frase da coluna Plano B e segue-se.

### 0. Pronto antes de começar (5 min antes de entrar na sala)

- Login feito (conta com password, **não magic link**); telemóvel com hotspot ativado como rede de reserva; peça de ensaio (camisola com etiqueta legível) e toalha velha em cima da mesa; saco de demonstração com o **QR do lote `NOV-BXS4UW` impresso e colado**.
- Separadores abertos por ordem (app em produção): `/` (home) · `/scenarios` (comparação A/B pronta) · comparação da cadeia de orçamentos (20–150 k€) · cenário B com «E se...?» visível · cenário «Duas freguesias» (rotas + plano de recolha) · `/triage` (novo lote pronto a abrir) · `/municipal` (separadores candidatos e B2B) · `/reports` (RAP pré-gerado) · `/bag-check` (se deploy saiu).
- Resolução/zoom do portátil testada no projetor/TV da sala.

### 1–2. Home: o problema em 4 números (app, 3 min)

| Passo | O que se clica/mostra | O que se diz (essencial) | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | Faixa de situação no topo de `/` | "301,3 t recolhidas em 2025 — **medido**, são os vossos dados. 9 em cada 10 kg ainda vão para o lixo." | Partir dos números **deles** | Captura no slide 2 |
| 2 | Apontar 3 003,3 t por captar + selo «estimativa» | "3 003 t por desviar — **estimativa**: 5,86% do indiferenciado, base da APA que nos indicaram." | Dizer «estimativa» em voz alta: credibilidade | — |
| 3 | Dias até 17 abr 2028 | "Em 2028 a fatura muda de dono. Quem souber o seu custo por tonelada defende o seu número." | O relógio da diretiva | — |
| 4 | Barra de confiança dos dados (rodapé) | "Distinguimos o medido do estimado em todo o lado." | Rigor como argumento | — |

Dizer a **frase-âncora** uma vez, devagar, e avançar.

### 3. Cenários A/B (app, 3 min)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | `/scenarios` → comparação A/B (pré-aberta) | "A mesma pergunta, dois desenhos de rede. A: contentores em todo o lado — o modelo que a Vitrus não quer. B: sem um único contentor." | O contraste que fundamenta a rede sem contentores | Capturas no portátil (sem slide; abre-se o compare em cache) |
| 2 | Pausa 3 s no €/t de cada um | (deixa o ecrã falar) | — | — |
| 3 | Apontar custo líquido de B (−1 628 €/ano) e evitado (45 542 €) | "No caso central, o aterro evitado paga a operação. **Estimativa** — e é por isso que há números a fechar." | O € para o presidente | — |
| 4 | Etiqueta «Por estrada» na rota | "Os km vêm das estradas reais, OpenStreetMap, servidor nosso — não linhas retas." | Rigor do modelo | — |

### 4. «E se...?» — ao vivo 1 (app, 2,5 min)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | Separador do cenário B, campo «E se...?» | Olhar para o Lucas: "Dêem-me uma pergunta em português." | A sala entra na demo | Pergunta de reserva (ver §9) |
| 2 | Escrever a pergunta tal como dita | "Entendi: ..." aparece primeiro | Confirmar antes de calcular | — |
| 3 | Confirmar → correr otimizador | "Quem calcula é o otimizador; a IA nunca faz contas. A diferença sai explicada em números." | **O momento de confiança** | Se falhar: "respondo com o cenário em cache" (uma das 3 de reserva do seed) |

### 5. Duas freguesias: um dia de viatura (app cenário «Duas freguesias», 3 min)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | Abrir cenário «Duas freguesias · Aldão + Arosa e Castelões» | "A ferramenta desenha a rede à escala que se quiser — duas freguesias, as que o modelo aponta para começar." | A ideia de arranque fica tangível, **sem ser pedido** | O cenário por freguesias de referência |
| 2 | Zoom a uma rota no mapa; selo «Por estrada» | "É o **plano do dia** da viatura: sai de Polvoreira, recolhe os sacos, volta. O motorista **não navega pela app** — o ecrã dele chega com a rede, não no primeiro dia." | Dizer D4 em voz alta | Captura |
| 3 | Plano de recolha filtrado a uma freguesia | "Dia fixo, ronda de 15 em 15 dias, tantos kg por ronda, tantos km e horas por ano. Tudo pressuposto com fonte, editável — a recolha real calibra." | A folha de serviço da viatura | — |
| 4 | (sem clique) | "A começar paramos sempre; com dados, a paragem vazia sai da rota — 3 rondas vazias, sempre anunciado." | D6 dita em uma frase | — |

### 6. Do saco ao fio — ao vivo 2 (app, 4 min)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | `/triage`: fotografar a camisola + etiqueta; aparecer a sugestão; confirmar | "Foto na entrega, o modelo sugere, o operador confirma. É o controlo de qualidade — o problema de vocês é a contaminação." | A triagem tal como existe (base do bloco 10) | Peça/etiqueta pré-fotografadas; ou miniatura do lote |
| 2 | Peça entra no lote; pegar no saco e **passá-lo ao presidente** | "Leia o QR com o seu telemóvel." | **O momento da apresentação**: o passaporte abre no telemóvel dele | QR testado de manhã; se falhar, abrir `/pt/passport/NOV-BXS4UW` no portátil |
| 3 | Voltar a `/` (Sankey) | "O fio engrossou em direto — cada peça alimenta o fluxo, as marcas e a evidência RAP." | O sistema inteiro num gesto | — |
| 4 | `/brands`, 20 s | "Quilos por marca e composição: a base do «quem polui, paga» de 2028." | Ecomodulação em 1 frase | — |

### 7. «Vai no saco?» (30 s; só se D7 = ao vivo)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | `/bag-check`, fotografar a **toalha velha** | "O munícipe em casa fotografa a peça e recebe um conselho: esta fica fora — molhada. Nada guardado, ninguém bloqueado." | A resposta à sugestão deles de 4 nov | Captura no slide 4 |

### 8. Rede no terreno (app `/municipal`, 1,5 min)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | Separador candidatos (1 187 públicos + 86 escolas) | "O candidato é o **lugar**: camião já passa, licença já existe, o munícipe já lá vai. **Nenhum saco fica na rua**: a paragem é um encontro anunciado, o saco entrega-se à mão." | Desarmar a objeção dos contentores ao ar livre | Captura |
| 2 | Apontar «Lugar possível, não recomendado: a validar com a Vitrus» | "Nas escolas, o saco espera **dentro**. E quando houver rede, **vocês** escolhem: fixar, excluir, acrescentar pontos." | D5 + D9 | — |
| 3 | (sem clique) | "Exportação GeoJSON a um clique — o vosso QGIS entra aqui." | Ponte para a equipa técnica | — |

### 9. Relatório RAP (app `/reports`, 1,5 min)

| Passo | Clica/mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | RAP pré-gerado (abrir o PDF) | "Custo por tipo de território, toneladas por fibra, evidência por marca com tamanho de amostra, método e fontes. O dossiê de 2028, num clique." | O entregável institucional | **PDF impresso na pasta** (2 cópias: presidente + Lucas) |

### 10. Triagem: a resposta num slide (1,5 min) — ver §5

Sem app. Slide 4 (fala no [guião](apresentacao-vitrus-guiao.md), bloco 13): a direção de 4 nov está certa; a escala muda a letra; a proposta para desenhar juntos. A matriz A–G e as cinco camadas ficam nos anexos A4–A5.

### 11. O que se segue (slides 5–6, 1,5 min; sem app)

| Passo | Mostra | Diz-se | Objetivo | Plano B |
| --- | --- | --- | --- | --- |
| 1 | Slide 5 | Fechar os dados (a lista); sessão com a operação dentro de duas semanas; e a plataforma fica — mantemos, desenvolvemos e desenhamos a rede com eles. **Nenhum pedido de piloto.** | Porta aberta; se eles propuserem, aceitar na hora | — |
| 2 | Slide 6 | A frase-âncora, outra vez. Obrigado. "E agora quero ouvir-vos — tenho duas perguntas a fazer-vos." | Fecho que abre a conversa (perguntas nossas primeiro, guião) | — |

## 5. PPT — plano de slides (6 + 5 anexos)

A spec completa, **autocontida** para construir o deck (textos exatos, cores, fontes, rodapés, notas do orador, números canónicos), está em [Slides](apresentacao-vitrus-slides.md) — é esse ficheiro que se dá a quem construir o PPTX. Princípio: **a gestão é a espinha dorsal; a triagem é um slide de resposta + anexos** (revisto a 11 nov — antes eram 4 slides de triagem). Construir sobre a infraestrutura do hackathon (`pitch/build.js`) ou Google Slides (fallback). Uma ideia por slide; título que diz a conclusão; fontes no rodapé; números iguais aos do ecrã e do one-pager.

| # | Título (conclusão) | Momento |
| --- | --- | --- |
| 1 | Novelo · do saco ao fio | Abertura |
| 2 | 9 em cada 10 kg de têxtil ainda vão para o lixo | Problema |
| 3 | O que está a funcionar — e vamos ver ao vivo | Ponte para a app |
| 4 | A direção de 4 de novembro está certa; a escala muda a letra | A resposta sobre a triagem |
| 5 | O que se segue | Fecho |
| 6 | Obrigado (frase-âncora + QR) | Perguntas |
| A1–A5 | Cobertura da diretiva · onde o têxtil se perde · pressupostos · matriz A–G · as cinco camadas | Só abrir se houver pergunta |

**Se não houver tempo de gerar o PPTX**: os slides 1–9 funcionam no Google Slides com: fundo linho `#F4F1EA`, texto tinta `#14211D`, títulos Newsreader, corpo Inter, floresta `#2E6B57` como acento, areia `#C4A06A` como detalhe.

## 6. Perguntas esperadas (respostas de 20 s)

Adaptadas das [perguntas do júri](perguntas-do-juri.md).

**Da Vitrus:**

- **"O munícipe não vai pôr lixo no saco?"** — O peso denuncia (peso vs declaração sobe a auditoria), o motorista recusa à porta com nota educativa padrão, e nunca pagamos por kg nem por peça. Os 56,9% de rejeito vieram do canal sem controlo; a porta é o controlo.
- **"Os locais públicos são contentores ao ar livre? O saco não fica na chuva?"** — O candidato é o lugar, não o contentor. A paragem é um **encontro anunciado**: o saco entrega-se à mão, nunca fica exposto. Quem não puder estar à hora, guarda o saco para a ronda seguinte ou leva-o a um ponto assistido, onde espera **dentro**. A recolha mede paragem a paragem o que funciona.
- **"Podemos ser nós a escolher os pontos?"** — Sim, é esse o caminho: hoje restringe-se por freguesia e tipo; quando houver rede, a Vitrus fixa, exclui e acrescenta pontos na plataforma; os 350 de coordenada aproximada confirmam-se no terreno.
- **"Como sabem que a escola tem sacos?"** — A viatura para sempre no dia anunciado e a escola avisa por telefone como hoje; o sinal digital (1 toque) vem depois e serve para **prever**, nunca para autorizar. Com dados, paragem vazia (3 rondas seguidas) sai da rota — sempre anunciado.
- **"O motorista anda com telemóvel?"** — Um Android da viatura (um por viatura, 150–300 €, não o pessoal de ninguém), 3 botões grandes e QR, a funcionar offline. A rota é o plano do dia; ele não navega pela app.
- **"E se o munícipe não puser o saco no dia?"** — Guarda-o para a ronda seguinte (dia fixo, de 15 em 15 dias) ou leva-o ao ponto assistido. Sem marcação, sem app.
- **"De 15 em 15 dias não é pouco (ou muito)?"** — Pressuposto editável, com sensibilidade; a recolha real calibra o intervalo com número, não com opinião.
- **"Que viatura e quanto custa?"** — Furgoneta de caixa fechada sem compactação, 42 500 € (concurso de Gaia, pressuposto); os €/h e €/km são um dos pedidos.
- **"Isto substitui a Sarah, a Ultriplo, a Nova Etapa?"** — Não; elas continuam a triar profissionalmente. O Novelo é a camada de decisão e evidência, e a bolsa liga-as ao material por fibra.
- **"Fotos, marcas, RGPD?"** — A foto vive em memória durante o pedido; a miniatura é opcional, sem metadados, apagada aos 90 dias; a marca é de uma empresa, nunca de uma pessoa.
- **"Quanto custa a IA?"** — Cêntimos por peça, orçamento mensal com teto; sem chave de IA o resto funciona.
- **"E a To-Be-Green?"** — Complementar: eles, o cidadão e a reutilização; o Novelo, quem opera a recolha.
- **"Quem mantém isto?"** — Nós — é mesmo a oferta: mantemos e desenvolvemos; a seguir, contratação pública, sabemos o caminho e faz parte do plano.

**Do presidente:**

- **"Quanto custa ao município?"** — No cenário de 60 000 €/ano, o aterro evitado (45 542 €) paga a operação: custo líquido −1 628 €/ano no caso central. Estimativa; nos casos pessimistas não chega — por isso há números a fechar e rede a medir.
- **"O que ganha o cidadão?"** — Saco grátis, dia fixo, e resposta: o passaporte diz para onde foi a roupa e quanto a freguesia desviou. Sem app obrigatória.
- **"O que muda em 2028?"** — Os produtores pagam o custo eficiente, determinado com as autoridades locais; Guimarães chega a essa mesa com números próprios por tipo de território e por marca.
- **"Emprego e economia social?"** — Os lotes por fibra ligam ao tecido do Vale do Ave; as entidades que hoje recolhem 301 t continuam e ganham mais material e evidência.
- **"Funciona noutros concelhos?"** — Sim: INE, OSM e CAOP são de todos; faltam os custos locais. Guimarães seria o primeiro.

## 7. O que não mostrar (a menos que perguntem)

Copiloto `/chat` (1 min máx, se houver tempo e saldo de IA) · `/admin/ai`, `/users`, `/data-quality`, `/validation`, `/fleet` · incerteza/tornado e Monte Carlo («cada cenário traz o intervalo», sem abrir) · bolsa de fibra (1 frase, sem ecrã).

## 8. Regras de ouro (a solo)

1. **Nunca procurar ecrã ao vivo** — tudo pré-aberto em separadores por ordem.
2. **Só 2 momentos ao vivo** («E se...?» e triagem+QR); todo o resto é «mostrar o que já está».
3. Se algo falhar: a frase do plano B da tabela, sem desculpas longas, e segue-se.
4. Nenhum número no ecrã sem explicação de uma frase; «estimativa» diz-se sempre.
5. Não sabes? — "Boa pergunta; anoto e respondo com número." (Bloco de notas ao lado.)
6. Um objetivo por ecrã; uma frase e aponta-se; não se lê o ecrã.
7. O QR lê-se **no telemóvel do presidente**, com o saco na mão dele — não no teu.
8. Falar **com** a Vitrus (o Lucas), não **para** o projetor: a app é o pretexto, a conversa é o objetivo.
9. **Postura**: a ferramenta ajuda a decidir, não decide por eles. Nas perguntas, ouvir mais do que dizer — e se houver silêncio, abrem as nossas duas perguntas a eles (guião, secção Perguntas).

## 9. Checklist — HOJE (11 de novembro)

Por ordem; as horas são orientativas mas a sequência não é.

- [ ] **14h00 · Deploy «Vai no saco?» (go/no-go)**: PR #20 já existe. `git checkout feat/pre-collection-bag-check && just check`; verde → `gh pr merge 20` → Coolify faz deploy → **verificar em produção**: `/bag-check` abre, foto → veredicto, **e a triagem de entrega continua a funcionar** (o PR mexe em código partilhado). **No-go se**: check vermelho, deploy depois das 18h, ou qualquer coisa estranha → capturas de ecrã da stack local (`just dev` na branch) para o slide 4.
- [ ] **15h00 · Cenário «Duas freguesias» em produção**: `/simulator` → restrição às freguesias **Aldão** e **Arosa e Castelões** (as recomendadas em `/pilot`), modos `on_demand` + `existing`, orçamento a ajustar até abrir serviço (começar por 15–30 k€/ano), etiqueta **«Duas freguesias · Aldão + Arosa e Castelões»** (sem a palavra «piloto» no ecrã). Confirmar rotas «Por estrada» e o plano de recolha preenchido.
- [ ] **16h00 · PPT** ✅ feito a 11 nov, 12h48: `pitch/out/novelo-vitrus-camara.pptx` (+ `.pdf`), 6 diapositivos + 5 anexos com as notas do orador preenchidas, gerado por `pitch/build-vitrus.js` (tema do hackathon, sem a skill de pptx). Falta: validar visualmente, ajustar se preciso e copiar para o portátil (as fontes Newsreader e Inter já estão instaladas nesta máquina; noutro PC, instalar ou abrir no Google Slides).
- [ ] **16h30 · One-pager A4** (D10): âncora, 4 números, **o que se segue** (dados · sessão · plataforma fica), fontes; fundo linho, identidade Novelo; imprimir 3 cópias.
- [ ] **17h00 · Impressões**: QR do lote `NOV-BXS4UW` → colar no saco de demonstração; RAP pré-gerado → 2 cópias; slides → PDF; one-pager → 3; (plano B) vídeo de 60 s no portátil e no telemóvel.
- [ ] **17h30 · Hélder por mensagem**: fechar as 3 perguntas do issue #21 (arranque E, auditoria 20%, RAP amostral) — alinhados antes do ensaio.
- [ ] **18h00 · Verificações de produção**: health, cenários `Demo · …` e A/B carregam < 2 s e «Por estrada»; lotes com miniaturas (expiram ~21 jan, ok); saldo OpenRouter; `QUICK_JOIN_CODE` não é preciso (sem convidados); conta com password testada.
- [ ] **19h00 · Ensaio 1 cronometrado** (fluxo completo, §4, com cronómetro; objetivo: 25 min).
- [ ] **21h00 · Ensaio 2** com falha simulada: desligar a rede a meio («E se...?» → pergunta de reserva; triagem → capturas). Pergunta de reserva preferida: **"E se o orçamento subir de 60 000 para 90 000 €?"** (está no seed, em cache).
- [ ] **Último**: telemóvel e portátil a carregar; hotspot; peça + toalha + saco com QR na mochila.

## 10. Amanhã, antes de entrar (−30 min)

- [ ] Produção a responder **fora da rede de casa** (dados móveis); health verde.
- [ ] Login com password; separadores da §4.0 abertos por ordem; zoom testado no ecrã da sala.
- [ ] QR do saco lido **com um telemóvel que não é o teu** (o do presidente é o objetivo).
- [ ] «E se...?» de aquecimento (uma das de reserva) — < 15 s.
- [ ] Se deploy saiu: `/bag-check` testado com a toalha.
- [ ] Água; bloco de notas para as perguntas sem resposta.

## 11. Plano B (resumo)

1. **Sem rede/produção**: vídeo de 60 s (portátil + telemóvel) + RAP impresso + one-pager — a apresentação sobrevive em papel com os slides.
2. **IA sem saldo/falha**: «E se...?» fica em cache (pergunta de reserva); triagem fica «a demonstração está offline hoje» e mostra-se o lote e o passaporte (não dependem da chave).
3. **Deploy do «Vai no saco?» não saiu**: captura no slide 4.
4. **Projetor falha**: a app no telemóvel (PWA) + one-pager; os slides são apoio, não espinha dorsal.
5. **Pergunta hostil sem resposta**: §8 regra 5.

## 12. Números para ter na ponta da língua

| Número | Valor | Fonte |
| --- | --- | --- |
| Recolhido 2025 | 301,27 t = 0,160 kg/hab/mês (9,1% do gerado) | Vitrus, medido |
| Por desviar | ≈ 3 003,3 t/ano = 1,596 kg/hab/mês | 51 250,6 t × 5,86% (APA); estimativa |
| Aterro | 105,64 €/t (40 TGR + 65,64 Resinorte) | Vitrus, 22 out |
| Evitado no alvo | 317 269 €/ano | 3 003,3 t × 105,64 €; cálculo |
| Cenário B (60 000 €/ano) | 431,1 t/ano a 101,9 €/t; evitado 45 542 €; líquido −1 628 €/ano | modelo; estimativa (H3, H10) |
| Reutilizável no B | 256,1 t/ano (215,6–314,1), 171,5 €/t reutilizável | modelo; estimativa (A19, H1, H2) |
| Viatura | 42 500 € (5 312,50 €/ano em 8 anos) | concurso de Gaia; pressuposto |
| Destino 2025 | 59,4% reutilização · 26,5% reciclagem · 14,1% rejeito | Vitrus |
| Rejeito por canal | escolares 56,9% · Sarah 13,0% · Ultriplo 14,5% · Nova Etapa 10,0% | Vitrus (escolares: amostra 5,6 t, estimativa) |
| Triagem em camadas | ~2–3 ETC + 50–200 mil €/ano de sacos vs 32–48 ETC + 24 500–98 000 €/ano de IA | issue #21; estimativas |
| Amostra RAP | 385 sacos/trimestre → ±5 p.p. a 95% | estatística padrão |
| Rede municipal | 2 751 contentores, 2 026 locais, 1 187 candidatos públicos + 86 escolas (837 precisos) | pacote QGIS 20 out |
| Cobertura a 300 m | 47,8% da área do concelho | cálculo sobre o pacote |
| Piloto recomendado | Aldão + Arosa e Castelões | ecrã `/pilot` |
| Diretiva | RAP têxteis até 17 abr 2028; custo eficiente com as autoridades locais (art. 22.º-A n.º 7, 11, 12); rede que não se limite às zonas rendíveis (art. 22.º-C n.º 9 b)) | Diretiva (UE) 2025/1892 |
| População e freguesias | 156 830 hab (INE), 48 freguesias | INE |

Estimativas dizem-se sempre «estimativa»; se não se sabe, anota-se e responde-se depois — o ecrã `/assumptions` tem a origem de cada valor.
