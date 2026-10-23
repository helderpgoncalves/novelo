# Registo de afirmações

**Regra: nenhum número vai para um slide, para a demo ou para o relatório sem uma linha aqui.** Se a linha estiver em "Por verificar", o número não se usa em público; se for "Pressuposto nosso" ou "Cálculo nosso", diz-se com essa palavra.

Datas de consulta: **2026-10-19**, salvo indicação (a secção B foi revista a 22 out 2026, com a diretiva lida integralmente). As fontes estão em [Fontes](fontes.md). "Slide" refere o [guião de slides](../projeto/pitch-slides.md).

Estados: **Dado Vitrus** · **Primária** (verificado em fonte oficial) · **Secundária** (verificado em imprensa ou análise) · **Por verificar** · **Pressuposto** · **Cálculo** (nosso, sobre números verificados) · **Falso** ou **Invalidado** (desmentido por uma fonte; fica como histórico). Ver [significado de cada um](README.md#os-estados-de-cada-afirmação).

## A. Os nossos dados (Vitrus, INE)

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| A1 | Têxtil recolhido em 2025 por 4 entidades | 301,3 t | `dados_textil.xlsx` | Dado Vitrus | 2, 8 |
| A2 | Recolha por habitante | 0,16 kg/hab/mês = 1,92 kg/hab/ano | 301 300 kg ÷ 156 830 ÷ 12 | Cálculo | 2 |
| A3 | População de Guimarães | 156 830 | INE, Censos 2021 (soma das 48 freguesias) | Primária (INE, ficheiro do projeto) | 2 |
| A4 | Destino do recolhido | 59,4% reutilização, 26,5% reciclagem, 14,1% rejeito | `dados_textil.xlsx` | Dado Vitrus | 5 |
| A5 | O destino de duas entidades é estimado por percentagem | Nova Etapa e Vitrus (percentagens de relatórios) | `dados_textil.xlsx` | Dado Vitrus (diz-se "estimativa") | 5 |
| A6 | Circuitos, viaturas, localidades | 40 circuitos, 29 viaturas, 82 localidades (79 com freguesia CAOP 2019 desde 22 out 2026; antes 71 geocodificadas e 61 com freguesia) | `Circuitos_Viaturas_Guimaraes.xlsx` | Dado Vitrus | 4 |
| A7 | Circuitos sem viatura atribuída | 9 | idem | Dado Vitrus | demo |
| A8 | Têxtil que ainda vai para o lixo (procura do modelo) | ≈ 3 003,3 t/ano = 1,596 kg/hab/mês | 51 250,6 t de indiferenciado do concelho (A24) × 5,86% (A10) ÷ 156 830 ÷ 12 | Cálculo sobre dados da Vitrus e da APA (**estimativa**), base indicada pela Vitrus a 22 out. Antes: 2 324,8 t = 43 051 × 5,4% (21 out) e 0,7 kg/hab/mês ≈ 1 317 t do Plano de Ação Integrado (F74), ambos fora de uso | 2 |
| A9 | Captura atual | ≈ 9,1% | 301,27 ÷ (3 003,285 + 301,27) = 301,27 ÷ 3 304,555 | Cálculo (**estimativa**): cerca de 9 em cada 10 kg vão para o lixo. Antes: 11,5% (base de 21 out) e 22,9% (base do plano) | 2 |
| A10 | Têxtil no indiferenciado | 5,86% | APA, RARU 2025, p. 24 (média nacional); indicado pela Vitrus a 22 out 2026 | Primária (APA), confirmada pela Vitrus. Antes: 5,4% (21 out), que é a média da caracterização de 2016 (H7), não um valor da APA | 2 |
| A11 | 4 de 27 operadores licenciados valorizam têxteis | 4 de 27 | Plano municipal | **Por verificar**: o Plano (F74, p. 32) fala em 27 operadores com licença LER 04 em Guimarães e sete concelhos vizinhos, 4 deles com reciclagem ou valorização (R3 e R5); LER 04 é resíduo industrial, pelo que não prova pós-consumo | 6 |
| A12 | Total de têxtil gerado por ano | ≈ 3 304,6 t | 3 003,3 t (A8) + 301,3 t (A1) | Cálculo (**estimativa**). Antes: 2 626,0 t (base de 21 out) e o intervalo de 1 300 a 2 650 t do plano municipal | 2 |
| A13 | Doze alertas de qualidade nos dados dos circuitos | 12 | `Circuitos_Viaturas_Guimaraes.xlsx` | Dado Vitrus | 7 |
| A14 | Contentores **de têxteis** | não existem; a Vitrus não os quer (contaminação dificulta a reutilização) | Vitrus (mentor, 21 out 2026) | Dado Vitrus | 4 |
| A15 | Custos por hora, por quilómetro e por contentor | por receber: pedidos ao departamento financeiro a 21 out; a 22 out ainda não tinham chegado (A23) | Vitrus | Por obter (pressuposto até lá) | 4 |
| A16 | Indiferenciado recolhido pela Vitrus em 2025 | 43 050,5 t (43 051 t arredondado) | Vitrus (mentor, 21 out 2026); Relatório e Contas 2025, p. 8 | Dado Vitrus. Desde 22 out é a base do cálculo do concelho (A24), não a procura direta | 2 |
| A17 | Reciclar têxtil é muito mais caro que fibra virgem | qualitativo | Vitrus (mentor, 21 out 2026) | Dado Vitrus (opinião do operador, sem número) | 6 |
| A18 | O pacote QGIS traz contentores de indiferenciado, orgânico e recolha seletiva; não há dados de deposição de têxtil por contentor | qualitativo | Vitrus (mentor, 21 out 2026) | Dado Vitrus | |
| A19 | A qualidade depende de quem recolhe: reutilização em 2025 por entidade | Ultriplo 72,9% (97,7 ÷ 134,1 t); H Sarah Trading 50,0% (59,3 ÷ 118,6 t); Nova Etapa 50%; Vitrus 9,2%, com 56,9% de rejeito (5,6 t) | `dados_textil.xlsx` (`textile_flows.csv`): Ultriplo e Sarah com kg por destino; Nova Etapa e Vitrus com percentagens de relatório (a da Vitrus é da To Be Green) | Dado Vitrus. Nova Etapa e Vitrus dizem-se "estimativa"; a divisão da Sarah é redonda (50/37/13) e pode ser percentagem ([Q7](../projeto/perguntas-aos-orientadores.md#q7-como-foi-medido-o-destino-e-a-que-preço)); a amostra da Vitrus é pequena (1,9% do total) | 6 |
| A20 | Viaturas sem circuito numa tarde de dia útil | ~~cerca de 15 das 29~~ **nenhuma** | Contagem nossa sobre `shifts.csv`; desmentida pela Vitrus a 22 out (A22) | **Falso**: a folha de turnos tem um erro e as viaturas estão em uso à tarde. Não usar o "plano B" | não usar |
| A21 | O saco de têxtil não pode ir no compactador do porta a porta (vai para a caixa de compactação e estraga-se); cabine, gancho ou caixa lateral também não; um compactador não pode fazer uma volta só de têxtil (contaminação). Saída: "aquisição de um meio novo de recolha" | qualitativo | Vitrus (mentor, 22 out 2026) | Dado Vitrus. Invalida H5 (saco no circuito PAP, 0 km novos) | 4 |
| A22 | Não há viaturas livres à tarde; os circuitos PAP que pareciam sem viatura também a têm (erro da folha de turnos) | qualitativo | Vitrus (mentor, 22 out 2026) | Dado Vitrus. Invalida A20 e o "sem viaturas novas" | 4 |
| A23 | Custos por hora e por km das viaturas | por receber | Vitrus (mentor, 22 out 2026) | Por obter: o financeiro ainda não os enviou | 4 |
| A24 | Indiferenciado do concelho todo em 2025 | ≈ 51 250,6 t | 43 050,5 t (A16) ÷ 0,840 (H8) | Cálculo (**estimativa**) sobre dados da Vitrus; base indicada pela Vitrus a 22 out | 2 |
| A25 | Custo de tratamento do indiferenciado em aterro | 105,64 €/t = 40 €/t de taxa de gestão de resíduos (TGR) + 65,64 €/t de tarifa da Resinorte | Vitrus (mentor, 22 out 2026) | Dado Vitrus (confirma H9). Cada tonelada desviada do lixo poupa este valor (custo evitado, não receita) | 3, 4 |
| A26 | Depósito das rotas | Estaleiro Operacional da Rua das Lameiras, Polvoreira | Vitrus (mentor, 22 out 2026) | Dado Vitrus | demo |
| A27 | Quilos de têxtil por mês (sazonalidade) | só partilhados com o município | Vitrus (mentor, 22 out 2026) | Sem dado; o modelo fica anual | |
| A28 | Rede proposta: uma viatura de têxtil nova, sem compactação, com o saco fechado à porta num dia fixo por freguesia e paragens nos locais municipais e escolas, sem contentores | qualitativo | Decisão da equipa a partir de A14, A21 e A22 | Pressuposto de desenho; números dos cenários na secção H (versão 5 do modelo) | 4 |

## B. Regulação

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| B1 | Municípios operacionalizam a recolha seletiva de têxteis desde 1 jan 2025 | 1 jan 2025 | Diretiva 2008/98/CE, art. 11.º, n.º 1 (de 2018) [F81]; RGGR, art. 36.º [F69]; APA [F2]. **Não** vem da Diretiva (UE) 2025/1892 | Primária | 2 |
| B2 | Diretiva (UE) 2025/1892 publicada no JOUE | 26 set 2025 | APA [F2], EUR-Lex [F1] | Primária | 2 |
| B3 | Prazo de transposição | 17 jun 2027 | EUR-Lex art. 2.º [F1], APA [F2] | Primária | 2 |
| B4 | Regimes de RAP de têxteis criados ("asseguram a previsão dos regimes") | até 17 abr 2028 | art. 22.º-A, n.º 14 [F1], APA [F2] | Primária. **Não** é a data em que os produtores passam a pagar tudo (ver B17) | 2, 7 |
| B5 | Os produtores cobrem recolha, transporte, triagem, preparação para reutilização, reciclagem e eliminação, mais estudo de composição, informação, dados e relatórios, e investigação; custo líquido das receitas de reutilização | art. 22.º-A n.º 8, alíneas a) a e); art. 22.º-C n.º 5, b) | [F1] | Primária | 7 |
| B6 | Os custos têm de ser "economicamente eficientes" e determinados "de forma transparente entre os intervenientes relevantes", entre os quais "As autoridades locais" | art. 22.º-A n.º 12 e n.º 7, d) | [F1] | Primária | 7 |
| B7 | Os Estados-Membros **podem** fazer os produtores pagar, parcial ou totalmente, a recolha e gestão dos têxteis no indiferenciado | art. 22.º-A n.º 9 (só os custos do n.º 8, alínea a)) | [F1] | Primária | só em conversa |
| B8 | A rede de recolha deve cobrir todo o território, tendo em conta população, densidade, volume previsto, acessibilidade e proximidade, sem se limitar às zonas rendíveis | art. 22.º-C n.º 9, b) (vinculativo); também art. 11.º, n.º 1 e considerando 36 | [F1], [F2] | Primária | 3, 7 |
| B9 | A triagem dá prioridade à reutilização e à triagem local | art. 22.º-D n.º 5, considerando 48 | [F1] | Primária | 5 |
| B10 | A economia social pode manter pontos de recolha próprios | art. 22.º-C n.º 11 | [F1] | Primária | 6 |
| B11 | Portugal ainda não tem entidade gestora nem regime de RAP de têxteis aprovado | "ainda não se encontra aprovado o fluxo" (APA, dez 2025) | [F2] | Primária (dezembro de 2025); reconfirmada a 8 out 2026: a APA diz que o modelo nacional, as entidades gestoras e os valores estão por definir (F71) | 2 |
| B12 | O município assume sozinho o custo desde 2025 | posição da ZERO e da ANMP | [F5], [F6] | Secundária | 2 |
| B13 | Projeto-piloto da APED, financiado pelo Fundo Ambiental | 450 000 € | APA [F2] | Primária | não usar |
| B14 | A diretiva fixa metas de recolha de têxteis | **não**: a Comissão avalia a possibilidade de metas até 31 dez 2029 | art. 41.º-A, b) [F1] (fundamentado no considerando 59) | Primária | **não afirmar metas** |
| B15 | Os artigos 22.º-A a 22.º-D aplicam-se a empresas com menos de 10 empregados e volume de negócios e balanço anual até 2 M€ só a partir de | 17 abr 2029 | art. 41.º (parágrafo aditado pelo art. 1.º, ponto 12) [F1]; também [F3] | Primária | só em conversa |
| B16 | Passaporte digital e proibição de destruir invendidos | datas divergem | blogues [F20] | **Por verificar** | não usar |
| B17 | Os produtores cobrem os custos só dos produtos postos no mercado pela primeira vez depois da lei de transposição, ou o mais tardar depois de 17 abr 2028; o têxtil já nas casas continua sem produtor que pague durante anos | art. 22.º-A n.º 11 (n.º 10 só para quem já tinha RAP a 16 out 2025); considerando 31 ("não se apliquem retroativamente") | [F1] | Primária quanto ao texto; **leitura por confirmar com a APA ou um jurista**. Sem número sobre a idade das peças | 2, 7 |
| B18 | A OCRP não pode recusar a participação de autoridades públicas locais no sistema de recolha | art. 22.º-C n.º 10 | [F1] | Primária | 7 |
| B19 | O sistema de recolha mantém um aumento sustentado da recolha seletiva e uma diminuição correspondente de têxteis no indiferenciado | art. 22.º-C n.º 9, c) | [F1] | Primária | 7 |
| B20 | Recolha com frequência adaptada à área e ao volume | art. 22.º-C n.º 8, b) | [F1] | Primária | só em conversa |
| B21 | Estudo da composição do indiferenciado pelo Estado: o primeiro até 1 jan 2026, depois de cinco em cinco anos, com resultados públicos | art. 22.º-D n.º 6 (NUTS 2 só no considerando 36) | [F1] | Primária | só em conversa |
| B22 | Os produtores **têm de** entregar as obrigações a uma OCRP autorizada (entidade gestora) | art. 22.º-C n.º 1 e 2 | [F1] | Primária | só em conversa |
| B23 | Os vendedores à distância de fora do país são produtores; as plataformas em linha só verificam o registo e pedem uma autocertificação | art. 3.º, ponto 4-B, d); art. 22.º-A n.º 13 | [F1] | Primária | não usar |
| B24 | Só o operador de reutilização ou a economia social podem avaliar no ponto de recolha e tirar a peça do estatuto de resíduo; um operador de resíduos como a Vitrus não | art. 22.º-D n.º 3 | [F1] | Primária | só em conversa |
| B25 | Registo por fardo nas transferências de usados: tipo de vestuário, tamanho, cor, sexo, composição, nome e endereço de quem triou | art. 22.º-D n.º 9 | [F1] | Primária | 5 (o passaporte "vai no sentido de", não "cumpre") |
| B26 | Reporte anual por peso: apto para reutilização, preparação para reutilização e reciclagem, outras operações | art. 22.º-C n.º 12 (economia social) e n.º 18 e 20 (OCRP); art. 37.º n.º 3 | [F1] | Primária | só em conversa |
| B27 | O recolhido seletivamente para reutilização e reciclagem não é incinerado nem aterrado | Diretiva 2008/98/CE art. 10.º n.º 4; Diretiva 1999/31/CE art. 5.º n.º 3, f) (ambas de 2018). **Não** está na 2025/1892 | [F81], [F82] | Primária (consolidado) | só em conversa |

## C. Benchmarks e mercado

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| C1 | França recolheu por habitante em 2024 | 4,27 kg | Refashion via [F10] | Secundária | 3 |
| C2 | França: 1 ponto de recolha por habitantes | 1 414 | [F10] | Secundária | 3 |
| C3 | França: toneladas recolhidas em 2024 | 289 393 t (a página inglesa diz 272 479 t) | [F10], [F12] | Secundária; fonte diverge | dizer "cerca de 290 mil t" |
| C4 | França: contribuição média por tonelada colocada no mercado | 156,1 € em 2024 | [F10] | Secundária | 6 |
| C5 | França: contribuição revista em 2025 | 223 a 228 € por tonelada | [F11] | **Por verificar** | não usar |
| C6 | Custo líquido real de triagem em França | cerca de 304 € por tonelada | pergunta parlamentar via [F11] | **Por verificar** | não usar |
| C7 | França: reutilização e reciclagem do recolhido | 56,8% e 24,3% | Refashion via [F12] | Secundária | 5 |
| C8 | UE-27: recolha seletiva e geração | 4,4 kg de cerca de 16 kg por habitante (2020) | AEA [F7] | Primária | 3 |
| C9 | Taxa média de captura na Europa | 12% | AEA [F7] | Primária | 3 |
| C10 | Cerca de 72% dos têxteis vão para o indiferenciado | 11,6 kg/hab | AEA [F7] (cálculo da fonte, 72%) | Primária + cálculo | 2 |
| C11 | Catalunha | cerca de 2,7 kg/hab, 13,6% | ARC [F15] | Secundária | 3 |
| C12 | Catalunha: apoio aos entes locais | até 75 € por tonelada | [F14] | **Por verificar** | não usar |
| C13 | Guimarães com a densidade francesa teria cerca de 111 pontos | 156 830 ÷ 1 414 | A3 e C2 | Cálculo | 3 |
| C14 | Guimarães com a recolha francesa teria cerca de 670 t | 4,27 × 156 830 | A3 e C1 | Cálculo | 3 |
| C15 | Cenário francês = 2,2 vezes a recolha de hoje | 670 ÷ 301,3 | A1 e C14 | Cálculo | 3 |
| C16 | Sasia recicla cerca de 2 000 t por mês, pré-consumo | 2 000 t/mês | [F23], [F24] | Secundária | 6 |
| C17 | O têxtil por desviar em Guimarães é cerca de 12,5% da capacidade anual da Sasia | 3 003,3 ÷ 24 000 | A8 e C16 | Cálculo (depende de A8; antes 9,7% com 2 324,8 t e 5,5% com 1 317 t) | 6 |
| C18 | Wippytex trabalha com 30 municípios, 3 000 t em 2023 | 30; 3 000 t | [F23] | Secundária | não usar |
| C19 | Humana Portugal 2024 | 3 835 t, 1 088 contentores | [F27] | Secundária | 6 |
| C20 | Humana Portugal 2025 | 3 919 t, 653 contentores | [F28] | **Por verificar** | não usar |
| C21 | Sintra retira centenas de contentores de roupa | 465 a 528 | [F29], [F30] | Secundária | 3 |
| C22 | Reciclagem mecânica aceita 15 a 20% de fibra reciclada num fio | 15 a 20% | [F36] | Secundária | não usar |
| C23 | Custo de recolha e triagem | cerca de 430 € por tonelada | VTT via [F35] | **Por verificar** | não usar |
| C24 | Menos de 1% do vestuário usado vira vestuário novo; 78% dos têxteis exigem desmontagem antes da reciclagem | 1%; 78% | Considerando 26 [F1] | Primária | 6 |
| C25 | O enunciado do desafio afirma que, contando os resíduos urbanos mistos, entre **73% e 80%** dos têxteis descartados acabam em aterro ou incineração | 73% a 80% | [F62] (sem fonte indicada) | **Secundária**: dizer "segundo o enunciado". Mede outra coisa que C10 (indiferenciado, 72%); não os misturar | não usar em slide sem a ressalva |

## D. Tecnologia

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| D1 | A triagem NIR com redes neuronais atinge mais de 95% em ensaio | >95%, 526 amostras | [F31] | Secundária | 5 |
| D2 | As misturas de fibras e a humidade degradam a exatidão | 83,1% para 78,9% (humidade, ensaio) | [F34] | Primária (investigação) | 5 |
| D3 | Uma foto não mede a fibra; a composição vem da etiqueta | — | [F32], [F37] | Secundária | 5 |
| D4 | O Novelo acerta X% no tipo de peça | **por medir** | avaliação da triagem | **Por verificar** | só depois da avaliação |
| D5 | A triagem não guarda as fotos: só existem em memória durante o pedido (substitui «as fotos são apagadas depois de processadas», revisto a 23 out 2026) | comportamento da aplicação | `POST /triage` em `features/lots/router.py` e [IA](../engenharia/ia.md) | Cálculo/produto | 5 |
| D6 | Só se guarda uma miniatura se o operador a pedir: JPEG até 640 px e ~150 KB, sem EXIF/GPS, com confirmação de que não há pessoas, apagada ao fim de 90 dias (configurável, 1 a 365) ou quando se quiser; o passaporte público mostra até 12 | 640 px; 150 KB; 90 dias (estimativa de política, não imposição legal) | código `features/lots/{photos,photo_store}.py` e migração `0018_lot_item_photos.py`, 23 out 2026; [Privacidade das fotografias](../engenharia/privacidade-fotografias.md) | Cálculo/produto | 5 |
| D7 | Uma foto apagada pode ficar até 1 h em caches públicas | `max-age=3600` | `features/lots/router.py`, 23 out 2026 | Cálculo/produto | 5 |

## E. Hackathon

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| E1 | Semana de trabalho | 19 a 23 out 2026, CIAJG (09h30 a 17h30); formato híbrido | [F61], [F21], [F22] | **Primária** | — |
| E2 | Pitches presenciais | 26 out a partir das 14h30; avaliação do júri 26 e 27 out; vencedores 28 out | [F61] | **Primária** | — |
| E3 | Prémios | 20 000 €: 7 500 €, 4 500 € e 3 000 € para os três primeiros da classificação geral, e 1 000 € para o melhor projeto de cada um dos cinco desafios; **acumulam** | [F61] | **Primária** | — |
| E4 | Os projetos são avaliados por **4 critérios ponderados**: inovação e originalidade **25%**, viabilidade técnica **25%**, impacto e relevância **30%**, apresentação e potencial de continuidade **20%** (soma 100%) | 25 / 25 / 30 / 20 | Página oficial do Hack4Guimarães 2035, FAQ "Como são avaliados os projetos?" [F61]; texto colado pelo utilizador a 2026-10-19 | **Primária** (verificado). Ver [Critérios de avaliação](../projeto/criterios-de-avaliacao.md) | todos |
| E5 | Duração do pitch | **desconhecida**; assumimos 5 minutos (repartidos pelos 4 critérios na [narrativa](../projeto/narrativa-do-pitch.md#repartição-do-tempo-pelos-quatro-critérios)) | — | Pressuposto | — |
| E6 | O **detalhe de cada critério** (o que conta como inovação, viabilidade, impacto e continuidade) | **por obter**: está no separador **Rules** da página do evento na plataforma TAIKAI, que ainda não lemos | [F61], [F62] | **Por verificar**: colar o texto em [Critérios de avaliação](../projeto/criterios-de-avaliacao.md#colar-aqui-o-texto-das-regras). O enunciado resume o que conta: inovação da solução, solidez técnica do que foi construído, impacto no território e clareza da apresentação. Até lermos o separador, o resto é **hipótese** | — |
| E7 | Júri e formato: o júri é **designado pela organização, composto por especialistas nas áreas temáticas, sem votação pública, decisões finais**. **Desconhecidos:** os nomes, o formato do pitch e das perguntas e respostas, e se a demo ao vivo é permitida | júri: especialistas; resto por obter | [F61] | **Primária** (composição geral); **Por verificar** (o resto): perguntar à organização e ao Lucas ([pergunta comum](../projeto/mentores.md#pergunta-comum-às-regras-e-ao-formato)) | — |
| E8 | **Submissão até 23 out 2026 às 17h30**; depois disso os projetos ficam fechados na plataforma e não se cria nem edita nada | 23 out, 17h30 | [F61] | **Primária** | — |
| E9 | Presença obrigatória nos pitches (26 out) e na cerimónia de prémios (28 out) | 26 e 28 out | [F61] | **Primária** | — |
| E10 | O que se espera: um **protótipo funcional com potencial de continuidade**, não um produto acabado; conta demonstrar que a ideia funciona na prática e pode evoluir depois | — | [F61] | **Primária** | frase de fecho |
| E11 | Ferramentas de IA, bibliotecas, APIs e código aberto ou de terceiros são permitidos e encorajados, **desde que devidamente identificados** | — | [F61] | **Primária**. Ação: identificá-los na submissão e no README | — |
| E12 | Todo o trabalho substancial tem de ser feito durante o hackathon; a organização pode verificar a originalidade, nomeadamente pelo histórico dos repositórios | — | [F61], [F62] | **Primária**. O primeiro commit do nosso repositório é de 2026-10-19 (histórico do Git) | — |
| E13 | O desafio TexVitrus é proposto pela Vitrus Ambiente, **que atribui o prémio ao vencedor deste desafio**; os mentores indicados são Lucas Nascimento (Vitrus) e, para qualquer desafio, o Prof. Paulo Afonso (UMinho, Departamento de Produção e Sistemas) | — | [F62] | **Primária** | — |
| E14 | Os cinco desafios competem na **mesma classificação geral** (três prémios) e cada um tem o seu prémio de 1 000 € | — | [F61] | **Primária** | — |

## F. Mentores, Fibrenamics e hackathon

Referências F41 a F60 em [Fontes](fontes.md#mentores-fibrenamics-e-hackathon). "M" de mentores.

| # | Afirmação | Valor | Fonte | Estado | Uso |
| --- | --- | --- | --- | --- | --- |
| M1 | Luís Miguel Oliveira é o responsável executivo (CEO) da Fibrenamics | CEO | ECO 2026 [F48], diretórios; o utilizador indicou que é mentor e trabalha lá | **Por verificar** (título não confirmado em página oficial) | Dizer "Fibrenamics", não o título, até confirmar |
| M2 | A Fibrenamics está em Guimarães (Azurém) e existe desde 2011 | 2011 | [F41] | Primária | Conversa e slide de parceiros |
| M3 | Raul Fangueiro é presidente da Fibrenamics | Presidente | [F45] | Secundária | Conversa |
| M4 | A Fibrenamics tem o projeto Lusitano de fios de fibras recicladas (2022 a 30 jun 2026), com Riopele, Twintex e outros | 2022 a 2026 | [F42] | Primária | Conversa; não diz se é pós-consumo |
| M5 | A Fibrenamics Green já envolveu mais de 100 empresas, com cerca de 553 000 € de apoio (Norte 2020, FEDER) | 100; 553 000 € | [F45] | Secundária | Conversa |
| M6 | O resíduo fibroso listado pela Fibrenamics Green é de produção e corte (pré-consumo): cerca de 85% celulósico, 10% poliéster | 85/10/2/3 | [F44] | Primária (página antiga) | Só em conversa |
| M7 | A Fibrenamics aceita têxtil pós-consumo | **desconhecido** | [F43] não o menciona | **Por verificar**: pergunta 1 ao mentor | Não afirmar |
| M8 | Investigação da UMinho encaminha misturas e fração de baixo valor para não tecidos, compósitos e isolamento | qualitativo | [F49], [F50], [F51], [F52] | Primária (investigação, via pesquisa) | Slide da indústria, só como "a investigação aponta" |
| M9 | Cerca de 39% de denim pós-consumo reciclado chega à resistência térmica-alvo num não tecido | 39% | [F52] | Primária (investigação, via pesquisa) | Só em conversa |
| M10 | A Sasia participa em projetos de isolamento acústico (construção e automóvel) | qualitativo | [F53] | Secundária | Conversa |
| M11 | Lucas Nascimento é doutorando/doutorado em Gestão e Tratamento de Resíduos (UMinho) e investigador da Vitrus | — | [F56], utilizador | Secundária + indicado pelo utilizador | Perfil |
| M12 | A Vitrus participa em dois projetos europeus de circularidade de comércio e serviços não alimentares, incluindo têxteis (URBACT Let's Go Circular e Circular Ecosystems) | 2 | [F17], [F18] | Secundária; **projetos exatos por confirmar**. A 21 out o Lucas disse não conhecer o Plano de Ação Integrado (URBACT) | Conversa com o Lucas |
| M13 | Guimarães e a Vitrus ganharam um lugar no Horizon Europe (periASTY, missão de cidades neutras em carbono) | 1.º de 3 | [F58] | Secundária; não é de resíduos | Não usar |
| M14 | A campanha nas escolas recolheu cerca de 3 t em mais de 30 escolas, destino To Be Green | 3 t; 30 | [F57], [F19] | Secundária | Conversa |
| M15 | Paulo Afonso, do Departamento de Produção e Sistemas, é investigador em custos, avaliação de investimentos, modelos de negócio e logística (SLOTS) | — | [F54], [F55] | Primária (instituição); o enunciado [F62] confirma-o como mentor "para qualquer desafio", mas **a identificação da pessoa continua por inferência** | Perfil |
| M16 | Hack4Guimarães: composição nominal do júri e duração do pitch | **não públicos** (critérios e pesos: E4; júri em geral: E7; mentores do nosso desafio: M18) | [F59], [F61], [F62] | Por verificar: Regras e organização | Perguntar |
| M17 | Hack4Guimarães: formato híbrido; os participantes mantêm a titularidade da propriedade intelectual dos projetos (os desafios e tecnologias de empresas e parceiros podem ter condições próprias, comunicadas com cada desafio) | — | [F59], [F61] | Primária | Cenários pós-hackathon |
| M18 | O enunciado do nosso desafio indica como mentores **Lucas Nascimento (Vitrus Ambiente)** e, "para qualquer desafio", o **Prof. Paulo Afonso** (Universidade do Minho, Departamento de Produção e Sistemas). **Luís Miguel Oliveira não consta** no texto que temos | — | [F62] | **Primária**; o papel do Luís Miguel (indicado pelo utilizador como mentor) fica **por confirmar** | Mentores |

## G. Contentores municipais (pacote QGIS, 20 out 2026)

Nada deste bloco é de têxteis. Ver [Análise dos contentores municipais](../dados/analise-contentores-municipais.md). Os números vêm de `data/processed/municipal_summary.json`.

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| G1 | A Vitrus enviou os contentores municipais de outras frações (indiferenciado, orgânico, seletivo); não há contentores de têxteis (A14) | 5 ficheiros, 2 754 linhas | `data/raw/vitrus-mapa-qgis/` | Dado Vitrus | demo |
| G2 | Contentores aceites e localizados | 2 751 aceites, 2 722 localizados, 29 sem coordenadas, 3 rejeitados | ETL `municipal_containers.py` | Dado Vitrus (contagem nossa) | |
| G3 | Contentores enterrados por marca | 591: molok 488, bluebee 66, greenbee 37 (e 2 plataformas) | idem | Dado Vitrus | |
| G4 | Capacidade dos enterrados | 17 de 3 m³ e 574 de 5 m³ (mais 2 plataformas de 5 m³) | idem; compatível com [F63] | Dado Vitrus | |
| G5 | Locais (coordenadas iguais a 5 casas) e candidatos a paragem para têxteis (sem contentor novo) | 2 026 locais; 1 187 com contentor de rua, 837 com coordenada precisa | idem | Cálculo (critério nosso) | |
| G6 | Densidade | 17,4 contentores e 10,0 locais públicos por 1 000 hab. | 2 722 e 1 574 ÷ 156 830 | Cálculo | |
| G7 | Cobertura da área a 200, 300 e 500 m de um local público | 31,4%, 47,8%, 70,9% | idem, CAOP 2019 | Cálculo (cobertura de área, não de população) | |
| G8 | Freguesia declarada igual à do polígono | 2 354 de 2 670 (88,2%); 79 a mais de 1 km | idem | Cálculo | |
| G9 | Área das 48 freguesias | 24 099,97 ha (241,0 km²) | CAOP 2019 (`AREA_T_Ha`) | Dado Vitrus (CAOP) | |
| G10 | Contornos OSM da app falham 3 uniões e têm 1 minúscula | 44 utilizáveis de 48 | comparação com CAOP 2019 | Cálculo | |
| G11 | Lacuna de têxtil por freguesia | Lordelo 59,0 t/ano (3 979 hab. × 14,82 kg, base de 21 out); com a base de 22 out, cerca de 76,2 t (3 979 × 19,15 kg) | kg/hab/mês igual em todas as freguesias (A8) | **Estimativa** (sem têxtil por freguesia); confirmar com `municipal_summary.json` depois de `just etl` | |
| G12 | Blue Bee, Green Bee e Red Bee são contentores enterrados da Lasso, de 3 e 5 m³ | | [F63] [F64] | Primária do fabricante | |
| G13 | Molok é semienterrado com 1,3, 3 e 5 m³ | | [F65] | Secundária (excertos) | |
| G14 | CAOP2025 aprovada a 28 jan 2026 | | [F66] | Primária | |

## H. Cenários do Novelo (22 out 2026)

Saem do otimizador com os pressupostos ativos por omissão (custos das viaturas da Vitrus por receber, A15, A23): são sempre **estimativa**. Método e tabelas em [Dados e modelo](../engenharia/dados-e-modelo.md). Modelo de referência versão 5 (22 out 2026): procura de 3 003,3 t (A8), viatura de têxtil nova sem compactação (A21, A28), depósito em Polvoreira (A26) e tratamento evitado a 105,64 €/t (A25). Pressupostos novos do modelo: viatura de 42 500 € sem IVA (concurso de Vila Nova de Gaia para uma viatura de mercadorias de caixa fechada, TED 338951-2024), 8 anos de vida, 2 t de carga, 30 km/h, 2 min por saco à porta, 10 min por paragem num local, ronda do saco à porta de 2 em 2 semanas.

| # | Afirmação | Valor | Fonte | Estado | Slide |
| --- | --- | --- | --- | --- | --- |
| H1 | Têxtil reutilizável no cenário por freguesia de 60 000 €/ano | 264,9 t/ano (222,9 a 324,8 t) de 445,8 t | 445,8 t × 59,4% (A4); intervalo com 50,0% e 72,9% (A19) | Cálculo (**estimativa**). Aplicar a mesma quota a todos os modos é pressuposto: não há qualidade por canal. Antes (modelo de 21 e 22 out, versão 3): 235,6 t | 6 |
| H2 | € por tonelada reutilizável, mesmo cenário | 173,0 € (141,1 a 205,6 €) | 45 828 € ÷ 264,9 t | Cálculo (**estimativa**). Antes: 203,1 € | só em conversa |
| H3 | Cenário por freguesia de 60 000 €/ano (recomendado) | gasta 45 828 € por ano (operação 37 516 €); 445,8 t a 102,8 €/t (P10 82,0, P50 104,4, P90 141,3; toneladas P10 341,1, P90 554,7); investimento 57 500 € (viatura de 42 500 €, 5 312,50 € por ano em 8 anos, e 60 pontos); 72,1% da população servida; 6 976 km/ano; 1 viatura, 1,67 dias por semana (606 h/ano); captura de 9,1% para cerca de 22,6% | [Dados e modelo](../engenharia/dados-e-modelo.md#3-otimização), sensibilidade com 500 amostras (semente 7) e ±30% | Cálculo (**estimativa**). Antes: 47 839 € e 396,5 t a 120,6 €/t (saco no compactador, base de 2 324,8 t) | 4 |
| H4 | Matriz de cobertura por tipo de território (art. 22.º-C, n.º 9, b)), mesmo cenário | 73,9% da população servida nas 36 freguesias predominantemente urbanas (APU); 60,2% nas 12 restantes; Arosa e Castelões, a única APR, com 0% | `GET /planning/scenarios/{id}/coverage`; [Dados e modelo, secção 10](../engenharia/dados-e-modelo.md#10-matriz-de-cobertura-diretiva-20251892); TIPAU do INE | Cálculo (**estimativa**). Antes: 76,0% contra 68,8% | 7 |
| H5 | Canais no cenário de 60 000 €/ano | paragens em locais existentes: 60 pontos em 45 freguesias, 366,3 t; saco à porta: 4 freguesias, 79,5 t | Mesmo cenário (H3) | Cálculo (**estimativa**). **O saco no circuito PAP com "0 km novos" foi invalidado a 22 out** (A21): antes, 22 de 48 freguesias (67 349 hab.) e 129,3 t | 4 |
| H6 | Teto do modelo sem contentores (orçamento sem limite) | 772,1 t/ano a 170 623 € (221,0 €/t), com 2 viaturas; 458,8 t reutilizáveis. Acima da referência francesa de 669,7 t (C14), que o modelo alcança entre os 100 000 e os 150 000 €/ano. Com o contentor de rua (só referência): 1 282,6 t a 213 910 € (166,8 €/t) | [Dados e modelo](../engenharia/dados-e-modelo.md#cenário-de-referência-desempenho-francês) | Cálculo (**estimativa**). Antes: 597,7 t a 138 866 €, abaixo da referência francesa | 3 |
| H7 | Os 5,4% são a média por circuito da caracterização de 2016 (mediana 4,5%), não um valor da APA | 5,4% | Perebynos et al., 2023, p. 5; APA dá 5,86% no indiferenciado nacional em 2025 (RARU 2025, p. 24) | Primária (artigo e RARU). **Resolvido a 22 out:** a Vitrus indicou 5,86% (A10) | histórico |
| H8 | As 43 051 t da Vitrus são 84,0% do indiferenciado do concelho | 84,0% | Vitrus, Relatório e Contas 2025, p. 8 | Primária. **Desde 22 out** a procura usa o concelho todo (A24): 51 250,6 t × 5,86% ≈ 3 003,3 t (**estimativa**) | 2 |
| H9 | Tarifa da Resinorte para o indiferenciado | 65,64 €/t (2024 e 2025); taxa de gestão de resíduos 40 €/t em 2026 (aterro) | Tarifários e R&C 2025 da Resinorte; tabela de taxas APA 2026 | Primária. **Confirmado pela Vitrus a 22 out** (A25): 105,64 €/t no total | 3, 4 |
| H10 | Tratamento evitado no cenário de 60 000 €/ano | 47 093 € por ano (445,8 t × 105,64 €/t); custo líquido −1 264 € por ano, ou −2,8 €/t: o tratamento evitado paga a operação | H3 e A25 | Cálculo (**estimativa**) | 4 |
| H11 | Curva de custo, modelo por freguesia (custo realmente gasto) | 20 000 €: 257,2 t, 16 102 €, 62,6 €/t · 40 000 €: 378,5 t, 26 909 €, 71,1 €/t · 60 000 €: 445,8 t, 45 828 €, 102,8 €/t · 100 000 €: 571,2 t, 85 860 €, 150,3 €/t · 150 000 €: 695,4 t, 129 336 €, 186,0 €/t | Cenários de referência (versão 5) | Cálculo (**estimativa**) | 4 |
| H12 | Modelo por locais reais (referência) | 20 000 €: 235,7 t, 84,5 €/t (líquido −21,1), 43,6% servida · 40 000 €: 361,4 t, 110,6 (5,0), 66,5% · 60 000 €: 481,9 t, 123,5 (17,9), 87,8% · 100 000 €: 606,1 t, 164,4 (58,8), 89,1% · 150 000 €: 726,3 t, 205,5 (99,9), 91,2% | Cenários de referência (versão 5) | Cálculo (**estimativa**) | só em conversa |
| H13 | Piloto recomendado | Aldão e Arosa e Castelões; piso de sinal 1,71 t em 3 meses, previsão 2,43 t; 538 €/t (424 a 706), sem o preço da viatura | `/pilot` | Cálculo (**estimativa**) | 8 |

## Como atualizar este registo

1. Ao verificar algo numa fonte primária, muda o estado e acrescenta a ligação.
2. Se um número no slide mudar, muda a linha **antes** do slide.
3. Quando a Vitrus enviar os custos (A15, A23), acrescenta linhas **A29 em diante** com os valores e a data de receção.
4. Quando um cenário do modelo mudar, atualiza a secção H com a data e o valor anterior.
5. No dia 25 de outubro, imprime esta tabela e confirma cada linha com "slide" preenchido.
