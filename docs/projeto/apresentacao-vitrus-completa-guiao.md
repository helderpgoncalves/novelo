# Apresentação completa à Vitrus e ao Município de Guimarães: guião

Guião falado, diapositivo a diapositivo, da apresentação completa do Novelo, para fazer **com a aplicação a funcionar**. O deck é `pitch/out/novelo-apresentacao-vitrus-completa.pptx` (74 diapositivos, notas do orador preenchidas); este ficheiro tem as mesmas notas, mais a preparação, as perguntas esperadas e as regras para o dia. Os dois saem da mesma fonte (`pitch/vitrus/`), por isso não divergem.

**Quem ouve:** o presidente da Câmara Municipal de Guimarães e a Câmara; a Vitrus Ambiente (direção e operação). **Para quê:** que quem pode dar seguimento tenha tudo na mão: números, pressupostos, limites, dúvidas e o que falta. Não é um pitch.

| | |
| --- | --- |
| Duração | cerca de 2 horas com a conversa (versão completa); **25 minutos** no caminho curto (secção 3) |
| Diapositivos | 74: 11 separadores, 55 de conteúdo, 6 anexos |
| Aplicação | ao vivo nos blocos 04 e 05; cada diapositivo de demonstração tem os passos e o plano B |
| Quem apresenta | Flávio Fernandes e Hélder Gonçalves |

## 1. Como se lê cada número

Todos os números da apresentação trazem um de três selos, e diz-se em voz alta:

- **Medido:** vem dos dados da Vitrus, do INE ou da APA, sem conta nossa que o altere (301,3 t; 105,64 €/t).
- **Estimativa:** derivado por conta a partir de valores medidos e de uma fonte (≈ 3 003,3 t por desviar; 431,1 t do cenário B).
- **Pressuposto:** valor da equipa, com fonte escrita e editável no ecrã de pressupostos (viatura 42 500 €; 30 km/h; 6 € por recolha).

> Regra: nenhum valor se apresenta como medido quando é estimativa, e quando não se sabe, anota-se («boa pergunta, anotamos e respondemos com número»).

## 2. Antes de começar

**Uma semana antes**

- [ ] Confirmar com a Vitrus a data e quem estará na sala; enviar o deck em PDF, se pedido.
- [ ] Produção a responder (`novelo.helder.si`); login com palavra-passe (não com ligação por email); saldo da IA (OpenRouter) e teto mensal verificados.
- [ ] Cenários `Demo · …` e relatório RAP pré-gerado presentes; lotes de demonstração com miniaturas (expiram aos 90 dias: repetir o seed se necessário; ver «Dados de demonstração»).
- [ ] Criar em produção o cenário «Duas freguesias · Aldão + Arosa e Castelões» (restrições a essas duas freguesias, 30 000 €/ano) e confirmar as rotas «Por estrada».
- [ ] Imprimir: relatório RAP (uma cópia por pessoa-chave), este guião (uma cópia para quem apresenta), um A4 com a frase final e os quatro números.

**No dia, 30 minutos antes**

- [ ] Produção a responder **fora da rede de casa** (dados móveis); telemóvel com hotspot pronto.
- [ ] Separadores abertos **por ordem** (secção 4): nunca procurar um ecrã ao vivo.
- [ ] Saco de demonstração com o **QR de um lote entregue** colado (em produção: `NOV-BXS4UW`; confirmar o código na lista de lotes) e lido antes com um telemóvel que não é o vosso.
- [ ] Uma peça de roupa com etiqueta legível e uma toalha velha (para o «Vai no saco?»); fotografadas antes, em plano B.
- [ ] «E se...?» de aquecimento com a pergunta de reserva (menos de 15 s). Zoom e resolução testados no ecrã da sala.
- [ ] Água; bloco de notas para as perguntas sem resposta.

> **As capturas do deck vêm da stack de desenvolvimento local** (11 nov 2026) com os dados de demonstração. Em produção os códigos dos lotes e algumas décimas dos cenários por locais reais podem diferir (±1% entre execuções); os números de referência do deck são os da secção 7.

## 3. Duas versões da sessão

| Versão | Duração | O que inclui |
| --- | --- | --- |
| Completa | cerca de 2 h com a conversa | Todos os diapositivos, com a aplicação aberta nos blocos 04 e 05 |
| **Caminho curto** | **25 min** | Os diapositivos marcados **curto** na tabela da secção 4 (14), com um só momento ao vivo de cada tipo: «E se...?» e o QR do passaporte |

Nas duas versões: a frase final, os dois pedidos de ouvir (as perguntas nossas) e o que se segue não se cortam.

## 4. Mapa da sessão

Tempos acumulados indicativos (a versão completa soma cerca de 2:03). **Curto** = faz parte do caminho de 25 minutos; **app** = tem demonstração ao vivo.

| N.º | Diapositivo | Início | Curto | App |
| ---: | --- | ---: | :---: | :---: |
| 1 | Novelo: do saco ao fio | 0:00 | sim (0:00) |  |
| 2 | Sem um único contentor novo, a rede desvia 431 t por ano do aterro e o tratamento evitado paga a operação | 0:01 | sim (0:01) |  |
| 3 | Cada número diz de onde vem: medido, estimativa ou pressuposto | 0:03 |  |  |
| 4 | **00 · Introdução** | 0:04 |  |  |
| 5 | O Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis ao menor custo e prova o que acontece a cada saco | 0:05 |  |  |
| 6 | Em poucas semanas passámos de um desafio de hackathon a uma plataforma em produção com dados reais da Vitrus | 0:06 |  |  |
| 7 | Cada pessoa da cadeia usa o Novelo de forma diferente: decide, opera, tria, entrega ou recicla | 0:08 |  |  |
| 8 | Doze funcionalidades já a funcionar em produção, todas ligadas ao mesmo modelo de dados | 0:09 |  |  |
| 9 | As palavras que vamos usar: dez termos explicados em uma linha | 0:11 |  |  |
| 10 | **01 · O desafio e os números** | 0:12 |  |  |
| 11 | A Vitrus deu três restrições que desenharam a rede: sem contentores, sem compactador, com meio novo | 0:13 |  |  |
| 12 | 9 em cada 10 kg de têxtil ainda vão para o lixo, e em 2028 a fatura muda de dono | 0:14 | sim (0:03) |  |
| 13 | Do que se recolhe, 59,4% é reutilizado, 26,5% reciclado e 14,1% é rejeito | 0:16 |  |  |
| 14 | O rejeito depende do canal: sem controlo à entrada chega a 56,9% | 0:17 |  |  |
| 15 | O têxtil por desviar sai de dados da Vitrus e da APA, e por isso é estimativa | 0:19 | sim (0:04) |  |
| 16 | Em abril de 2028 quem paga a rede passa a ser o produtor, e Guimarães precisa de chegar com números próprios | 0:20 |  |  |
| 17 | **02 · Os dados recebidos** | 0:22 |  |  |
| 18 | Todos os números do modelo vêm de sete fontes, e cada uma está identificada com data e uso | 0:22 |  |  |
| 19 | A Vitrus tem 2 751 contentores em 2 026 locais, e nenhum é de têxteis | 0:24 |  |  |
| 20 | Há 1 273 candidatos a paragem: 1 187 locais públicos e 86 escolas, e nenhum recebe contentor | 0:25 | sim (0:06) |  |
| 21 | Conhecemos os limites dos dados: aqui está o que ainda está por resolver | 0:27 |  |  |
| 22 | **03 · O modelo** | 0:28 |  |  |
| 23 | A procura, a escolha de locais, as rotas e os custos: quatro passos, e cada um é verificável | 0:29 |  |  |
| 24 | Toda a recolha de têxtil é feita por uma viatura nova de caixa fechada, com pressupostos à vista | 0:30 |  |  |
| 25 | Os quilómetros vêm das estradas reais e o desvio medido é maior do que a nossa estimativa inicial | 0:32 |  |  |
| 26 | Estes são os pressupostos que mais pesam, e a Vitrus pode substituir vários por valores reais | 0:33 |  |  |
| 27 | A IA traduz e explica; quem calcula é o otimizador, e um verificador rejeita números sem origem | 0:35 |  |  |
| 28 | **04 · Resultados e cenários** | 0:36 |  |  |
| 29 | A primeira página põe os números da Vitrus à vista, cada um com o seu selo | 0:37 |  | sim |
| 30 | A mesma pergunta, dois desenhos: o contentor de rua capta mais, mas a Vitrus não o quer e o modelo não conta a contaminação | 0:40 |  | sim |
| 31 | Com 60 000 € por ano a rede gasta 43 914 €, capta 431,1 t e o tratamento evitado cobre o custo | 0:44 | sim (0:07) | sim |
| 32 | Cada orçamento compra uma quantidade de têxtil a um custo por tonelada, e o euro extra fica mais caro | 0:47 | sim (0:10) | sim |
| 33 | Por locais reais a rede serve mais gente (até 95,7%), mas custa mais por tonelada do que por freguesia | 0:51 |  |  |
| 34 | O plano de recolha diz o dia, a viatura e os quilómetros de cada freguesia, e as rotas seguem as estradas | 0:52 |  | sim |
| 35 | A rede serve 72,8% da população urbana e 55,5% do resto, e é isso que a diretiva pede para medir | 0:56 |  | sim |
| 36 | O intervalo provável do custo é de 82 a 140 €/t e quatro dos cinco maiores fatores são pressupostos sem dado | 0:59 |  | sim |
| 37 | Pergunta-se em português e o otimizador responde com números verificados, nunca a IA | 1:03 | sim (0:13) | sim |
| 38 | A ferramenta desenha a rede à escala que se quiser: aqui, Aldão e Arosa e Castelões, as duas que o modelo aponta para começar | 1:06 |  | sim |
| 39 | Do que se recolhe hoje ao teto do modelo sem contentores há uma margem de 2,6 vezes, e o potencial é quase 10 vezes maior | 1:10 |  |  |
| 40 | **05 · A prova: do saco ao fio** | 1:11 |  |  |
| 41 | Uma fotografia na entrega sugere tipo, estado, composição e marca; a decisão é sempre do operador | 1:12 |  | sim |
| 42 | Cada lote tem um QR e uma página pública que responde à pergunta «para onde foi a minha roupa?» | 1:15 | sim (0:16) | sim |
| 43 | Quilos por marca e por fibra: a base local para a ecomodulação de 2028 e o material limpo que a indústria procura | 1:19 |  | sim |
| 44 | O dossiê para a mesa de 2028 sai num clique, com o método e a fonte de cada número | 1:22 | sim (0:19) | sim |
| 45 | A resposta à sugestão de 4 de novembro: o munícipe fotografa a peça e recebe um conselho, sem conta e sem guardar nada | 1:26 |  | sim |
| 46 | O candidato é o lugar, não o contentor; e lares e hotelaria são um canal à parte, com têxtil limpo de alto valor | 1:29 |  | sim |
| 47 | **06 · Triagem à escala** | 1:33 |  |  |
| 48 | Hoje são cerca de 1 milhão de peças por ano; o alvo são cerca de 10 milhões | 1:33 |  |  |
| 49 | Dois extremos não funcionam: triar peça a peça custa 32 a 48 pessoas, e não controlar à entrada deixa passar 56,9% de rejeito | 1:35 |  |  |
| 50 | Analisámos sete abordagens, e a triagem partilhada em camadas é a que se aguenta à escala do alvo | 1:36 |  |  |
| 51 | A proposta tem cinco camadas: dois sacos, declaração opcional, verificação de 10 segundos, auditoria por amostragem e feedback | 1:38 | sim (0:22) |  |
| 52 | Se houver um ensaio, três métricas dizem se a proposta funciona: conformidade, rejeito do verde e recusados à porta | 1:39 |  |  |
| 53 | **07 · Riscos e validação** | 1:41 |  |  |
| 54 | O potencial foi triangulado por quatro leituras e a procura por freguesia explica 76% da distribuição dos contentores | 1:41 |  | sim |
| 55 | Dez riscos conhecidos, cada um com a sua mitigação e quem a fecha | 1:45 |  |  |
| 56 | A fotografia vive em memória, a miniatura é opcional e apaga-se aos 90 dias, e ninguém identifica quem entrega | 1:46 |  |  |
| 57 | **08 · Seguimento e conversa** | 1:48 |  |  |
| 58 | Dez dados que só a Vitrus tem fecham a maior parte da incerteza, e é cerca de meio dia de trabalho | 1:48 | sim (0:24) |  |
| 59 | Uma sequência possível: dados e sessão com a operação agora, calibração em dois meses, e 2028 como horizonte | 1:50 |  |  |
| 60 | A plataforma fica: já está em produção e nós mantemos, desenvolvemos e desenhamos a rede convosco | 1:51 | sim (0:25) |  |
| 61 | Duas perguntas para começar, e seis para a operação e para a gestão | 1:53 |  |  |
| 62 | **09 · Quem somos** | 1:54 |  |  |
| 63 | Dois engenheiros informáticos de Barcelos desenharam, programaram e puseram o Novelo em produção | 1:55 |  |  |
| 64 | O Novelo ganhou o concurso geral do Hack4Guimarães 2035 e o desafio TexVitrus, 8 500 € em prémios | 1:56 |  |  |
| 65 | Dez órgãos de comunicação noticiaram o Novelo entre 28 de outubro e 3 de novembro | 1:58 |  |  |
| 66 | O que a imprensa escreveu sobre o problema e sobre a solução | 1:59 |  |  |
| 67 | Obrigado | 2:01 | sim (0:27) |  |
| 68 | **A · Anexos** | anexo |  |  |
| 69 | Números canónicos: cada valor, a sua origem e o seu selo | anexo |  |  |
| 70 | Um contrato único liga os dados, o otimizador e a app: o que o ecrã mostra é o que a API calcula | anexo |  |  |
| 71 | Stack e entrega técnica: o que está em cada camada e como se verifica | anexo |  |  |
| 72 | Perguntas esperadas da operação e respostas curtas | anexo |  |  |
| 73 | Perguntas esperadas da gestão e do município e respostas curtas | anexo |  |  |
| 74 | Fontes e documentação de apoio | anexo |  |  |

Separadores da aplicação, por ordem (abrir todos antes de entrar): `/` · `/scenarios` (comparação A/B e cadeia de orçamentos) · cenário B com os separadores «Rede e rotas», «Cobertura», «Incerteza» e «E se...?» · cenário «Duas freguesias» · `/pilot` · `/triage` · `/lots` · `/passport/{código}` · `/lots?tab=brands` e `?tab=market` · `/reports` · `/bag-check` (no telemóvel) · `/municipal` (separadores «Candidatos a têxteis» e «Canal B2B») · `/validation` · `/assumptions`.

## 5. Guião diapositivo a diapositivo

Cada entrada tem: o que se diz (as notas do orador do PowerPoint), os números que aparecem no ecrã, os passos na aplicação e o plano B quando há demonstração.

#### 1. Novelo: do saco ao fio

*início 0:00 · **caminho curto** (0:00)*

**O que dizer**

> Bom dia. Obrigado por nos receberem e, antes de tudo, pelos dados: sem os números que a Vitrus abriu, nada do que vamos mostrar existiria. Esta sessão é longa de propósito. Não é um pitch: é a apresentação completa do trabalho, com o aplicativo a funcionar em paralelo, para que quem pode dar seguimento a isto tenha tudo na mão, números, pressupostos, limites e dúvidas. Cada número tem origem e um selo: medido, estimativa ou pressuposto. Se alguma coisa não estiver clara, interrompam-nos.

#### 2. Sem um único contentor novo, a rede desvia 431 t por ano do aterro e o tratamento evitado paga a operação

*início 0:01 · **caminho curto** (0:01)*

**O que dizer**

> Em uma página, o trabalho inteiro. A pergunta que o Hack4Guimarães pôs foi: qual é a rede de recolha de têxteis de menor custo? A resposta que sai dos dados da Vitrus e do otimizador: uma viatura nova só para o têxtil, de caixa fechada e sem compactação; saco fechado à porta num dia fixo por freguesia; e paragens em locais municipais e escolas que já existem. Nenhum contentor novo, que é o que a Vitrus nos disse que não quer. Com 60 mil euros por ano: 431 toneladas, a 101,9 euros por tonelada. O aterro evitado, 45 542 euros a 105,64 euros por tonelada, paga a operação: o custo líquido é de menos 1 628 euros por ano. Dois avisos honestos: isto é estimativa de modelo, não medição; e é o caso central, com intervalo, que mostramos mais à frente. O que é medido, é medido: as 301,3 toneladas recolhidas em 2025. Tudo o resto tem selo.

*Fontes no diapositivo:* Cenário B, 60 000 €/ano, rotas pela estrada, 23 out 2026 (modelo; estimativa) · Vitrus, 22 out 2026 (105,64 €/t) · 301,3 t medido (Vitrus, 2025)

#### 3. Cada número diz de onde vem: medido, estimativa ou pressuposto

*início 0:03*

**O que dizer**

> Antes de entrar nos números, a regra da casa. Nenhum valor entra no modelo sem uma de três origens. Medido: vem dos dados que a Vitrus enviou, como as 301,3 toneladas ou os 105,64 euros por tonelada. Estimativa: derivado por conta a partir de dados e de uma fonte, como as 3 003 toneladas por desviar, que são 5,86 por cento do indiferenciado, base da APA. Pressuposto: um valor nosso, com a fonte escrita e editável no ecrã de pressupostos, como o preço da viatura ou os 30 km/h. No ecrã isto aparece sempre como selo. Vamos usar estas três palavras ao longo de toda a sessão. À direita está o plano: oito blocos, com a aplicação aberta nos blocos quatro e cinco. A sessão completa leva cerca de duas horas, com a conversa; se o tempo apertar, há um caminho curto de 25 minutos marcado no guião.

*Fontes no diapositivo:* Regra do projeto (regras do projeto): nunca inventar um valor; «Dados e modelo»

### 00 · Introdução

*0:04.* Antes dos números, uma introdução: o que é o Novelo numa frase, como chegámos aqui, quem o usa e as palavras que vamos usar ao longo da sessão. Quem já conhece pode saltar; quem chega agora fica com tudo.

#### 5. O Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis ao menor custo e prova o que acontece a cada saco

*início 0:05*

**O que dizer**

> Numa frase: o Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis de Guimarães ao menor custo. Entram um orçamento e uma meta; saem cenários comparáveis em euros, toneladas e euros por tonelada. Mas não pára no plano. O diagrama mostra a ideia a que chamamos do saco ao fio: planear a rede, decidir em português, seguir cada saco até à indústria e entregar à Câmara o dossiê de 2028. Cada passo alimenta o seguinte: o plano diz onde parar; a recolha gera lotes; os lotes geram o passaporte, a evidência por marca e o relatório da responsabilidade alargada do produtor; e o que se mede no terreno volta a calibrar o plano. Esta sessão percorre esse caminho, com a aplicação aberta.

*Fontes no diapositivo:* «Visão geral do projeto» · «Funcionalidades» · novelo.helder.si

#### 6. Em poucas semanas passámos de um desafio de hackathon a uma plataforma em produção com dados reais da Vitrus

*início 0:06*

**O que dizer**

> Quem somos. Hélder Gonçalves e Flávio Fernandes. Construímos isto no Hack4Guimarães 2035, no desafio 5, o TexVitrus, e ganhámos esse desafio e o prémio geral. Mas o que interessa é o que veio depois, porque a Vitrus foi respondendo. A 20 de outubro chegou o pacote QGIS dos contentores municipais. A 21 e 22, as restrições: sem contentores, sem compactador, com um meio novo de recolha, e os dados que faltavam, o custo de tratamento, a percentagem do concelho que a Vitrus recolhe. A 23, a plataforma passou a usar rotas pelas estradas reais, a viatura dedicada e os cenários de demonstração em produção. A 4 de novembro a Vitrus sugeriu mudar a triagem para antes da recolha, e construímos o «Vai no saco?». Hoje, 12 de novembro, estamos aqui. A plataforma está em produção e a documentação está em português, para que quem vier a trabalhar com isto tenha tudo escrito.

*Fontes no diapositivo:* Hack4Guimarães 2035 · desafio 5 TexVitrus · documentação do projeto

#### 7. Cada pessoa da cadeia usa o Novelo de forma diferente: decide, opera, tria, entrega ou recicla

*início 0:08*

**O que dizer**

> Cinco papéis, para perceberem quem usa o quê. O decisor municipal, o presidente, os vereadores, o financeiro: usa o simulador, os cenários e o relatório, e quer saber quanto custa, quanto rende e quanto arrisca. A operação da Vitrus: usa o plano de recolha, as rotas, as viaturas e os alertas de dados, e quer saber qual é o dia, a viatura e a ronda. O operador de triagem, à entrega: fotografa a peça, confirma a sugestão e abre o lote. O munícipe: não precisa de conta; usa o «Vai no saco?» e o passaporte público lido por QR, e quer saber para onde foi a sua roupa. E o reciclador ou a indústria: consulta a bolsa de fibra, lotes homogéneos por fibra. Nenhum papel precisa de saber de otimização: a mesma plataforma, cinco entradas.

*Fontes no diapositivo:* «Funcionalidades» · «Arquitetura» (utilizadores e permissões) · «Visão geral do projeto»

#### 8. Doze funcionalidades já a funcionar em produção, todas ligadas ao mesmo modelo de dados

*início 0:09*

**O que dizer**

> O mapa do que existe, e que vamos ver ao vivo. Na linha de cima, planear: o simulador, que gera cenários por freguesia ou por locais reais; os cenários e a comparação, lado a lado; o «E se...?» em português; a rede municipal com os locais candidatos. Na linha do meio, provar: a triagem por foto; o lote com QR e passaporte público; a bolsa de fibra para os recicladores; a evidência por marca. Na linha de baixo: o relatório RAP em PDF; o «Vai no saco?» para o munícipe; o copiloto conversacional, com 52 ferramentas e confirmação antes de qualquer ação; e o mapa e a cobertura. Tudo funciona sobre os mesmos dados e o mesmo contrato, em português, em telemóvel e computador.

*Fontes no diapositivo:* «Funcionalidades» · novelo.helder.si

#### 9. As palavras que vamos usar: dez termos explicados em uma linha

*início 0:11*

**O que dizer**

> Um glossário rápido, para ninguém se perder. Indiferenciado: o lixo comum. RAP, responsabilidade alargada do produtor: quem põe têxtil no mercado paga a sua recolha e tratamento. Ecomodulação: o valor pago varia com o tipo de produto. TGR: a taxa de gestão de resíduos. TIPAU: a tipologia urbano-rural do INE. CAOP: os contornos oficiais das freguesias. CP-SAT: o solver que escolhe locais e modos. VRP: o problema das rotas de veículos. OSRM: o motor de rotas pelas estradas reais. Estimativa: um número derivado por conta, nunca apresentado como medição. P10, P50 e P90: o intervalo de uma simulação, o cenário otimista, o central e o pessimista. ETC: equivalente a tempo completo, uma pessoa a tempo inteiro.

*Fontes no diapositivo:* «Dados e modelo» · Diretiva (UE) 2025/1892 · documentação do OR-Tools · OSRM

### 01 · O desafio e os números

*0:12.* Começamos pelo princípio: o desafio, as restrições que a Vitrus nos deu, e os números do problema, todos com origem.

#### 11. A Vitrus deu três restrições que desenharam a rede: sem contentores, sem compactador, com meio novo

*início 0:13*

**O que dizer**

> O desafio TexVitrus pedia a rede de menor custo. Mas a Vitrus, nas semanas a seguir ao hackathon, foi-nos dando restrições que mudaram o desenho, e é importante que fiquem escritas. Primeira, a 21 de outubro: não querem contentores de têxteis, porque a contaminação estraga a reutilização, que é onde está o valor; e reciclar custa mais do que fibra virgem, por isso a reciclagem não conta como receita. Segunda, a 22 de outubro: o saco de têxtil não pode ir no compactador do porta a porta, nem há volta de têxtil num compactador, e não há viaturas livres à tarde, porque a folha de turnos tinha um erro. Terceira, o caminho que a Vitrus indicou: a aquisição de um meio novo de recolha. Por isso toda a recolha do nosso modelo é feita por uma viatura nova, de caixa fechada e sem compactação, a partir do estaleiro da Polvoreira. E a 4 de novembro a Vitrus sugeriu mover parte da triagem para o munícipe, em casa. Voltaremos a isso no bloco seis.

*Fontes no diapositivo:* Vitrus, 20, 21 e 22 out 2026 e 4 nov 2026 (reuniões e respostas por escrito) · «Dados e modelo»

#### 12. 9 em cada 10 kg de têxtil ainda vão para o lixo, e em 2028 a fatura muda de dono

*início 0:14 · **caminho curto** (0:03)*

**O que dizer**

> Quatro números, todos da Vitrus ou públicos. Trezentas e uma toneladas de têxtil recolhidas à parte em 2025, pelas quatro entidades que trabalham connosco: medido. Cerca de 3 003 toneladas por ano continuam no indiferenciado: estimativa, que explico já no diapositivo a seguir. 105,64 euros é o que custa cada tonelada de indiferenciado tratada, 40 euros de taxa de gestão de resíduos mais 65,64 da tarifa da Resinorte: cada tonelada que desviamos deixa de custar isto ao município. E o relógio: 17 de abril de 2028, prazo da responsabilidade alargada do produtor. Daqui a 522 dias. Conta de cabeça: nove em cada dez quilos de têxtil que Guimarães gera ainda vão para o lixo.

**Números no ecrã:** 301,3 t · ≈ 3 003,3 t/ano · 105,64 €/t · 17 abr 2028

*Fontes no diapositivo:* Vitrus 2025 (301,3 t, medido) · 51 250,6 t × 5,86% (APA, RARU 2025, p. 24; estimativa) · Vitrus, 22 out 2026 (105,64 €/t) · Diretiva (UE) 2025/1892

#### 13. Do que se recolhe, 59,4% é reutilizado, 26,5% reciclado e 14,1% é rejeito

*início 0:16*

**O que dizer**

> Para onde vão as 301,3 toneladas. Quatro entidades: a H Sarah Trading com 118,6 toneladas, a Ultriplo com 134,1, a Nova Etapa com 42,9 e a recolha própria da Vitrus, que é só uma amostra de 5,6 toneladas, com a To Be Green. No total, 59,4 por cento vai para reutilização, 26,5 para reciclagem e 14,1 para rejeito, 42,3 toneladas. Duas notas de rigor. Primeira: dois destes valores são pesados, kg exatos por destino, na Sarah e na Ultriplo; os da Nova Etapa e da Vitrus são percentagens de relatório aplicadas ao total, e por isso entram na quota central mas não nos intervalos. Segunda: só a reutilização conta como receita no nosso modelo, porque reciclar custa mais do que fibra virgem, como a Vitrus nos disse. Por isso o valor está em levar têxtil limpo e seco até à reutilização.

*Fontes no diapositivo:* Vitrus, destinos 2025 (H Sarah Trading e Ultriplo: kg pesados; Nova Etapa: percentagens do relatório; Vitrus: amostra To Be Green de 5,6 t) · dados tratados do projeto

#### 14. O rejeito depende do canal: sem controlo à entrada chega a 56,9%

*início 0:17*

**O que dizer**

> A razão pela qual a Vitrus tem medo de contentores é esta. Entre as entidades que triam profissionalmente, o rejeito anda entre 10 e 14,5 por cento. Mas na amostra da recolha da própria Vitrus, onde não há controlo à entrada, o relatório da To Be Green deu 56,9 por cento de lixo e desperdícios. É uma amostra pequena, 5,6 toneladas, por isso dizemo-lo: estimativa. Mas diz tudo sobre o que acontece quando o têxtil chega sem qualquer verificação. Este é o número que fundamenta duas decisões nossas: a rede sem contentores e, mais à frente, a verificação à porta dentro da proposta de triagem em camadas. À escala do alvo, se o canal sem controlo tivesse esta taxa, seriam cerca de 1 709 toneladas por ano desperdiçadas.

*Fontes no diapositivo:* Vitrus 2025; relatório To Be Green (amostra de 5,6 t: LIXO + DESPERDÍCIOS 56,88%; estimativa) · cálculo sobre dados tratados do projeto

#### 15. O têxtil por desviar sai de dados da Vitrus e da APA, e por isso é estimativa

*início 0:19 · **caminho curto** (0:04)*

**O que dizer**

> Mostro a conta, porque é a mais importante do modelo e a que mais discutimos. A Vitrus recolhe 43 050,5 toneladas de indiferenciado, que são 84,0 por cento do concelho, segundo o Relatório e Contas de 2025, página 8. Dividindo, o concelho todo produz cerca de 51 250,6 toneladas. A APA, no RARU de 2025, página 24, diz que 5,86 por cento do indiferenciado nacional é têxtil. Aplicado ao concelho: cerca de 3 003,3 toneladas por ano. Por habitante, são 1,596 quilos por mês. A ressalva que fazemos sempre: 5,86 por cento é a média nacional, não uma caracterização do lixo de Guimarães, e o modelo aplica-a igual a todas as freguesias. Uma caracterização local do indiferenciado é um dos dados que mais valor tem para afinar isto. E duas bases que já não usamos: 0,7 quilos por habitante por mês, do plano municipal, que a Vitrus não conhece; e 5,4 por cento sobre 43 051 toneladas, que só contava a parte da Vitrus.

**Números no ecrã:** 43 050,5 t · 0,840 · 51 250,6 t · 5,86% · 3 003,3 t · 1,596 kg/hab/mês · 9,1%

*Fontes no diapositivo:* Vitrus, Relatório e Contas 2025, p. 8 · APA, RARU 2025, p. 24 · INE, Censos 2021 (156 830 hab.) · «Dados e modelo», secção 1

#### 16. Em abril de 2028 quem paga a rede passa a ser o produtor, e Guimarães precisa de chegar com números próprios

*início 0:20*

**O que dizer**

> O que a diretiva muda, em três ideias. Primeira: até 17 de abril de 2028 cada Estado-Membro tem de criar a responsabilidade alargada do produtor para os têxteis: são os produtores, as marcas, que passam a pagar o custo da recolha e do tratamento. Segunda: esse custo é o custo eficiente, determinado com as autoridades locais, artigo 22.º-A, números 7, 11 e 12. Quem chegar a essa mesa a saber o seu custo por tonelada, defende o seu número. Terceira: a rede de recolha não se pode limitar às zonas onde é mais rendível; artigo 22.º-C, número 9, alínea b). Daí a nossa matriz de cobertura por tipo de território, que mostramos no bloco quatro. E há uma quarta, a ecomodulação: as taxas podem variar com o tipo de produto, o que torna valiosa a evidência por marca e por composição que a triagem recolhe. Tudo isto é o que o relatório RAP do Novelo reúne.

*Fontes no diapositivo:* Diretiva (UE) 2025/1892 (art. 22.º-A n.º 7, 11, 12; art. 22.º-C n.º 9, al. b)) · «Dados e modelo», secção 10 · Passaporte Digital do Produto: contexto do plano municipal, por confirmar

### 02 · Os dados recebidos

*0:22.* Segundo bloco: os dados. Quem vai dar seguimento a isto precisa de saber exatamente o que recebemos, de onde vem cada ficheiro e o que ainda falta.

#### 18. Todos os números do modelo vêm de sete fontes, e cada uma está identificada com data e uso

*início 0:22*

**O que dizer**

> A lista completa das fontes. Da Vitrus: os Excel de circuitos e viaturas e de têxtil por entidade e por destino; o Relatório e Contas de 2025; e o pacote QGIS de contentores municipais, de 20 de outubro. Os ficheiros originais ficam guardados à parte e não são públicos, porque são vossos. Do INE: população por freguesia, Censos 2021, e a tipologia de áreas urbanas. A CAOP 2019 dá os contornos oficiais das freguesias. Do OpenStreetMap, num extrato da Geofabrik de Portugal, vêm as estradas para as rotas. Da APA, o 5,86 por cento. Cada ficheiro tem o seu SHA-256 registado no seed: se alguém mudar um dado, o sistema sabe. E os dados tratados regeneram-se a partir dos originais.

*Fontes no diapositivo:* «Análise dos dados recebidos» · «Dados e modelo», secção «Fontes de dados» · dados tratados do projeto

#### 19. A Vitrus tem 2 751 contentores em 2 026 locais, e nenhum é de têxteis

*início 0:24*

**O que dizer**

> O pacote QGIS que a Vitrus nos enviou a 20 de outubro é a base geográfica de tudo. São 2 751 contentores de outras frações: profundidade, superfície, orgânico coletivo, orgânico de produtores e resíduos verdes. Agrupámo-los em 2 026 locais: 1 573 públicos, 452 de produtores e um misto. Atenção: nenhum destes contentores é de têxteis. Servem para saber onde a viatura já passa e onde as pessoas já vão. No mapa, a verde, os 1 187 locais públicos com contentor de rua, que são os candidatos a paragem; a cinzento, os que só têm orgânico ou verdes; e a areia, os produtores: restauração, escolas, lares. Notem a concentração no centro e em Azurém, e como as freguesias do norte têm poucos pontos. Tudo está exportável em GeoJSON para o vosso QGIS.

*Fontes no diapositivo:* Vitrus, pacote QGIS de 20 out 2026 (SHA-256 registado) · CAOP 2019 · dados tratados do projeto · «Análise dos contentores municipais»

#### 20. Há 1 273 candidatos a paragem: 1 187 locais públicos e 86 escolas, e nenhum recebe contentor

*início 0:25 · **caminho curto** (0:06)*

**O que dizer**

> Esta é a lista de onde pode parar a viatura, e verificámo-la ficheiro a ficheiro. Candidatos públicos: 1 187, locais que têm pelo menos um contentor de rua, ou seja profundidade, superfície ou plataforma. Não entram os 387 que só têm orgânico ou resíduos verdes. Pontos assistidos: 86 escolas da rede municipal, que já têm uma campanha de têxteis com a Vitrus; no ficheiro não são marcados como candidatos, mas o modelo trata-os como pontos assistidos, onde o têxtil é entregue dentro, com pessoas. Total: 1 273. E dois avisos que dão trabalho: 350 dos 1 187 têm coordenada aproximada, cerca de 100 metros, e têm de ser confirmados no terreno. Reparem no mapa: concentram-se nas freguesias do norte. E um dos 1 187 é um local de um grande produtor, em Moreira de Cónegos. O que nunca acontece: nenhum destes locais recebe um contentor de têxteis. A paragem é um encontro anunciado, o saco entrega-se à mão.

**Números no ecrã:** 1 187 · 86 · 1 273 · 837 · 350

*Fontes no diapositivo:* dados tratados do projeto (textile_candidate, coord_precision, producer_types) · verificado a 11 nov 2026

#### 21. Conhecemos os limites dos dados: aqui está o que ainda está por resolver

*início 0:27*

**O que dizer**

> Para quem vai trabalhar com isto, os limites dos dados, sem maquilhagem. Primeiro, circuitos: dos 40 circuitos, 9 não têm viatura na folha de turnos; a Vitrus já nos disse que a folha tem erros, e que esses circuitos circulam, por isso contamos todas as passagens. Duas viaturas nunca foram atribuídas a nenhum turno. Segundo, geografia: das 82 localidades dos circuitos, 79 ficam em freguesia pela regra de nome ou de ponto, e 3 ficam por resolver, estão nos alertas, não escondidas. Terceiro, contentores: 2 751 aceites, 3 rejeitados e 29 pendentes de coordenada. Quarto: não temos têxtil por freguesia nem por contentor, a Vitrus não tem dados de deposição de têxtil; por isso a procura por freguesia é proporcional à população. Quinto: só há um ano de têxtil, 2025, por isso não há backtest temporal e não fingimos um. Cada um destes pontos tem uma ação possível, e vários dependem só de os pedirmos à Vitrus.

*Fontes no diapositivo:* dados tratados do projeto · alertas de qualidade dos dados · «Análise dos dados recebidos»

### 03 · O modelo

*0:28.* Terceiro bloco: o modelo. Para quem vai dar seguimento, é a parte que importa mais: como se chega a cada número, o que é pressuposto e onde mexer.

#### 23. A procura, a escolha de locais, as rotas e os custos: quatro passos, e cada um é verificável

*início 0:29*

**O que dizer**

> O modelo tem quatro passos. Um: a procura. Para cada freguesia, o têxtil por desviar é a população vezes o têxtil por habitante vezes doze meses. Dois: a captura: o que se capta depende do modo que serve a zona, existente ou saco à porta, e de uma taxa de captura por modo, que é pressuposto até haver dados do terreno. Três: a escolha. O CP-SAT, do OR-Tools, decide que locais abrir e que modo serve cada zona, para maximizar as toneladas dado um orçamento, ou minimizar o custo dada uma meta. Uma zona só conta como servida se houver um ponto dentro da distância a pé. Quatro: as rotas. O VRP calcula as viagens da viatura a partir do estaleiro, com capacidade de 2 toneladas e distâncias pelas estradas reais. No fim, os KPIs: investimento, custo anual, toneladas, euros por tonelada, população coberta, têxtil reutilizável, tratamento evitado e custo líquido. Tudo determinístico, com sementes fixas e limite de tempo do solver.

*Fontes no diapositivo:* «Dados e modelo», secções 1 a 3 e 8 · Beardwood, Halton e Hammersley (1959)

#### 24. Toda a recolha de têxtil é feita por uma viatura nova de caixa fechada, com pressupostos à vista

*início 0:30*

**O que dizer**

> A viatura nova é o elemento do desenho que mais pesa no custo, por isso está toda à vista. O preço, 42 500 euros sem IVA, vem de uma adjudicação do Município de Vila Nova de Gaia, de um veículo pesado de mercadorias com caixa fechada: está no anúncio TED, e falta confirmá-lo no portal Base. Vida útil de oito anos, o que dá 5 312,50 euros por ano. Carga útil de 2 toneladas, nosso pressuposto para uma caixa fechada até cerca de 5 toneladas de peso bruto: falta validar com a ficha técnica da viatura que a Vitrus vier a escolher. Velocidade média em recolha de 30 km/h, que inclui manobras e paragens curtas; a condução medida no OSRM anda nos 40, mas as horas continuam a usar 30, por prudência. Dois minutos por saco à porta, dez minutos por local. Um turno de sete horas, cinco dias, 52 semanas: 1 820 horas por ano por viatura. Quando as horas passam disso, o modelo compra uma segunda viatura. Tudo isto são pressupostos editáveis; a Vitrus tem os valores reais.

**Números no ecrã:** 42 500 € · 5 312,50 €/ano · 2 t · 30 km/h · 1 820 h/ano

*Fontes no diapositivo:* Vitrus, 22 out 2026 · Município de Vila Nova de Gaia, TED 338951-2024 (lote VII) e adjudicação TED 72690-2025 (42 500 €; confirmar no Base) · pressupostos da equipa

#### 25. Os quilómetros vêm das estradas reais e o desvio medido é maior do que a nossa estimativa inicial

*início 0:32*

**O que dizer**

> As rotas não são linhas retas. Montámos um servidor OSRM nosso sobre o OpenStreetMap de Portugal, com um perfil de furgoneta de 2,8 metros de altura, 2,1 de largura, 6 de comprimento e 3,5 toneladas, porque a Vitrus ainda não nos disse que viatura vai usar. Cada rota do ecrã diz se foi medida por estrada ou estimada. Só se o OSRM não responder, ou se um par de pontos não tiver caminho, usamos a estimativa: linha reta vezes 1,3. E calibrámos: o desvio real, estrada a dividir por linha reta, tem mediana de 1,48 nas 48 freguesias e de 1,37 em 300 locais candidatos. Ou seja, o nosso 1,3 inicial era otimista, e foi por isso que passámos a usar estrada. Uma nota importante: a volta dentro de cada freguesia, no porta a porta, é sempre estimativa por fórmula, a de Beardwood, Halton e Hammersley, porque não temos moradas de paragens para pedir ao OSRM. Cada ronda é uma viagem própria a partir do estaleiro, por isso é um teto.

*Fontes no diapositivo:* OSRM sobre OpenStreetMap (Geofabrik, extrato de 20 out 2026, ODbL) · calibração de 23 out 2026 («Rotas por estrada»)

#### 26. Estes são os pressupostos que mais pesam, e a Vitrus pode substituir vários por valores reais

*início 0:33*

**O que dizer**

> Esta tabela é o pedido de ajuda mais concreto que podemos fazer. São os pressupostos que mais mexem nos resultados. Captura de 18 por cento num local existente e 25 por cento no saco à porta: não há dado local, são pressupostos que o piloto ou a recolha real calibram. Custo por recolha, 6 euros, e por quilómetro, 1,10 euros: pedimos ao financeiro da Vitrus os euros por hora e por quilómetro das viaturas, e ainda não chegaram; quando chegarem, substituem estes dois. Vinte e cinco quilos por saco à porta. Ronda a cada duas semanas. Cada um está no ecrã de pressupostos, com a origem escrita e editável, e entra na análise de sensibilidade. A regra: nenhum valor entra no código sem uma linha na documentação com fonte. Os maiores fatores de incerteza do cenário central são precisamente a captura e a cobertura dos locais existentes, o têxtil por habitante, o custo de uma recolha e os quilos por saco.

*Fontes no diapositivo:* «Dados e modelo», secção «Pressupostos» · ecrã de pressupostos da aplicação

#### 27. A IA traduz e explica; quem calcula é o otimizador, e um verificador rejeita números sem origem

*início 0:35*

**O que dizer**

> Esta é a regra de ouro da IA no Novelo: a IA nunca faz contas. Vejam o fluxo do «E se...?». O utilizador escreve uma pergunta em português. O modelo traduz para uma alteração estruturada, validada, com listas fechadas de freguesias, modos e parâmetros. O ecrã mostra primeiro «Entendi: ...» para o utilizador confirmar antes de calcular. O otimizador corre o cenário novo e devolve os números. O modelo escreve a explicação a partir desse resultado. E um verificador compara todos os números do texto com os do resultado: se algum não existir, a resposta é rejeitada e regenerada; à segunda falha, mostra-se só a tabela. Pergunta ambígua, o sistema pergunta de volta. Freguesia ou modo inexistente, recusa. Cada resposta guarda a pergunta, a alteração, o cenário e a versão do prompt. Sem chave de IA a aplicação arranca e as funcionalidades de IA respondem 503: o resto funciona. A triagem por foto usa o mesmo princípio: o modelo sugere, a pessoa confirma.

*Fontes no diapositivo:* «IA» · «Funcionalidades», secção 1

### 04 · Resultados e cenários

*0:36.* Quarto bloco: os resultados, com a aplicação aberta. Cada diapositivo tem o ecrã correspondente e o número que o resume; o que dizemos aqui é o que se vê lá. Se alguma coisa falhar ao vivo, os ecrãs estão nos diapositivos.

#### 29. A primeira página põe os números da Vitrus à vista, cada um com o seu selo

*início 0:37 · **com a aplicação***

**O que dizer**

> Esta é a página que se abre todos os dias. A faixa de cima são os mesmos quatro números de há bocado: 301,3 toneladas recolhidas, o selo «medido»; 9,1 por cento do têxtil gerado, «estimativa»; cerca de 3 003 toneladas por ano ainda no lixo, «estimativa»; e os dias até 17 de abril de 2028. Reparem nos selos: nenhum número aqui se apresenta como dado quando é estimativa. Em baixo, o mapa mostra onde o têxtil se perde, freguesia a freguesia, e o Top 10: Creixomil, Azurém, Oliveira São Paio e São Sebastião, Ponte. Atenção à nota: o têxtil por freguesia é proporcional à população, porque não há dados de têxtil por freguesia. A barra de confiança, no fundo, separa medido, estimado e em falta; à medida que houver recolha, o estimado vai passando a medido.

**Na aplicação (/)**

1. Mostrar a faixa de situação: 301,3 t medido; 9,1% estimativa; ≈ 3 003 t por desviar; dias até 17 abr 2028
2. Apontar os selos «medido» e «estimativa»: a regra da casa
3. Descer ao mapa «Onde se perde» e ao Top 10 de freguesias por têxtil por desviar
4. Mostrar a barra de confiança dos dados no fundo

**Plano B:** diapositivo com a captura do ecrã.

*Fontes no diapositivo:* novelo.helder.si (stack de dev local com dados reais, 11 nov 2026) · Vitrus 2025 · APA RARU 2025

#### 30. A mesma pergunta, dois desenhos: o contentor de rua capta mais, mas a Vitrus não o quer e o modelo não conta a contaminação

*início 0:40 · **com a aplicação***

**O que dizer**

> A comparação lado a lado. O cenário A é o modelo clássico: contentores de têxtil de rua por todo o concelho. O cenário B é o desenho que a Vitrus indicou: viatura nova, saco fechado à porta e paragens em locais que já existem, sem contentores. Honestidade primeiro: no modelo, o A capta mais, 652 toneladas contra 431, e fica mais barato por tonelada, 71,7 contra 101,9 euros. E a caixa de robustez diz que em 91 por cento das amostras o A ganha em euros por tonelada. Porque então propomos o B? Primeiro, porque a Vitrus não quer contentores, e com razão: o têxtil de contentor vem contaminado e perde a reutilização. Segundo, porque o modelo não desconta essa contaminação: o pressuposto de captura do contentor de rua, 28,6 por cento, é mais alto do que o do local existente, 18 por cento, mas nenhum dos dois traz a qualidade. Por isso o A fica como referência, nunca como proposta. A comparação existe para que a decisão seja vossa, com números à frente.

**Números no ecrã:** 652,1 t · 431,1 t

**Na aplicação (/scenarios → Comparar)**

1. Abrir a comparação A/B (Cenário A × Cenário B)
2. Ler a linha «Têxtil captado»: B fica 221 t abaixo de A
3. Apontar «Custo por tonelada» e «Custo anual»
4. Mostrar a caixa «Robustez da comparação»: 91% das amostras dão A melhor em €/t, e dizer porquê
5. Concluir: o contentor de rua é só referência

**Plano B:** diapositivo com a captura.

*Fontes no diapositivo:* Cenários «Demo · Cenário A» e «Demo · Cenário B», 60 000 €/ano, rotas pela estrada (11 nov 2026; modelo; estimativa) · Vitrus, 21 out 2026 (contaminação)

#### 31. Com 60 000 € por ano a rede gasta 43 914 €, capta 431,1 t e o tratamento evitado cobre o custo

*início 0:44 · **caminho curto** (0:07) · **com a aplicação***

**O que dizer**

> Este é o cenário B em detalhe. Com 60 mil euros por ano de orçamento, a rede gasta 43 914 euros e capta 431,1 toneladas, a 101,9 euros por tonelada. O custo decompõe-se assim: operação, 35 702 euros, que são as recolhas e os quilómetros; a viatura, 42 500 euros em oito anos, 5 312,50 euros por ano; e o investimento de 250 euros por local, anualizado, 2 900 euros. O tratamento evitado: 431,1 toneladas vezes 105,64, são 45 542 euros. O custo líquido para o município é de menos 1 628 euros por ano: o aterro evitado paga a rede toda e sobra, por pouco, 3,7 por cento. Uma ressalva que fazemos sempre: não é uma folga garantida. O percentil 90 do custo por tonelada, 139,7, está acima dos 105,64 do aterro evitado: nos casos pessimistas, não chega. Do que se capta, cerca de 256 toneladas são reutilizáveis, com um intervalo de 216 a 314, o que dá 171,4 euros por tonelada reutilizável. A cobertura de população é de 70,4 por cento e a viatura trabalha 1,66 dias por semana, 605 horas por ano, 7 543 quilómetros.

**Números no ecrã:** 431,1 t · 101,9 €/t · 45 542 € · −1 628 € · 256,1 t

**Na aplicação (/scenarios/{Cenário B})**

1. Ler os quatro cartões: 431,1 t, 102 €/t, 43 914 €, 57 000 € de investimento
2. Ler «Em resumo»: 60 000 €/ano, 431,1 t (14% dos 3 003 t), 102 €/t
3. Descer: Desviado do lixo 14,4%, 1 viatura, tratamento evitado 45 542 €, custo líquido −1 628 €
4. Ver «Têxtil reutilizável»: 256,1 t (215,6 a 314,1)

**Plano B:** diapositivo.

*Fontes no diapositivo:* Cenário «Demo · Cenário B · sem contentores (proposta) · 60 000 €/ano», rotas pela estrada (modelo; estimativa; 11 nov 2026) · 105,64 €/t (Vitrus) · ecrã /scenarios/{id}

#### 32. Cada orçamento compra uma quantidade de têxtil a um custo por tonelada, e o euro extra fica mais caro

*início 0:47 · **caminho curto** (0:10) · **com a aplicação***

**O que dizer**

> A pergunta de toda a gestão: e se o orçamento for outro? Aqui está a cadeia. Com 40 mil euros por ano, a rede capta 364 toneladas a 66 euros por tonelada, e nem gasta o orçamento todo, porque o otimizador só abre o que compensa. Com 60 mil, o nosso B, 431 toneladas a 101,9. Com 90 mil, 525 toneladas, mas já a 139 euros por tonelada. Com 150 mil, 677 toneladas a 187 euros por tonelada. E o teto do modelo, sem limite de orçamento, 772 toneladas a 229 euros por tonelada: é o máximo que o modelo consegue sem contentores. Reparem na forma: cada euro extra compra menos têxtil, porque as primeiras toneladas estão nas freguesias densas e as últimas nas dispersas. É a fronteira de decisão: quem propõe o orçamento da rede responde com esta curva; quem corta o orçamento, também. E a comparação diz a robustez: em quantas amostras de incerteza a conclusão se mantém.

**Números no ecrã:** 364,3 t · 431,1 t · 525,3 t · 676,9 t · 772,1 t

**Na aplicação (/scenarios (cadeia de orçamentos))**

1. Selecionar os cenários 40, 60, 90 e 150 mil € e abrir a comparação
2. Ler as toneladas e o €/t de cada um
3. Dizer: quem propõe o orçamento responde com esta curva; quem corta, também
4. Mostrar a robustez da comparação (percentagem de amostras)

**Plano B:** diapositivo com a curva.

*Fontes no diapositivo:* Cenários «Demo · Por freguesia» (40, 90 e 150 mil €), B (60 mil €) e teto do modelo sem limite de orçamento; rotas pela estrada; 11 nov 2026 (modelo; estimativa)

#### 33. Por locais reais a rede serve mais gente (até 95,7%), mas custa mais por tonelada do que por freguesia

*início 0:51*

**O que dizer**

> A ferramenta desenha a rede de duas formas. Por freguesia: o modelo decide, para cada freguesia, o modo de recolha, local existente ou saco à porta, e põe um ponto no centro. Por locais reais: escolhe, entre os 1 273 candidatos, quais abrir, e uma paragem só conta como servida se estiver dentro do raio a pé, 300 ou 500 metros. Os números do mesmo orçamento, 60 mil euros: por freguesia, 431 toneladas e 70,4 por cento de cobertura; por locais reais a 300 metros, 475 toneladas e 87,8 por cento; a 500 metros, 550 toneladas e 95,7 por cento, mas com um custo por tonelada maior, 125 e 107 euros. O custo líquido sobe porque o saco à porta é mais caro agora que cada ronda sai do estaleiro, e o otimizador prefere paragens nos locais. Só com escolas, a rede fica curta: 180 toneladas e 30 por cento de cobertura. Uma nota de método: os cenários por locais têm o solver limitado por tempo e variam cerca de 1 por cento entre execuções e máquinas; só o cenário por freguesia é determinístico.

*Fontes no diapositivo:* Cenários «Demo · Locais reais» e B; 60 000 €/ano (30 000 €/ano nas escolas); rotas pela estrada; 11 nov 2026 (modelo; estimativa; os cenários por locais variam cerca de ±1% entre execuções) · 105,64 €/t (Vitrus)

#### 34. O plano de recolha diz o dia, a viatura e os quilómetros de cada freguesia, e as rotas seguem as estradas

*início 0:52 · **com a aplicação***

**O que dizer**

> O plano do dia da viatura. O mapa mostra, a verde, as freguesias servidas por locais existentes e, a outra cor, as de saco à porta; o traço cheio são as rotas, que seguem as estradas. A viatura sai do estaleiro da Polvoreira. Neste cenário, o saco à porta serve 3 freguesias, com 71,2 toneladas; e as paragens em locais existentes servem 43 freguesias, com 359,9 toneladas. O plano de recolha dá, para cada freguesia e canal, o dia da semana, a viatura, a frequência, a cada duas semanas, os quilos por ronda, e os quilómetros e horas por ano. As regras de atribuição são deterministas: as tarefas entram por ordem decrescente de horas, e cada uma fica no par viatura e dia com menos horas. O motorista não navega pela aplicação: a rota é o plano do dia. Hoje, com uma viatura, ocupa 1,66 dias por semana: sobra capacidade, e o modelo só compra uma segunda viatura quando as horas passam de 1 820 por ano.

**Números no ecrã:** 71,2 t · 359,9 t · 1 viatura

**Na aplicação (/scenarios/{B} → Rede e rotas)**

1. Abrir o separador «Rede e rotas» e mostrar o mapa com as rotas a partir do depósito
2. Dar zoom a uma rota: etiqueta «Por estrada»
3. Mostrar a tabela «Rotas»: viatura, modo, paragens, carga, distância, condução
4. Dizer: o motorista não navega pela app; a rota é o plano do dia

**Plano B:** diapositivo.

*Fontes no diapositivo:* Cenário B (resultado e collection_plan; 11 nov 2026; modelo; estimativa) · rotas OSRM sobre OpenStreetMap · estaleiro de Polvoreira (Vitrus)

#### 35. A rede serve 72,8% da população urbana e 55,5% do resto, e é isso que a diretiva pede para medir

*início 0:56 · **com a aplicação***

**O que dizer**

> A diretiva obriga a que a rede não se limite às zonas rendíveis. O Novelo mede-o com a matriz de cobertura, por tipologia de território do INE. Neste cenário, a população das freguesias predominantemente urbanas servida é 72,8 por cento; nas outras, mediamente urbanas e rurais, 21 370 habitantes, é 55,5 por cento. A razão entre as duas é 0,762: um indica a mesma cobertura. A freguesia predominantemente rural é uma só, Arosa e Castelões, com 699 habitantes, e fica sem recolha neste orçamento: a ronda até lá não compensa ao lado das outras. Isto é uma conversa de gestão, e a ferramenta põe-na em números: quanto custa subir essa cobertura? Foi por isso que escolhemos Arosa e Castelões para o ensaio das duas freguesias: é precisamente o sítio onde o modelo, com este orçamento, deixa de chegar.

**Números no ecrã:** 72,8% · 55,5% · 0,762

**Na aplicação (/scenarios/{B} → Cobertura)**

1. Mostrar a citação da diretiva (art. 22.º-C, n.º 9, al. b)
2. Ler «Não limitado às zonas rendíveis»: 55,5% contra 72,8%
3. Mostrar o quadro por tipo de território (APU, AMU, APR) e o concelho
4. Dizer: Arosa e Castelões fica sem serviço neste orçamento; é onde o modelo começa

**Plano B:** diapositivo.

*Fontes no diapositivo:* dados do ecrã (cenário B; 11 nov 2026; estimativa) · INE: TIPAU e Censos 2021 · Diretiva (UE) 2025/1892, art. 22.º-C, n.º 9, al. b)

#### 36. O intervalo provável do custo é de 82 a 140 €/t e quatro dos cinco maiores fatores são pressupostos sem dado

*início 0:59 · **com a aplicação***

**O que dizer**

> Todo o cenário traz o seu intervalo. Não resolvemos o otimizador outra vez em cada amostra: reavaliamos o modelo de custos sobre o plano já proposto, com os pressupostos perturbados em mais ou menos 30 por cento, 500 amostras e semente fixa, para responder à pergunta «o plano proposto aguenta se os pressupostos estiverem errados?». O resultado: o custo por tonelada vai de 81,6 no percentil 10 a 139,7 no percentil 90, com mediana 103,4. As toneladas, de 331 a 537. Dois factos para a gestão. Primeiro: o percentil 90, 139,7, está acima dos 105,64 euros de aterro evitado; nos casos pessimistas, o aterro evitado não paga a rede. Segundo: o tornado mostra o que mais pesa: a cobertura e a captura do local existente, mais ou menos 53,5 euros por tonelada cada; o têxtil por habitante, 38,4; o custo de uma recolha, 38,1; os quilos por saco, 28,7. Quatro dos cinco maiores são pressupostos sem dado da Vitrus: é onde os dados reais mais ajudam.

**Números no ecrã:** 81,6 · 103,4 · 139,7

**Na aplicação (/scenarios/{B} → Incerta)**

1. Abrir «Incerta» e mostrar «Quanto pode errar?»
2. Ler o intervalo provável: €/t entre P10 e P90, custo anual, toneladas
3. Apontar «Que pressupostos pesam mais» (tornado) e os selos «pressuposto»
4. Dizer: 4 de 5 fatores são pressupostos sem dado da Vitrus; é onde os dados reais mais ajudam

**Plano B:** diapositivo.

*Fontes no diapositivo:* Monte Carlo sobre o plano do cenário B: 500 amostras, semente 7, ±30%, distribuição triangular (11 nov 2026; estimativa) · «Dados e modelo», secção 5

#### 37. Pergunta-se em português e o otimizador responde com números verificados, nunca a IA

*início 1:03 · **caminho curto** (0:13) · **com a aplicação***

**O que dizer**

> O momento ao vivo. Pedimos a alguém da sala uma pergunta sobre a rede, em português, e escrevemo-la tal como foi dita. O Novelo mostra primeiro «Entendi: ...» para confirmarmos que percebeu bem. Só depois o otimizador corre. Quem calcula é o otimizador, o mesmo que fez os cenários todos; a IA só traduz a pergunta e explica o resultado, e um verificador rejeita qualquer número que não tenha saído da conta. À direita estão três exemplos já guardados. Se o orçamento subir de 60 para 90 mil euros: 525,3 toneladas, mas 139,1 euros por tonelada. Se Creixomil e Azurém só tiverem recolha a pedido: 397,5 toneladas, 105,4 euros por tonelada, menos têxtil e custo parecido. Se a captura da recolha a pedido for 30 por cento mais baixa: 428,9 toneladas, 100,1 euros por tonelada, quase nada muda, porque o saco à porta pesa pouco neste cenário. Cada resposta guarda a pergunta, a alteração, o cenário e a versão do prompt: tudo auditável.

**Números no ecrã:** 525,3 t · 139,1 €/t · 397,5 t · 428,9 t

**Na aplicação (/scenarios/{B} → E se...?)**

1. Perguntar a alguém da sala: «Dêem-me uma pergunta sobre esta rede»
2. Escrever a pergunta tal como foi dita
3. Esperar o «Entendi: ...» e confirmar
4. Ler a diferença em toneladas, €/t e custo; dizer que a IA nunca faz contas
5. Plano B: «E se o orçamento subir de 60 000 para 90 000 €?» (em cache)

**Plano B:** pergunta de reserva em cache.

*Fontes no diapositivo:* pergunta sobre o cenário B (3 perguntas do seed de demonstração; modelo de linguagem real; 11 nov 2026; estimativa) · «IA»

#### 38. A ferramenta desenha a rede à escala que se quiser: aqui, Aldão e Arosa e Castelões, as duas que o modelo aponta para começar

*início 1:06 · **com a aplicação***

**O que dizer**

> Mostrámos a rede do concelho. Mas a ferramenta desenha a rede à escala que se quiser. A título de exemplo, escolhemos duas freguesias com o próprio modelo: o ecrã do piloto faz uma pesquisa exaustiva e determinista e recomenda Aldão e a União das freguesias de Arosa e Castelões, porque juntas dão contraste: uma urbana, outra rural; densidades diferentes; ambas com três dias por semana de passagem do circuito de indiferenciado, o que dá hábito de pôr o lixo à porta em dias fixos; e custo de arranque baixo. O que o modelo prevê para três meses: 2,43 toneladas, com um intervalo de 1,87 a 2,99, acima do piso mínimo de 1,71 toneladas, que é o que é preciso recolher para medir a taxa de rejeito com três pontos percentuais de margem. Custo em regime: 538 euros por tonelada, entre 424 e 706, sem contar a viatura, que é da rede inteira e num ensaio pode ser alugada. Honestidade: como cenário autónomo, com a viatura toda a pagar-se só para duas freguesias, são 9,7 toneladas por ano a mais de mil euros por tonelada, o que serve para aprender a escala e não para desenhar a rede. Não estamos a pedir nada: se quiserem, está pronto.

**Números no ecrã:** 1,71 t · 2,43 t · 538 €/t · 9,7 t

**Na aplicação (/pilot e /scenarios/{Duas freguesias})**

1. Abrir /pilot: mostrar as duas freguesias recomendadas e porquê (território, densidade, hábito de dias fixos, custo de arranque)
2. Abrir o cenário «Duas freguesias»: rota até Arosa e Castelões
3. Mostrar o plano de recolha das duas freguesias: dia, ronda, kg por ronda
4. Dizer: não é um pedido; mostra a escala a que a ferramenta trabalha

**Plano B:** diapositivo.

*Fontes no diapositivo:* dados do ecrã (k = 2; 23 out 2026) e cenário «Duas freguesias» (11 nov 2026; modelo; estimativa) · «Dados e modelo», secção 5

#### 39. Do que se recolhe hoje ao teto do modelo sem contentores há uma margem de 2,6 vezes, e o potencial é quase 10 vezes maior

*início 1:10*

**O que dizer**

> Para pôr as coisas em escala. Hoje recolhem-se 301,3 toneladas. O cenário B chega a 431. A meta francesa, 4,27 quilos por habitante por ano, daria 669,7 toneladas; é uma referência de contentores de rua, por verificar, e só a usamos para comparar. O teto do modelo sem contentores, orçamento sem limite, são 772 toneladas, a 229 euros por tonelada e com duas viaturas; o teto com contentores de rua, só referência, seria 1 283 toneladas. E o potencial de têxtil por desviar são 3 003 toneladas. Quer dizer: com os modos que a Vitrus aceita, a rede chega a cerca de um quarto do potencial; o resto depende de coisas que o modelo ainda não tem: comportamento dos munícipes, canal B2B, triagem em casa. Por isso a conversa sobre a triagem e sobre os dados é a conversa que decide até onde se chega.

*Fontes no diapositivo:* Vitrus 2025 (301,3 t) · cenário B · referência francesa 4,27 kg/hab/ano (por verificar) · teto do modelo, 23 out 2026 («Dados e modelo», secção 5; estimativa) · 3 003,3 t: APA e Vitrus

### 05 · A prova: do saco ao fio

*1:11.* Quinto bloco: a prova. Uma rede destas ou se mede ou é opinião. Vamos percorrer o caminho de uma peça, da fotografia ao relatório de 2028. Os dados que aparecem são de demonstração, com fotografias reais de licença livre.

#### 41. Uma fotografia na entrega sugere tipo, estado, composição e marca; a decisão é sempre do operador

*início 1:12 · **com a aplicação***

**O que dizer**

> A triagem na entrega é o controlo de qualidade, e o problema da Vitrus é a contaminação. O operador fotografa a peça e, se houver, a etiqueta de composição. As fotografias vão, só em memória, a um modelo de visão, e voltam como uma sugestão: tipo de peça, estado, se é para reutilizar, reciclar ou rejeitar, composição por fibra e marca, quando legível. O operador confirma ou corrige: a decisão é sempre humana, a fotografia é o instrumento de medição. A peça entra no lote em curso. O peso é uma estimativa por tipo de peça, até haver balança no ponto. Uma ressalva que um técnico quer ouvir: ainda não corremos uma avaliação com verdade-terreno. A infraestrutura está feita, uma matriz de confusão, o custo e a latência por peça, mas precisa de pelo menos 30 peças já classificadas por uma pessoa; sem elas, não dizemos uma percentagem de acerto. Do custo, o modelo é configurável no painel de administração, com orçamento mensal e teto: são cêntimos por peça.

**Na aplicação (/triage)**

1. Fotografar a peça (camisola) e a etiqueta de composição
2. Carregar em «Analisar peça»; esperar a sugestão: tipo, estado (reutilizar, reciclar, rejeitar), composição, marca
3. O operador confirma ou corrige
4. A peça entra no lote em curso; mostrar o contador do lote
5. Se falhar: usar peça e etiqueta pré-fotografadas ou a miniatura do lote

**Plano B:** peça e etiqueta pré-fotografadas.

*Fontes no diapositivo:* «IA» · «Avaliação da triagem» · «Privacidade das fotografias»

#### 42. Cada lote tem um QR e uma página pública que responde à pergunta «para onde foi a minha roupa?»

*início 1:15 · **caminho curto** (0:16) · **com a aplicação***

**O que dizer**

> Cada peça triada entra num lote; cada lote tem um código e um QR. Este é o momento da apresentação: vamos passar o saco de demonstração à pessoa mais importante da sala, para ler o QR no seu telemóvel. O que abre é o passaporte do lote: origem, a freguesia; composição por fibra, ponderada pelo peso das peças; estado, reutilização, reciclagem, rejeito; peso, estimativa; e o histórico, recolhido, triado, reservado, entregue. É público, não precisa de conta, e responde à pergunta que todo o munícipe faz: para onde foi a minha roupa? Os campos seguem o que o plano municipal descreve para a primeira fase do Passaporte Digital do Produto dos têxteis, composição, reciclabilidade e rastreabilidade, por confirmar, para o Novelo encaixar quando a regra chegar. Os seis lotes de demonstração têm 24 peças com fotografias reais de licença livre, da Wikimedia Commons, com crédito do autor e da licença visível. Os dados de composição, nas peças sem etiqueta legível, são os que o operador confirma: pressuposto de demonstração, dito.

**Na aplicação (/lots e /passport/{código})**

1. Abrir /lots: 6 lotes de demonstração nos 4 estados (a recolher, triado, reservado, entregue)
2. Pegar no saco de demonstração com o QR do lote e passá-lo à pessoa mais importante da sala
3. Ela lê o QR com o telemóvel: abre o passaporte público, sem conta
4. Mostrar: origem (freguesia), composição, estado das peças, peso (estimativa), histórico
5. Voltar ao ecrã inicial: o fluxo (Sankey) engrossou

**Plano B:** abrir /pt/passport/{código} no portátil.

*Fontes no diapositivo:* «Funcionalidades», secção 2 · «Dados de demonstração» (6 lotes, 24 peças, fotografias da Wikimedia Commons com crédito) · plano municipal de Guimarães (Passaporte Digital do Produto)

#### 43. Quilos por marca e por fibra: a base local para a ecomodulação de 2028 e o material limpo que a indústria procura

*início 1:19 · **com a aplicação***

**O que dizer**

> Dois agregados que saem dos lotes. Do lado de quem paga: a evidência por marca. Na triagem, a fotografia da etiqueta dá também a marca, quando está visível. O Novelo soma quilos por marca e por composição ao longo do tempo. Em 2028, com a ecomodulação, quem vende moda rápida pode pagar mais; Guimarães chega a essa conversa com dados próprios, não com médias europeias. No relatório, aparece sempre com o tamanho da amostra, para não se tirarem conclusões de poucos lotes. Do lado de quem recicla: a bolsa de fibra. Os lotes juntam-se por fibra, algodão, lã, poliéster, e quem recicla no Vale do Ave consulta-os. É o material limpo e homogéneo que falta, segundo o plano municipal, para existir mercado de matérias-primas secundárias. Sem preços nem pagamentos neste momento: o valor está em tornar visível o material. E a prioridade é baixa, porque a Vitrus diz que reciclar custa mais do que fibra virgem: o valor está na reutilização. Os números dos ecrãs são de demonstração, e isso está dito.

**Na aplicação (/lots → Evidência por marca e Bolsa de fibra)**

1. Abrir «Evidência por marca»: quilos por marca e composição, com o tamanho da amostra
2. Abrir «Bolsa de fibra»: lotes agregados por fibra (algodão, lã, poliéster...)
3. Dizer: dados de demonstração; o tamanho da amostra aparece sempre

**Plano B:** diapositivo.

*Fontes no diapositivo:* «Funcionalidades», secções 2 e 5 · lotes de demonstração (composição de peças sem etiqueta: pressuposto de demonstração) · Diretiva (UE) 2025/1892 (ecomodulação)

#### 44. O dossiê para a mesa de 2028 sai num clique, com o método e a fonte de cada número

*início 1:22 · **caminho curto** (0:19) · **com a aplicação***

**O que dizer**

> Tudo o que vimos desagua aqui: o relatório para a responsabilidade alargada do produtor, num clique. O PDF abre com um resumo, com os números da casa: 3 003 toneladas por desviar, 301,3 recolhidas em 2025, captura de 9,1 por cento. Depois, o custo por tonelada por tipo de território, urbano, médio e rural; as toneladas por fibra e por destino, a partir dos lotes; os cenários comparados, com o investimento e o custo de operação; a evidência por marca, com a amostra; e o método e as fontes de cada número, com a etiqueta estimativa. Cada relatório fica guardado com data e versão dos parâmetros, para se poder reproduzir. É o dossiê com que a Câmara se senta à mesa de 2028, e a mesa muda: até abril de 2028, são os produtores a pagar o custo eficiente; quem lá chegar com números próprios por tipo de território e por marca, chega em posição de força. E está impresso: não depende do wi-fi.

**Na aplicação (/reports)**

1. Abrir /reports: histórico de relatórios, com data e versão dos parâmetros
2. Abrir o PDF RAP pré-gerado
3. Mostrar: resumo, custo por tipo de território, material por fibra, cenários, evidência por marca, método e fontes
4. Mostrar as cópias impressas para a pasta de cada pessoa

**Plano B:** cópias impressas.

*Fontes no diapositivo:* «Funcionalidades», secção 3 · dados do ecrã (PDF; WeasyPrint) · relatório gerado a 11 nov 2026 com os cenários B, A e Locais reais

#### 45. A resposta à sugestão de 4 de novembro: o munícipe fotografa a peça e recebe um conselho, sem conta e sem guardar nada

*início 1:26 · **com a aplicação***

**O que dizer**

> Uma resposta direta à sugestão de 4 de novembro da Vitrus: mover a triagem para antes da recolha. Fizemos a fase um: a página pública «Vai no saco?». O munícipe, em casa, fotografa a peça e recebe um conselho numa frase: esta toalha, molhada, fica fora; ou: esta camisola vai no saco. Não precisa de conta; a fotografia é analisada e apagada de imediato, não se guarda nada nem dados pessoais. Decidimos que é um conselho e não uma condição: ninguém precisa de autorização para pôr um saco à porta, e a recolha não recusa nada por causa dele. Isto evita atrito com o cidadão e evita criar uma exceção na operação. Analisámos as alternativas, condicionar a recolha com sacos pré-verificados, e pusemo-las de lado por agora: exigem logística de sacos marcados e punem quem não tem telemóvel; só se avalia se o ensaio mostrar abuso. A fase dois é a mesma verificação, mas pelo operador, à porta, no modo ronda, que dá o sinal verdadeiro para o planeamento: freguesia real, autenticado. Está proposta, não feita.

**Na aplicação (/bag-check (no telemóvel))**

1. Abrir /bag-check no telemóvel e fotografar a toalha velha (molhada)
2. Ler o conselho: «fica fora»; o motivo numa frase
3. Dizer: nada é guardado, ninguém é bloqueado; é conselho, não portagem

**Plano B:** captura no diapositivo.

*Fontes no diapositivo:* «Triagem pré-recolha» (fase 1 feita a 4 nov 2026) · dados do ecrã

#### 46. O candidato é o lugar, não o contentor; e lares e hotelaria são um canal à parte, com têxtil limpo de alto valor

*início 1:29 · **com a aplicação***

**O que dizer**

> Onde para a viatura? Em locais que já existem. O candidato é o lugar: o camião já passa, a licença já existe, o munícipe já lá vai. Nenhum saco fica na rua: a paragem é um encontro anunciado, o saco entrega-se à mão. Nas escolas, o saco espera dentro. A lista de candidatos é ordenada por uma regra explícita, sem pesos inventados: coordenada precisa primeiro, depois freguesia com mais lacuna estimada por candidato, depois contentor enterrado, depois orgânico a menos de 15 metros, depois mais contentores. Quando houver rede, a escolha dos pontos é vossa: a Vitrus passa a fixar, excluir e acrescentar pontos na plataforma, hoje só por freguesia e tipo. E há têxtil que não vem das casas: os lares e a hotelaria. São 26 estabelecimentos, 17 lares e 9 de hotelaria, em 15 freguesias: roupa de cama e toalhas, têxtil limpo, do mais alto valor de reutilização. É um canal à parte, já contado do pacote municipal. As toneladas não as sabemos: dizem «a medir no piloto», porque não há quilos por estabelecimento e não os inventamos. É provavelmente a tonelada mais barata e mais limpa que a rede consegue captar.

**Números no ecrã:** 1 187 · 86 · 26 · 17 · 9

**Na aplicação (/municipal)**

1. Separador «Candidatos a têxteis»: 1 187 locais, 837 com coordenada precisa; dizer que o candidato é o lugar
2. Apontar a regra de ordenação (sem pesos inventados)
3. Separador «Canal B2B»: 26 estabelecimentos (17 lares, 9 hotelaria) em 15 freguesias; toneladas «a medir no piloto»
4. Mostrar a exportação GeoJSON, CSV e XLSX: o QGIS da Vitrus entra aqui

**Plano B:** diapositivos 20 e este.

*Fontes no diapositivo:* dados do ecrã (pacote QGIS de 20 out 2026) · «Dados e modelo», secções 6 e 8 · nomes de produtores só para administradores

### 06 · Triagem à escala

*1:33.* Sexto bloco: a resposta à sugestão de 4 de novembro, passar parte da triagem para o munícipe, em casa. Analisámo-la a fundo. É uma proposta para desenharmos com a operação, não uma decisão fechada.

#### 48. Hoje são cerca de 1 milhão de peças por ano; o alvo são cerca de 10 milhões

*início 1:33*

**O que dizer**

> A conta que decide a triagem é a de escala. Com 0,3 quilos por peça, que é pressuposto, as 301 toneladas de hoje são cerca de um milhão de peças por ano. O alvo, 3 003 toneladas, são cerca de dez milhões. Tudo o que for «peça a peça» tem de se pensar nessa ordem de grandeza: dez milhões de decisões por ano. A direção que a Vitrus sugeriu, a de que o cidadão participe na separação, está certa; o que muda com a escala é a letra: o que serve para um milhão de peças não serve para dez.

**Números no ecrã:** ≈ 1 M peças · ≈ 10 M peças

*Fontes no diapositivo:* 301,3 t e 3 003,3 t (Vitrus; APA; estimativa) · 0,3 kg por peça (pressuposto) · análise da equipa

#### 49. Dois extremos não funcionam: triar peça a peça custa 32 a 48 pessoas, e não controlar à entrada deixa passar 56,9% de rejeito

*início 1:35*

**O que dizer**

> Os dois extremos. Primeiro, triar tudo, peça a peça, seja quem for a fazê-lo: com operadores são 32 a 48 pessoas a tempo inteiro, 55 a 83 mil horas por ano; com inteligência artificial, 24 500 a 98 mil euros por ano, estimativas. Segundo, o oposto: não controlar nada à entrada. É o cenário que a Vitrus conhece: o canal sem triagem deu 56,9 por cento de rejeito numa amostra de 5,6 toneladas, e à escala do alvo seriam cerca de 1 709 toneladas por ano desperdiçadas. Entre os dois, há um desenho por camadas, que vem no diapositivo seguinte.

**Números no ecrã:** 32 a 48 ETC · 24,5 a 98 mil € · 56,9% · 1 709 t

*Fontes no diapositivo:* Análise da equipa (estimativas) · To Be Green/Vitrus 2025 (56,9%, amostra de 5,6 t) · 3 003,3 t × 56,9% ≈ 1 709 t

#### 50. Analisámos sete abordagens, e a triagem partilhada em camadas é a que se aguenta à escala do alvo

*início 1:36*

**O que dizer**

> As sete abordagens analisadas. A, o statu quo, o operador triar peça a peça: não escala, fica como auditoria. B, o cidadão triar peça a peça em casa: a participação morre. C, declaração do saco sem verificação: reproduz os 56,9 por cento. D, triagem partilhada em camadas: a recomendada. E, a versão mínima, dois sacos e verificação à porta: o arranque. F, pontos comunitários, escolas e juntas: complemento educativo. G, externalizar nos licenciados, o que se faz hoje: sem dados próprios para 2028. As linhas B, C e G ficam riscadas porque não funcionam à escala; a D é a recomendada; a E é por onde se começa.

*Fontes no diapositivo:* Análise da equipa · AEA (2024) · Fashion for Good, Sorting for Circularity (2025) · estimativas

#### 51. A proposta tem cinco camadas: dois sacos, declaração opcional, verificação de 10 segundos, auditoria por amostragem e feedback

*início 1:38 · **caminho curto** (0:22)*

**O que dizer**

> As cinco camadas, de cima para baixo. Um: dois sacos de cor, verde para «vestir de novo» e azul para «deu a vida», com a regra de três perguntas impressa. Dois: declaração opcional por QR, trinta segundos, que funciona sem aplicação. Três: verificação à porta, dez segundos, com três resultados: conforme, em dúvida, recusado. Quatro: auditoria por amostragem, cerca de 20 por cento, com a triagem por fotografia que já existe; 385 sacos por trimestre dão uma margem de mais ou menos 5 pontos percentuais a 95 por cento. Cinco: feedback ao munícipe, educativo, nunca multa. Em números: duas a três pessoas a tempo inteiro para o concelho, em vez de 32 a 48; os sacos custam entre 50 e 200 mil euros por ano no pico, cerca de um milhão de sacos a 5 a 20 cêntimos cada; e o aterro evitado no alvo, 317 269 euros por ano, paga-os. Tudo estimativa. E começa-se pelo mínimo, dois sacos e a porta; o digital liga ao segundo mês.

**Números no ecrã:** 2 a 3 ETC · 50 a 200 mil €/ano · 317 269 €/ano · 385 sacos

*Fontes no diapositivo:* Análise da equipa (estimativas) · amostragem: n = 385 sacos por trimestre para ±5 p.p. a 95% · 3 003,3 t × 105,64 €/t (cálculo)

#### 52. Se houver um ensaio, três métricas dizem se a proposta funciona: conformidade, rejeito do verde e recusados à porta

*início 1:39*

**O que dizer**

> Uma proposta só vale se se puder medir. Se houver um ensaio, propomos três métricas: conformidade dos sacos, pelo menos 80 por cento; rejeito do saco verde, no máximo 15 por cento, que é próximo dos 14,1 por cento que a Vitrus mede hoje; e sacos recusados à porta, menos de 5 por cento. Para o ensaio ter sinal, o modelo calcula um piso de toneladas: com o rejeito a 14,1 por cento e uma margem de 3 pontos percentuais, e um efeito de desenho de 2, porque as peças de um mesmo saco não são independentes, são cerca de 1 030 peças por célula, 0,43 toneladas; com duas freguesias e dois modos, 1,71 toneladas em três meses. Os pressupostos de amostragem estão assinalados para validar.

*Fontes no diapositivo:* Proposta da equipa · «Dados e modelo», secção 5 (piso de sinal: p = 14,1%, h = 3 p.p., deff = 2; 0,415 kg por peça)

### 07 · Riscos e validação

*1:41.* Sétimo bloco: honestidade. O que está validado e o que não está, o que pode correr mal e quem o resolve. Quem vai dar seguimento a isto precisa de ver os riscos escritos.

#### 54. O potencial foi triangulado por quatro leituras e a procura por freguesia explica 76% da distribuição dos contentores

*início 1:41 · **com a aplicação***

**O que dizer**

> Como validámos o modelo, e o que não conseguimos validar. Só há um ano de têxtil, 2025, em totais anuais por entidade; por isso não há backtest temporal e não fingimos um. O que fizemos: a triangulação do potencial. A leitura principal, a da Vitrus e da APA, dá 19,15 quilos por habitante por ano por desviar, captura de 9,1 por cento. Outras leituras publicadas: 4,55 por cento de 517 quilos da composição dos resíduos em Portugal, 23,5 quilos; 5,4 por cento de 315 quilos, 17,0; e os 0,7 quilos por mês do plano municipal, 8,4 quilos por ano, que a Vitrus não usa. A banda está entre 8 e 24 quilos: o nosso valor está dentro dela. Depois, a validação cruzada espacial: cada freguesia prevista só com as outras 47, na proporção da população, e comparada com os contentores que lá estão. R² de 0,76 e erro mediano de 36 por cento em todos os contentores; 0,84 nos enterrados; 0,06 nos de superfície, onde a população não diz onde estão. Isto não prova a procura de têxtil: mostra que a população é um proxy razoável do sítio onde a recolha existe.

**Números no ecrã:** 19,15 · 23,5 · 17,0 · 8,4 · R² 0,76

**Na aplicação (/validation)**

1. Abrir /validation: triangulação do potencial e validação cruzada espacial
2. Dizer: não há backtest temporal porque só há 2025; não fingimos um

**Plano B:** diapositivo.

*Fontes no diapositivo:* «Dados e modelo», secção 7 (ecrã /validation) · 5,86% × 51 250,6 t; 4,55% × 517 kg; 5,4% × 315 kg; 0,7 kg/hab/mês · validação cruzada deixando uma freguesia de fora (48 freguesias)

#### 55. Dez riscos conhecidos, cada um com a sua mitigação e quem a fecha

*início 1:45*

**O que dizer**

> O registo de riscos. Lê-se por linhas. Captura sem dado local: são os pressupostos mais sensíveis, e fecham-se com recolha real. Custos por hora e por quilómetro: dependem do financeiro da Vitrus. Contaminação: dois sacos, verificação à porta, auditoria, nunca multa. As 350 coordenadas aproximadas: validação no terreno. O têxtil por habitante igual em todo o concelho: uma caracterização do indiferenciado resolve. A triagem por foto sem avaliação: precisa de 30 peças classificadas. A dependência de um serviço externo de IA: sem a chave, a aplicação arranca e só as funcionalidades de IA respondem 503. A carga útil real da viatura: ficha técnica. A participação do munícipe: só o ensaio responde. E o RGPD: a nossa análise é técnica, e tem de ser validada pelo encarregado de proteção de dados.

*Fontes no diapositivo:* «Dados e modelo» (pressupostos e limites) · «Privacidade das fotografias» · «Avaliação da triagem» · análise da equipa

#### 56. A fotografia vive em memória, a miniatura é opcional e apaga-se aos 90 dias, e ninguém identifica quem entrega

*início 1:46*

**O que dizer**

> Privacidade e segurança, resumidas. Uma nota de método: a nossa avaliação de privacidade é técnica, lida no código, e não é aconselhamento jurídico; a base jurídica, a avaliação de impacto e os textos de informação têm de ser validados pelo encarregado de proteção de dados da entidade responsável, a Vitrus ou o município. O que o código faz: a fotografia da triagem vive só em memória durante o pedido. O operador pode guardar, por peça, uma miniatura opcional, de no máximo 640 pixéis e 150 quilobytes, sem metadados, reconstruída só com os píxeis, depois de confirmar que não há pessoas; é apagada ao fim de 90 dias. Nunca se guardam dados de quem entregou a peça. A marca é de uma empresa, não de uma pessoa. Os nomes de produtores, estabelecimentos privados, só os vê um administrador. Quanto a segurança: contas com aprovação, pedidos limitados e auditoria das ações de administração.

*Fontes no diapositivo:* «Privacidade das fotografias» (avaliação técnica, não aconselhamento jurídico) · «Arquitetura» e ambiente.md · estado a 23 out 2026

### 08 · Seguimento e conversa

*1:48.* Último bloco: o que se segue. Não há pedidos: há uma lista de dados que só a Vitrus tem, uma sessão com a operação e a oferta do que somos. Depois, a vossa vez.

#### 58. Dez dados que só a Vitrus tem fecham a maior parte da incerteza, e é cerca de meio dia de trabalho

*início 1:48 · **caminho curto** (0:24)*

**O que dizer**

> O primeiro passo do que se segue é fechar os dados. Dez itens, com quem os tem e o que muda no modelo. Os euros por hora e por quilómetro das viaturas, que o financeiro ainda não enviou. Os quilos mensais por entidade, que permitem série temporal. O tempo e o custo de uma paragem num local municipal. O orçamento dos sacos. A folha de turnos corrigida, e a confirmação de que duas viaturas estão ativas. A ficha técnica da viatura escolhida: carga útil e preço. Uma caracterização do indiferenciado, que substitui os 5,86 por cento nacionais. A confirmação das três localidades sem freguesia. A validação no terreno das 350 coordenadas aproximadas. E a decisão sobre a exposição dos nomes de produtores. É cerca de meio dia de trabalho vosso, e a plataforma afina-se toda: os pressupostos saem, entram os vossos valores.

*Fontes no diapositivo:* «Dados e modelo» (pressupostos e perguntas abertas) · «Análise dos dados recebidos»

#### 59. Uma sequência possível: dados e sessão com a operação agora, calibração em dois meses, e 2028 como horizonte

*início 1:50*

**O que dizer**

> Uma sequência possível, que é proposta e não compromisso. Agora, nas próximas duas semanas: fechar os dez dados e fazer uma sessão com a operação. Nessa sessão, a triagem e a rede desenham-se com quem as faz: a nossa análise está na mesa, falta a vossa leitura, o que está certo, o que é ingénuo, o que falta. Em um a dois meses: substituir pressupostos por valores reais, validar no terreno as coordenadas aproximadas, avaliar a triagem por foto com pelo menos 30 peças classificadas, e fechar a regra das paragens vazias, a paragem que sai da rota depois de três rondas consecutivas vazias, sempre anunciado. Depois, se fizer sentido, um ensaio com métricas, que já está desenhado, e a edição dos pontos pela Vitrus na própria plataforma. O horizonte é abril de 2028, com o relatório RAP já com números do concelho. Não pedimos nenhum piloto: se a Vitrus o propuser, aceitamos na hora.

*Fontes no diapositivo:* Proposta da equipa; datas por acordar com a Vitrus · Diretiva (UE) 2025/1892 (17 abr 2028)

#### 60. A plataforma fica: já está em produção e nós mantemos, desenvolvemos e desenhamos a rede convosco

*início 1:51 · **caminho curto** (0:25)*

**O que dizer**

> O que somos e o que fica. Somos quem construiu a plataforma, e é isto que sabemos fazer: programar soluções sobre dados reais. O que já existe: uma plataforma em produção, com os dados da Vitrus, os pressupostos todos visíveis e editáveis, e documentação completa em português, para quem vier a trabalhar com isto ter tudo escrito. O que fazemos: consultoria e solução tecnológica; mantemos a plataforma, desenvolvemo-la ao ritmo que a operação pedir, e desenhamos a rede convosco. E o que precisamos de vocês: os dados da lista, uma sessão com a operação, e a vossa leitura crítica. O que se faz a seguir é o que fizer sentido para vocês.

*Fontes no diapositivo:* novelo.helder.si · documentação do projeto (em português)

#### 61. Duas perguntas para começar, e seis para a operação e para a gestão

*início 1:53*

**O que dizer**

> Antes de responder ao que vos ocorrer, duas perguntas nossas, e ouvimos sem contestar. Primeira: o que é que o Novelo teria de fazer para entrar no vosso dia a dia, não em abril de 2028, na segunda-feira? Segunda: o que é que não vos convence nos números? Onde é que carregam? As respostas são o que mais nos ajuda, e vamos tomar nota. As seis seguintes são perguntas de reserva, se a conversa precisar de um ponto de partida. Se a Vitrus propuser um ensaio, uma freguesia, um contacto ou uma data: aceitamos na hora, agradecemos e anotamos.

*Fontes no diapositivo:* Guião de ensaio (perguntas nossas primeiro) · «Dados e modelo»

### 09 · Quem somos

*1:54.* Para fechar, dois minutos sobre quem somos, o que aconteceu no Hack4Guimarães e o que se escreveu. Não é para falar de nós: é para que fique claro de onde vem este trabalho.

#### 63. Dois engenheiros informáticos de Barcelos desenharam, programaram e puseram o Novelo em produção

*início 1:55*

**O que dizer**

> Quem somos, em poucas palavras. Hélder Gonçalves e Flávio Fernandes, os dois de Barcelos, com formação em Engenharia Informática na Universidade Politécnica de Viana do Castelo. Um traço que a imprensa notou e que nos define melhor do que um currículo: os dois vêm do ciclismo, e o Hélder foi ciclista profissional no pelotão nacional até aos 25 anos. É uma escola de paciência e de regularidade, que ajuda num trabalho como este. O Novelo nasceu em cinco dias de maratona no Hack4Guimarães, e a parte de que mais nos orgulhamos é a seguinte: quando os mentores da Vitrus nos disseram que não querem contentores de têxtil nem o camião do lixo, refizemos o modelo em dois dias. Desde então, ligámos os dados reais, as rotas pelas estradas e o relatório para 2028, e a plataforma está em produção.

*Fontes no diapositivo:* ECO, 3 nov 2026 · O Minho, 28 out 2026 · Rádio Alto Minho, 29 out 2026 · Mais Guimarães, 28 out 2026

#### 64. O Novelo ganhou o concurso geral do Hack4Guimarães 2035 e o desafio TexVitrus, 8 500 € em prémios

*início 1:56*

**O que dizer**

> O reconhecimento, com os factos. O Hack4Guimarães 2035 foi uma maratona de cinco dias, de 19 a 23 de outubro de 2026; as equipas apresentaram a 26 de outubro; e a entrega de prémios foi a 28 de outubro, no encerramento do Mês da Economia de Guimarães, com a presença do presidente da Câmara, Ricardo Araújo, e do presidente da CCDR-Norte, Álvaro Santos. O Novelo ficou em primeiro lugar no concurso geral, 7 500 euros, e ganhou também o desafio TexVitrus, lançado pela Vitrus Ambiente, 1 000 euros: 8 500 euros no total. A fotografia é da cerimónia, do Município de Guimarães, publicada pelo Jornal T. Dizemo-lo para uma razão só: foi esse desafio, e foram os dados que a Vitrus abriu, que tornaram o resto possível.

**Números no ecrã:** 1.º lugar · 7 500 € · 1 000 € · 8 500 €

*Fontes no diapositivo:* Mais Guimarães, 28 out 2026 · O Minho, 28 out 2026 · O Amarense, 30 out 2026 · Imagem: Município de Guimarães, via Jornal T (2 nov 2026)

#### 65. Dez órgãos de comunicação noticiaram o Novelo entre 28 de outubro e 3 de novembro

*início 1:58*

**O que dizer**

> O que se escreveu. Dez órgãos de comunicação noticiaram o projeto entre 28 de outubro e 3 de novembro: o ECO, o Jornal T, o O Minho, o E24, o O Amarense, a Rádio Alto Minho, a Rádio Fundação, o Mais Guimarães, a Portugal Têxtil e a FashionNetwork. Mostramos seis, só para se ver o tom. Não é o que mais importa, mas serve para dizer duas coisas: o problema dos têxteis em Guimarães interessa a quem lê, e a Vitrus e o Município ficaram associados a uma resposta concreta a esse problema, em vez de a mais um estudo.

*Fontes no diapositivo:* Capturas dos artigos (primeiro ecrã), obtidas a 11 nov 2026 · direitos de cada órgão de comunicação

#### 66. O que a imprensa escreveu sobre o problema e sobre a solução

*início 1:59*

**O que dizer**

> Três frases, de três artigos. A primeira é do Hélder ao ECO e resume o projeto: ajudar o município a decidir como recolher mais têxtil, ao menor custo, para que do saco se possa voltar ao fio. A segunda, do Mais Guimarães, diz o problema: nove em cada dez quilos de têxtil descartado acabam no lixo comum. A terceira é da própria Vitrus, citada pelo O Minho: a reflexão sobre novas soluções para a economia circular e a valorização destes materiais. É esta última que nos interessa mais: o desafio era da Vitrus, e é com a Vitrus que queremos continuar.

*Fontes no diapositivo:* ECO, 3 nov 2026 (Hélder Gonçalves) · Mais Guimarães, 28 out 2026 · O Minho, 28 out 2026 (Vitrus Ambiente)

#### 67. Obrigado

*início 2:01 · **caminho curto** (0:27)*

**O que dizer**

> Para acabar, o agradecimento. À Vitrus Ambiente, pelo desafio, pelos dados e pela franqueza com que os mentores nos disseram o que não queriam: foi isso que desenhou a rede. Ao Município de Guimarães, e ao senhor presidente, pela oportunidade de apresentar este trabalho. E a vós todos, pelo tempo. Somos o Hélder Gonçalves e o Flávio Fernandes, e o Novelo está em novelo.helder.si. Agora, a vossa vez: tudo o que quiserem perguntar, discutir ou criticar.

### A · Anexos

*Anexos.* Anexos de consulta: só se abrem se houver pergunta.

#### 69. Números canónicos: cada valor, a sua origem e o seu selo

*anexo*

**O que dizer**

> Tabela de consulta. Todos os números usados nesta apresentação, com a origem e o selo. Se alguma coisa for citada que não está aqui, é porque não a usámos.

*Fontes no diapositivo:* «Dados e modelo» · dados do cenário B (11 nov 2026)

#### 70. Um contrato único liga os dados, o otimizador e a app: o que o ecrã mostra é o que a API calcula

*anexo*

**O que dizer**

> A arquitetura, para quem vai manter isto. Da esquerda para a direita. Os dados brutos, Excel e QGIS, entram por um ETL em Python que gera ficheiros limpos e regeneráveis. Esses ficheiros importam-se para uma base PostgreSQL, num seed idempotente. A API é FastAPI em Python 3.12, organizada por funcionalidades, e o domínio, as fórmulas e a otimização, são funções puras, testadas com valores calculados à mão. O otimizador é OR-Tools: CP-SAT para escolher locais e modos, e VRP para as rotas. As distâncias vêm de um OSRM nosso sobre o OpenStreetMap. A IA, via OpenRouter, só traduz perguntas e explica resultados. Depois o contrato OpenAPI é exportado e dele geramos o cliente TypeScript: a app web nunca faz fetch à mão. A app é React com TanStack, instalável como aplicação. Tudo corre em contentores, em produção numa VPS gerida pelo Coolify, com deploy a cada merge na main. O repositório é público.

*Fontes no diapositivo:* «Arquitetura» · produção: novelo.helder.si (Coolify numa VPS)

#### 71. Stack e entrega técnica: o que está em cada camada e como se verifica

*anexo*

**O que dizer**

> Anexo para quem vai dar seguimento técnico. A API é FastAPI em Python 3.12, organizada por funcionalidades, com mypy estrito e Ruff; o domínio, as fórmulas e a otimização, são funções puras testadas com valores calculados à mão. O otimizador é OR-Tools. As rotas usam um OSRM próprio. A web é React com Vite e TanStack, estrita em TypeScript. O contrato OpenAPI é exportado e dele se gera o cliente. A verificação é local: just check-fast em menos de 90 segundos e just check completo, sem integração contínua remota por agora. O deploy é automático a cada merge na main, em contentores.

*Fontes no diapositivo:* «Arquitetura» · «Testes» · «Deploy»

#### 72. Perguntas esperadas da operação e respostas curtas

*anexo*

**O que dizer**

> Respostas de 20 segundos às perguntas mais prováveis da operação. Se a pergunta não tiver resposta aqui: «boa pergunta, anotamos e respondemos com número».

*Fontes no diapositivo:* «Plano da sessão», secção 6 · «Dados e modelo»

#### 73. Perguntas esperadas da gestão e do município e respostas curtas

*anexo*

**O que dizer**

> Respostas curtas às perguntas de gestão. Os números são os do cenário B; qualquer dúvida remete-se para o anexo de números canónicos.

*Fontes no diapositivo:* «Plano da sessão», secção 6 · cenário B (11 nov 2026) · Diretiva (UE) 2025/1892

#### 74. Fontes e documentação de apoio

*anexo*

**O que dizer**

> Onde está cada coisa. A documentação está no repositório, em português, com índice em docs/README.md.

*Fontes no diapositivo:* índice da documentação (índice completo)

## 6. Perguntas esperadas e respostas curtas

**As nossas primeiro, sempre.** Ouvir sem contestar, tomar nota, não responder a objeções antes de acabar:

1. «O que teria o Novelo de fazer para entrar no vosso dia a dia, na segunda-feira e não em 2028?»
2. «O que não vos convence nos números? Onde é que carregam?»

Se a Vitrus propuser um ensaio, uma freguesia, um contacto ou uma data: **aceitar na hora**, agradecer e anotar. Não empurrar mais nada.

### Da operação

| Pergunta | Resposta (20 segundos) |
| --- | --- |
| O munícipe não vai pôr lixo no saco? | O peso denuncia, o motorista recusa à porta com nota educativa, e nunca se paga por quilo nem por peça. Os 56,9% vieram do canal sem controlo; a porta é o controlo. |
| O saco não fica na chuva num local público? | O candidato é o lugar, não o contentor: a paragem é um encontro anunciado e o saco entrega-se à mão. Quem não puder estar à hora guarda o saco para a ronda seguinte ou leva-o a um ponto assistido, onde espera dentro. |
| Podemos escolher os pontos? | Sim. Hoje restringe-se por freguesia e tipo; com rede, a Vitrus fixa, exclui e acrescenta pontos na plataforma. As 350 coordenadas aproximadas confirmam-se no terreno. |
| Como sabem que a escola tem sacos? | A viatura pára sempre no dia anunciado e a escola avisa por telefone, como hoje; o sinal digital vem depois e serve para prever, nunca para autorizar. Com dados, a paragem vazia (3 rondas seguidas) sai da rota, sempre anunciado. |
| O motorista anda com telemóvel? | Um Android da viatura (150 a 300 €), 3 botões, QR, offline. A rota é o plano do dia; ele não navega pela aplicação. |
| E se o munícipe não puser o saco no dia? | Guarda-o para a ronda seguinte (a cada 2 semanas) ou leva-o a um ponto assistido. Sem marcação nem aplicação. |
| A cada 2 semanas não é pouco (ou muito)? | É um pressuposto editável, com sensibilidade; a recolha real calibra o intervalo com número, não com opinião. |
| Que viatura e quanto custa? | Furgoneta de caixa fechada sem compactação, 42 500 € (adjudicação de Gaia; pressuposto, por confirmar no portal Base). Os €/h e €/km são um dos dados a fechar. |
| Isto substitui as entidades que triam? | Não; continuam a triar profissionalmente. O Novelo é a camada de decisão e de evidência, e a bolsa liga-as ao material por fibra. |
| Fotografias, marcas, RGPD? | A foto vive em memória durante o pedido; a miniatura é opcional, sem metadados, apagada aos 90 dias; a marca é de uma empresa, nunca de uma pessoa. A análise é técnica e carece de parecer do encarregado de proteção de dados. |
| Quanto custa a IA? | Cêntimos por peça, com orçamento mensal e teto; sem chave de IA o resto da aplicação funciona. |
| Qual é a exatidão da triagem por foto? | Ainda não a medimos com verdade-terreno: a avaliação está preparada e precisa de pelo menos 30 peças classificadas por uma pessoa. Até lá não damos uma percentagem. |

### Da gestão e do município

| Pergunta | Resposta (20 segundos) |
| --- | --- |
| Quanto custa ao município? | Com 60 000 €/ano, o aterro evitado (45 542 €) paga a operação: custo líquido de −1 628 €/ano no caso central. Estimativa; no percentil 90 do custo por tonelada (139,7 €/t) já não chega, e por isso há números a fechar e rede a medir. |
| O que ganha o cidadão? | Saco grátis, dia fixo e resposta: o passaporte diz para onde foi a roupa. Sem aplicação obrigatória. |
| O que muda em 2028? | Os produtores pagam o custo eficiente, determinado com as autoridades locais. Guimarães chega a essa mesa com números próprios por tipo de território e por marca. |
| E o emprego e a economia social? | Os lotes por fibra ligam ao tecido do Vale do Ave; as entidades que hoje recolhem as 301 t continuam e ganham mais material e evidência. |
| Funciona noutros concelhos? | Sim: INE, OpenStreetMap e CAOP são de todos; faltam os custos locais. Guimarães seria o primeiro. |
| Porque é que o contentor de rua (cenário A) não é a proposta, se capta mais? | Porque a Vitrus não o quer (a contaminação estraga a reutilização) e o modelo não desconta essa contaminação: o A fica como referência, nunca como proposta. |
| Quem mantém isto? | Nós: é a oferta. Mantemos, desenvolvemos e desenhamos a rede convosco. A contratação pública segue o caminho que a Vitrus e o município indicarem. |
| E a To Be Green? | Complementar: eles trabalham o cidadão e a reutilização; o Novelo, a decisão e a evidência de quem opera a recolha. |

## 7. Números de referência

Os números abaixo são os do deck. Os do cenário B e dos orçamentos vêm do modelo, recalculado a 11 nov 2026 (rotas pela estrada); os de documentação são de 23 out 2026. Entre execuções, os cenários por locais reais variam cerca de ±1%.

| Número | Valor | Origem | Selo |
| --- | --- | --- | --- |
| Têxtil recolhido à parte, 2025 | 301,3 t (0,16 kg/hab/mês) | Vitrus, 4 entidades | medido |
| Destino do recolhido | 59,4% reutilização · 26,5% reciclagem · 14,1% rejeito | Vitrus, 2025 | medido |
| Rejeito por canal | Ultriplo 14,5% · H Sarah Trading 13,0% · Nova Etapa 10,0% · recolha Vitrus (amostra de 5,6 t) 56,9% | Vitrus e To Be Green | medido; a amostra é estimativa |
| Indiferenciado do concelho | ≈ 51 250,6 t = 43 050,5 t ÷ 0,840 | Vitrus (R&C 2025, p. 8) | estimativa |
| Têxtil por desviar | ≈ 3 003,3 t/ano (1,596 kg/hab/mês) | 51 250,6 t × 5,86% (APA, RARU 2025, p. 24) | estimativa |
| Captura atual | 9,1% (≈ 3 304,6 t geradas) | cálculo | estimativa |
| Tratamento do indiferenciado | 105,64 €/t = 40 € (TGR) + 65,64 € (Resinorte) | Vitrus, 22 out 2026 | medido |
| Prazo da RAP têxtil | 17 abr 2028 (522 dias a 12 nov 2026) | Diretiva (UE) 2025/1892 | público |
| Rede municipal | 2 751 contentores, 2 026 locais, 48 freguesias, 156 830 habitantes | pacote QGIS (20 out 2026); INE | medido |
| Candidatos a paragem | 1 187 públicos + 86 escolas = 1 273 (837 precisos; 350 aproximados) | pacote QGIS; verificado a 11 nov 2026 | medido |
| Viatura | 42 500 €, 8 anos (5 312,50 €/ano), 2 t, 30 km/h, 1 820 h/ano | Gaia (TED) e equipa | pressuposto |
| Cenário A (contentor de rua, só referência) | 652,1 t · 71,7 €/t · 46 738 € · 75,9% de cobertura | modelo | estimativa |
| **Cenário B, 60 000 €/ano** | **431,1 t · 101,9 €/t · 43 914 € · 70,4% de cobertura** | modelo | estimativa |
| Custo do cenário B | operação 35 702 € + viatura 5 312,50 € + locais 2 900 € | modelo | estimativa |
| Tratamento evitado e custo líquido (B) | 45 542 € e −1 628 €/ano (−3,8 €/t) | modelo | estimativa |
| Reutilizável (B) | 256,1 t (215,6 a 314,1); 171,5 €/t reutilizável | modelo | estimativa |
| Intervalo do €/t (B) | P10 81,6 · P50 103,4 · P90 139,7; toneladas 331 a 537 | Monte Carlo, 500 amostras | estimativa |
| Orçamentos (por freguesia) | 40 k€: 364,3 t, 66,0 €/t · 90 k€: 525,3 t, 139,1 €/t · 150 k€: 676,9 t, 186,6 €/t · teto: 772,1 t, 228,9 €/t | modelo | estimativa |
| Por locais reais, 60 000 €/ano | 300 m: 474,6 t, 125,6 €/t, 87,8% · 500 m: 549,5 t, 107,3 €/t, 95,7% | modelo (±1%) | estimativa |
| Cobertura (B) | urbanas 72,8% · mediamente urbanas 57,4% · rural 0% · restante 55,5% · razão 0,762 | modelo | estimativa |
| Desvio estrada ÷ linha reta | mediana 1,48 (freguesias) e 1,37 (locais); inicial 1,3 | calibração OSRM, 23 out 2026 | medido |
| Duas freguesias (ensaio, 3 meses) | piso 1,71 t; previsto 2,43 t (1,87 a 2,99); 538 €/t (424 a 706), sem a viatura | modelo | estimativa |
| Escala | ≈ 1 M peças (301 t) → ≈ 10 M peças (3 003 t), a 0,3 kg por peça | pressuposto | estimativa |
| Triagem peça a peça | 32 a 48 ETC; 55 000 a 83 000 h/ano; IA 24,5 a 98 mil €/ano | análise da equipa | estimativa |
| Triagem em camadas | 2 a 3 ETC; sacos 50 a 200 mil €/ano no pico; aterro evitado 317 269 €/ano; 385 sacos por trimestre dão ±5 p.p. a 95% | análise da equipa | estimativa |
| Métricas do ensaio | conformidade ≥ 80% · rejeito do verde ≤ 15% · recusados à porta < 5% | proposta | proposta |

## 8. Regras de ouro

1. **Nunca procurar um ecrã ao vivo:** tudo aberto por ordem antes de entrar.
2. **Só dois momentos ao vivo** na versão curta («E se...?» e o QR); na completa, todos os do guião, com plano B à mão.
3. **Se algo falhar:** dizer a frase do plano B, sem desculpas longas, e seguir (os ecrãs estão nos diapositivos).
4. **Nenhum número sem o seu selo:** «estimativa» diz-se sempre.
5. **Não sabes?** «Boa pergunta, anotamos e respondemos com número.»
6. **Uma frase por ecrã e apontar:** não ler o ecrã em voz alta.
7. **O QR lê-se no telemóvel da pessoa mais importante da sala**, com o saco na mão dela.
8. **Falar com a Vitrus, não para o projetor:** a aplicação é o pretexto, a conversa é o objetivo. A ferramenta ajuda a decidir; não decide por eles.
9. **Honestidade antes de entusiasmo:** dizer o que não está medido (exatidão da triagem, preço da viatura no Base, captura por modo) antes de ser perguntado.

## 9. Plano B

| Falha | O que fazer |
| --- | --- |
| Sem rede ou produção em baixo | Os diapositivos têm as capturas de todos os ecrãs; relatório RAP impresso; hotspot do telemóvel como rede de reserva. |
| IA sem saldo ou sem resposta | «E se...?» com a pergunta de reserva em cache («E se o orçamento subir de 60 000 para 90 000 €?»); na triagem, usar a peça e a etiqueta pré-fotografadas ou o lote existente. O resto da aplicação não depende da IA. |
| QR não abre | Abrir `/pt/passport/{código}` no portátil e mostrar no ecrã. |
| Projetor falha | A aplicação no telemóvel (PWA) e o relatório impresso; os diapositivos são apoio, não a espinha dorsal. |
| Pergunta hostil sem resposta | Regra 5, anotar, e responder por escrito com número. |

## 10. O que não está verificado ou ficou por fazer

Para não haver margem para dúvidas, o que o deck **não** afirma ou afirma com reserva:

- **Exatidão da triagem por foto:** nunca foi medida com verdade-terreno; o deck não dá percentagem.
- **Preço da viatura (42 500 €):** lido do anúncio TED da adjudicação de Gaia; por confirmar no portal Base.
- **Taxas de captura (18% e 25%), custo por recolha (6 €) e por quilómetro (1,10 €), quilos por saco (25 kg), frequência (2 semanas):** pressupostos sem dado local; são os que mais pesam no intervalo de incerteza.
- **Têxtil por freguesia:** não existe; a procura é proporcional à população, com a média nacional da APA (5,86%).
- **Referência francesa (4,27 kg/hab/ano):** por verificar; só serve de comparação.
- **Passaporte Digital do Produto (2027):** contexto do plano municipal, por confirmar.
- **Locais:** 350 dos 1 187 têm coordenada aproximada; cada paragem é «lugar possível, a validar com a Vitrus».
- **Contaminação:** o modelo não a desconta; o cenário A (contentor de rua) parece mais barato por tonelada por causa disso, e é só referência.
- **Cenário «Duas freguesias»:** como cenário autónomo (a viatura toda paga por duas freguesias) dá 9,7 t/ano a 1 057 €/t; serve para aprender a escala, e a rede é a do concelho. Os números do ensaio de 3 meses (1,71 t; 2,43 t; 538 €/t) não contam a viatura.
- **RGPD:** a avaliação é técnica; a base jurídica e a avaliação de impacto têm de ser validadas pelo encarregado de proteção de dados.
- **Dados de demonstração:** composição das peças sem etiqueta legível é a que o operador confirma (pressuposto de demonstração); fotografias da Wikimedia Commons, com crédito.

## 11. Como se regenera

O deck e este guião saem do mesmo código. Para os refazer (a partir da raiz do repositório, com a stack de desenvolvimento a correr e o seed de demonstração aplicado):

```bash
python3 pitch/vitrus/maps.py "$PWD"          # mapas a partir de data/processed
node pitch/vitrus/icons.cjs                  # (já não usado no deck; ícones Lucide)
node pitch/vitrus/shots.cjs                  # capturas da app (precisa de CHROME=... se o Playwright não tiver o browser)
node pitch/vitrus/mobile.cjs                 # capturas de telemóvel
cd pitch/vitrus && NODE_PATH=../node_modules node build.js   # PPTX e guiao.json
node pitch/vitrus/guiao.js                   # este guião
```

Os números dos cenários vêm de `pitch/vitrus/data/*.json` (API local, 11 nov 2026). Se os dados ou o modelo mudarem, voltar a exportar esses ficheiros e refazer.
