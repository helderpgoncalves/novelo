# Perguntas aos orientadores

Lista única do que o Novelo precisa de perguntar à **Vitrus Ambiente** (Lucas Nascimento), à **Fibrenamics** (Luís Miguel Oliveira), à **organização do Hack4Guimarães** e, no que toca ao modelo, ao **Prof. Paulo Afonso**. Cada pergunta nasce de um número, de um ficheiro ou de uma lacuna dos dados que a equipa tem. Está pronta para levar a uma reunião e para copiar para uma mensagem.

Escrito a **20 de outubro de 2026** (terça-feira), no dia em que chegou o pacote QGIS da Vitrus. Nada deste documento foi enviado. Os perfis e as mensagens-tipo dos mentores continuam em [Mentores](mentores.md); as respostas ao júri, em [Perguntas do júri](perguntas-do-juri.md).

> **Nota de rigor.** Todo o número tem fonte (ficheiro em `data/`, registo de afirmações ou [Fontes](../pesquisa/fontes.md)) ou a palavra "estimativa" ou "cálculo". Onde a pesquisa de hoje encontrou algo que muda um pressuposto, está dito. Nada aqui é uma resposta: são hipóteses de ação para cada resposta possível.

## Como usar

1. **Reunião:** seguir o [guião de 15 minutos](#7-guião-de-15-minutos) e gravar com o [registo de respostas](#8-registo-de-respostas).
2. **Mensagem:** copiar a secção [6](#6-mensagens-prontas). Cada uma leva as perguntas que só aquele destinatário pode responder.
3. **Resposta recebida:** aplicar a [regra de propagação](#9-regra-para-propagar-as-respostas) no mesmo dia.

Códigos: **V** Vitrus (Lucas), **F** Fibrenamics (Luís Miguel), **O** organização, **P** Prof. Paulo Afonso, **M** Município de Guimarães (Câmara, Laboratório da Paisagem). Prazos: **21** quarta, **22** quinta (último dia inteiro antes de o código congelar na sexta às 15h00, ver [Estratégia](estrategia-para-ganhar.md)), **25** domingo (ensaio), **pós** depois do pitch de 26 de outubro.

---

## 1. Resumo executivo

### O que já temos

| Dado | Valor exato | Fonte |
| --- | --- | --- |
| Têxtil recolhido em 2025, 4 entidades | 301,265 t (301,3 t) = 0,16 kg/hab/mês = 1,92 kg/hab/ano | `data/raw/dados_textil.xlsx`; registo A1, A2 |
| Por entidade | Ultriplo 134,130 t (44,5%); H Sarah Trading 118,632 t (39,4%); Nova Etapa 42,883 t (14,2%); Vitrus 5,620 t (1,9%) | `data/processed/textile_flows.csv` |
| Destino | Reutilização 179,0 t (59,4%); reciclagem 79,9 t (26,5%); rejeito 42,3 t (14,1%) | `data/processed/summary.json`; registo A4 |
| População | 156 830 habitantes em 48 freguesias | INE, Censos 2021 (`parishes.csv`); registo A3 |
| Potencial e captura | 1 317,4 t/ano (0,7 kg/hab/mês) e 22,9% | Plano municipal × INE (cálculo); registo A8, A9 |
| Circuitos e frota | 40 circuitos (9 sem viatura), 29 viaturas (2 nunca atribuídas), 101 turnos por semana, 82 localidades (71 geocodificadas), 12 alertas | `Circuitos_Viaturas_Guimaraes.xlsx`; `summary.json` |
| Contentores municipais (**não são de têxteis**) | 2 754 linhas, 2 751 aceites, 2 722 localizados, 2 026 locais, 17,4 por 1 000 hab., 1 187 locais candidatos | `data/processed/municipal_summary.json`; [análise](../dados/analise-contentores-municipais.md) |
| Cobertura de área a 200, 300 e 500 m | 31,4%, 47,8% e 70,9% (só locais públicos) | `municipal_summary.json` |
| Geometria | CAOP 2019, 48 freguesias, 24 099,97 ha (241,0 km²) | pacote da Vitrus, 20 out |
| Alertas já abertos | 12 (circuitos) e 25 (contentores municipais) | `data_alerts.csv`; `municipal_alerts.csv` |

### O que falta

1. A **lista dos contentores de têxteis** (`summary.json`: `containers.status = awaiting_data`, `files = []`).
2. **Custos unitários** e capacidade das viaturas (`params.py`: 6,0 € por recolha, 1,1 € por km, 1 200 € por contentor de rua, 4,0 t por viatura; tudo pressuposto).
3. O texto das **Regras** do hackathon (E6, E7 no registo) e a **autorização** de uso público dos dados.
4. A **caracterização local do indiferenciado**: a folha `RSU` do ficheiro da Vitrus traz Portugal (têxteis 4,55%, sanitários 9,1%) e Europa, não Guimarães.
5. Têxtil **por freguesia ou por ponto** (só existe o total de 301,3 t), preços por fração e critérios de lote.

### Descoberta de hoje: a fonte do plano municipal é pública

O registo dava a fonte dos 5,4% e dos 0,7 kg/hab/mês como "não localizada". Está no **Plano de Ação Integrado para a Circularidade Têxtil de Guimarães** (URBACT, 25/11/2025) [F74]: p. 30 (5,4% do indiferenciado e 0,7 kg de têxtil "nos RSU por mês per capita", citando Perebynos et al. 2023 [F75]) e p. 32 (27 operadores com licença para resíduos têxteis LER 04 em Guimarães e sete concelhos vizinhos, quatro deles com reciclagem ou valorização). Isto resolve a pergunta "de onde vem" e abre outra, mais importante: **o que mede o 0,7**. Se for o têxtil que fica no indiferenciado, a geração total é pelo menos 1 618,6 t (1 317,4 + 301,3) e a captura de 2025 é 18,6% em vez de 22,9% (cálculo, estimativa). Ver [Q6](#q6-o-que-significam-07-kghabmês-e-54).

### As 10 perguntas que mais desbloqueiam valor

Pontuação = impacto × urgência, de 1 a 5 cada (**estimativa da equipa, subjetiva**). Impacto: quanto muda números do pitch, do produto ou o risco. Urgência: 5 bloqueia algo antes de o código congelar na sexta, às 15h00.

| # | Pergunta | Imp. | Urg. | Pont. | A quem | Prazo |
| --- | --- | :-: | :-: | :-: | --- | --- |
| [Q1](#q1-autorização-de-uso-dos-dados-e-do-nome) | Podemos usar os dados e o nome da Vitrus em público, e o que fica agregado? | 5 | 5 | 25 | V (cópia O) | 21 |
| [Q2](#q2-a-lista-de-contentores-de-têxteis) | Quando chega a lista de contentores de têxteis, e com que campos? | 5 | 5 | 25 | V | 21 |
| [Q3](#q3-regras-pitch-e-submissão-de-23-de-outubro) | Texto das Regras, formato do pitch e conteúdo da submissão de 23 out, 17h30 | 5 | 5 | 25 | O (cópia V) | 21 |
| [Q4](#q4-custos-unitários-e-vida-útil) | Custos por recolha, km, hora de equipa e contentor, e vida útil | 5 | 4 | 20 | V | 22 |
| [Q5](#q5-recolher-têxteis-nos-circuitos-e-viaturas-atuais) | É possível recolher têxteis nos circuitos e viaturas atuais, e com que capacidade? | 5 | 4 | 20 | V | 22 |
| [Q6](#q6-o-que-significam-07-kghabmês-e-54) | O que medem os 0,7 kg/hab/mês e os 5,4%, e de que ano? | 5 | 4 | 20 | V, M | 21 |
| [Q7](#q7-como-foi-medido-o-destino-e-a-que-preço) | Como foi medido o destino por entidade, e a que preço? | 4 | 4 | 16 | V | 22 |
| [Q8](#q8-os-contentores-municipais-e-o-seu-uso-para-têxteis) | Que fração são Profundidade e Superfície, e pode haver têxtil nesses locais? | 4 | 4 | 16 | V | 22 |
| [Q9](#q9-fibrenamics-critérios-de-lote-destino-de-baixo-valor-e-papel) | Fibrenamics: critérios de lote, destino de baixo valor e papel no desafio | 4 | 3 | 12 | F (cópia O) | 22 |
| [Q10](#q10-êxito-orçamento-e-piloto) | O que é êxito, quem decide o piloto e com que orçamento | 4 | 3 | 12 | V | 22 |

---

## 2. As 10 perguntas, em detalhe

Cada cartão tem o texto pronto, o motivo (com o dado), o que muda conforme a resposta, o valor que usamos até haver resposta e a quem perguntar. As restantes perguntas, por tema, estão na [secção 4](#4-perguntas-por-tema).

### Q1. Autorização de uso dos dados e do nome

> **Pergunta.** Podemos usar publicamente, em slides, demo, relatório e repositório partilhado com a organização, os dados que nos enviaram (301,3 t por entidade, circuitos e matrículas, 2 751 contentores municipais com nomes de produtores) e o nome da Vitrus? O que deve ficar só agregado?

**Porque perguntamos.** `data/raw/` está versionado no Git (19 ficheiros, incluindo os cinco `.txt` do pacote QGIS). O repositório é **público** (`gh repo view`, verificado a 20 de outubro de 2026): estes ficheiros já estão expostos, e a organização pode verificar o histórico para a originalidade (E12). Os ficheiros trazem 922 contentores de produtores (nomes de estabelecimentos), 29 matrículas e relatórios com o nome de três operadores. Os desafios de empresas podem ter condições próprias de dados e propriedade intelectual (M17).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Tudo autorizado, com crédito | Mostrar nomes de operadores e a marca Vitrus; manter produtores só agregados por omissão | Registo (nova linha, "autorizado por [nome], [data]"); slides |
| **B.** Só agregados, sem nomes nem matrículas | Ocultar `producer_name` e matrículas nos ecrãs e no PDF; retirar `data/raw/` do que for partilhado (`git rm` em novo commit; reescrever histórico só se pedido por escrito) | `cenarios-e-contingencias.md` B.4; API e ecrã "Frota"; `.gitignore` |
| **C.** Sem resposta até 22 | Tratar como B | Registo: "sem resposta" |

**Valor assumido.** Estimativa de risco, não de valor: só agregados por freguesia e por tipo de produtor; "operador A, B, C" nos slides; se a resposta for B, retirar `data/raw/` do repositório público de imediato.
**A quem · prazo.** V (Lucas), com cópia à organização (O) para o repositório. **21.**

### Q2. A lista de contentores de têxteis

> **Pergunta.** Quando recebemos a lista dos contentores de têxteis de todas as entidades (Ultriplo, H Sarah Trading, Nova Etapa, Vitrus, escolas)? Em que formato, com que campos (coordenadas, tipo, capacidade, operador, data de instalação) e a que data se refere?

**Porque perguntamos.** `summary.json` diz `containers.status = awaiting_data`. O pacote de 20 de outubro tem 2 751 contentores, **nenhum de têxteis** (`municipal_alerts.csv`, alerta 1). Quatro entidades recolheram 301,3 t em 2025, logo há pontos. O plano municipal refere contentores em 88 escolas em 2025 [F74, p. 56]. Sem a lista não há rede de partida, cobertura de têxteis nem lacuna real.

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Chega até 22, com coordenadas | `just etl` (`containers.py`), camada no mapa, cobertura real, recalibração da taxa de rua | `params.py` (`STREET_COVERAGE`); [análise dos dados](../dados/analise-dados-recebidos.md); registo A14 |
| **B.** Chega só com morada ou freguesia | Geocodificar (Nominatim) e marcar "estimativa"; contar por freguesia | Alertas de `containers_alerts.csv` |
| **C.** Não chega | Slide "quando chegarem, entram com um comando"; usar os 1 187 candidatos como hipótese | [Cenários](cenarios-e-contingencias.md) B.1 |

**Valor assumido.** Estimativa: o contentor de rua serve 80% da população e capta 28,6% de quem é servido (22,9% ÷ 80%, `params.py`); camada "a chegar" no mapa.
**A quem · prazo.** V. **21.** Ficheiro modelo em [Anexo A](#anexo-a-modelo-de-ficheiro-de-contentores-de-têxteis).

### Q3. Regras, pitch e submissão de 23 de outubro

> **Pergunta.** Podem enviar-nos o texto do separador **Rules** do Hack4Guimarães 2035 (TAIKAI)? Precisamos do detalhe de cada critério, da duração do pitch e das perguntas, de saber se a demo ao vivo é permitida, **do que a submissão de 23 de outubro às 17h30 tem de conter** (repositório, vídeo, PDF, ligação), de como identificar as ferramentas de IA, e das condições próprias do desafio TexVitrus sobre dados e propriedade intelectual.

**Porque perguntamos.** Os pesos são conhecidos (25/25/30/20, E4); o detalhe não (E6, E7, M16). A autoavaliação de 6,05 (estimativa) e a matriz de critérios dependem disso. O tempo de 5 minutos é pressuposto (E5). Depois das 17h30 de 23 de outubro nada se edita (E8).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Texto chega | Protocolo de uma hora: colar, sublinhar subcritérios, refazer a matriz, rever tempos | [Critérios](criterios-de-avaliacao.md); [Estratégia](estrategia-para-ganhar.md); [Narrativa](narrativa-do-pitch.md); registo E5 a E7 |
| **B.** Formato diferente de 5 min | Usar a versão de 3 min ou de 10 min | [Narrativa](narrativa-do-pitch.md); [Cenários](cenarios-e-contingencias.md) A.2 |
| **C.** Sem resposta | Manter 5 minutos e quatro critérios; ensaiar a versão curta | Nada |

**Valor assumido.** Estimativa: pitch de 5 minutos, demo ao vivo permitida, perguntas do júri a seguir (E5, pressuposto).
**A quem · prazo.** O, com cópia ao Lucas. **21** (hoje, se possível).

### Q4. Custos unitários e vida útil

> **Pergunta.** Qual o custo por recolha, por quilómetro, por hora de equipa (motorista e tripulantes) e por contentor (compra, instalação, lavagem, manutenção)? Qual a vida útil? Qual o custo atual de recolha, triagem e destino por tonelada de têxtil, mesmo aproximado? Ordens de grandeza servem.

**Porque perguntamos.** `params.py` usa 6,0 € por recolha, 1,1 € por km, 1 200 € por contentor de rua (10 anos), 250 € em local existente (5 anos) e 26 recolhas por ano, **tudo pressuposto**. Há 41 turnos com 3 tripulantes e 40 com 2 (`shifts.csv`), por isso o custo de equipa pesa. Sem estes valores os €/t são estimativa (A15).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Valores completos | Dizer "dados da Vitrus"; repetir cenários A, B e francês; refazer a frase-âncora | `params.py`; tabela de pressupostos em [Dados e modelo](../engenharia/dados-e-modelo.md); registo A16+ |
| **B.** Parciais | Manter o resto como pressuposto assinalado; recalcular o tornado | Idem, só as linhas recebidas |
| **C.** Confidenciais | Pedir intervalos (mín.–máx.); mostrar P10 a P90 | [Cenários](cenarios-e-contingencias.md) B.2 |

**Valor assumido.** Estimativa: 6,0 €/recolha, 1,1 €/km, 1 200 €/contentor, com variação de ±30% (pressuposto da equipa).
**A quem · prazo.** V. **22.**

### Q5. Recolher têxteis nos circuitos e viaturas atuais

> **Pergunta.** É possível recolher têxteis nos circuitos e viaturas atuais? Em quais (moloks, porta a porta, PAYT, recicláveis), com que caixa e que capacidade em toneladas ou m³ por viatura, com que frequência mínima, e onde se descarrega? Os 9 circuitos sem viatura estão integrados noutros? As viaturas 29-48-XU e 74-HN-36 podiam servir um piloto?

**Porque perguntamos.** A afirmação "recolha a pedido sem km novos" assenta nos circuitos. Dos 40 circuitos, **nenhum é de têxteis** (24 indiferenciados, 7 orgânicos, 3 recicláveis, 1 volumosos, 1 PAYT, 2 de apoio, 2 a confirmar). Dos 18 circuitos porta a porta de indiferenciado, 8 não têm viatura (C8, C12, C15, C20 a C24). O ficheiro não traz capacidade, depósito nem custos; o modelo usa 4,0 t por viatura (pressuposto).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Sim, nos circuitos X | Marcar só X como elegíveis para a recolha a pedido | `circuits`/modelo; `piggyback_min_days` (hoje 2) |
| **B.** Não, exige viatura dedicada | Retirar "sem km novos" e modelar uma viatura dedicada (as duas nunca atribuídas, se livres) | `piggyback_extra_km` (hoje 1,5), `vehicle_capacity_t`; recalcular A e B; [narrativa](narrativa-do-pitch.md) |
| **C.** Só em dias ou turnos específicos | Restringir por dia e turno | Restrições do VRP e do "E se...?" |

**Valor assumido.** Estimativa: 4,0 t por viatura; recolha a pedido em circuitos com 2 ou mais dias por semana; +1,5 km por paragem; depósito no centro de Guimarães (41,4425; −8,2918).
**A quem · prazo.** V. **22.**

### Q6. O que significam 0,7 kg/hab/mês e 5,4%

> **Pergunta.** Os 0,7 kg/hab/mês e os 5,4% do Plano de Ação Integrado (URBACT, 25/11/2025, citando Perebynos et al. 2023) são o têxtil que ainda vai no indiferenciado, ou a geração total? Incluem têxteis sanitários? De que ano e de que campanha de caracterização vêm? Existe uma mais recente, por zona ou circuito?

**Porque perguntamos.** O modelo faz D = P × 0,7 × 12 (população × 0,7 kg × 12 meses) e trata o resultado (1 317,4 t) como procura total. O plano escreve "0,7 kg de têxteis nos RSU por mês per capita" [F74, p. 30]. Três medidas do mesmo conceito não batem:

| Medida | kg/hab/ano | t/ano para 156 830 hab. | Fonte |
| --- | --- | --- | --- |
| 0,7 kg/hab/mês | 8,4 | 1 317,4 | Plano [F74] |
| 5,4% × 315 kg de indiferenciado por habitante | 17,0 | 2 667,7 (cálculo) | Plano [F74, p. 31] |
| Nacional, 2024 (275 mil t no indiferenciado) | cerca de 25 | cerca de 3 900 (cálculo: 25 kg × 156 830) | BOG-EC [F78], sem metodologia |

O resumo do estudo diz que os dados de composição física são de **2016**, do Centro para a Valorização de Resíduos (excerto de pesquisa; artigo completo por ler) [F75]. A folha `RSU` de `dados_textil.xlsx` separa "Têxteis" (4,55%) de "Têxteis sanitários" (9,1%).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Residual no indiferenciado | Manter 1 317,4 t como "a captar"; dizer que a captura de 2025 é 18,6% (301,3 ÷ 1 618,6, estimativa) | [Dados e modelo](../engenharia/dados-e-modelo.md) secção 1; registo A8, A9; slide 2 |
| **B.** Geração total | Manter 22,9% | Registo A8 → "verificado pela Vitrus" |
| **C.** Inclui sanitários ou é de 2016 | Mostrar intervalo; separar o recuperável | `kg_per_inhab_month`; tornado; nota metodológica |

**Valor assumido.** Estimativa: 0,7 kg/hab/mês = 1 317,4 t/ano como potencial a captar e 22,9% de captura, sempre com a palavra "estimativa" (A8 continua "por verificar").
**A quem · prazo.** V; M (Laboratório da Paisagem e Divisão do Ambiente da Câmara, afiliações dos autores). **21**, porque define o slide 2.

### Q7. Como foi medido o destino, e a que preço

> **Pergunta.** Como obtiveram o destino de cada entidade? O ficheiro da H Sarah Trading diz "kg exatos por mês e por destino", mas dá exatamente 50%, 37% e 13% de 118,632 t. É pesagem ou percentagem contratual? Qual o destino físico de cada fração, que preço por tonelada se recebe ou paga em reutilização, reciclagem e rejeito, e que acordos existem com os operadores (taxa de ocupação, contrapartida por tonelada)?

**Porque perguntamos.** O Sankey (59,4/26,5/14,1) vai para o slide 5. Só a Ultriplo (134,130 t, 44,5%) tem uma divisão que não é redonda. Se a Sarah é percentagem, **55,5%** do total (167,135 t) é estimado e só 44,5% é medido (cálculo). A reutilização vai de 9,2% (Vitrus) a 72,9% (Ultriplo); o rejeito, de 10,0% (Nova Etapa, percentagem do relatório) a 56,9% (Vitrus, sobre 5,62 t). Não há preços: a receita e o €/t são pressupostos.

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Sarah mede de facto | Manter `weighed`; só Nova Etapa e Vitrus levam "estimativa" | Nada |
| **B.** Sarah é percentagem | Reclassificar `method` para `percentage`; "estimativa" em 55,5% do total | ETL `build_processed.py`; `textile_flows.csv`; registo A5; Sankey |
| **C.** Preços fornecidos | Receita real no €/t e na sensibilidade | `params.py`; registo A16+ |

**Valor assumido.** Estimativa: 59,4/26,5/14,1 como no ficheiro, com nota "duas entidades estimadas por percentagem, uma sob dúvida"; sem receita em €/t nos slides.
**A quem · prazo.** V. **22.**

### Q8. Os contentores municipais e o seu uso para têxteis

> **Pergunta.** Os 593 contentores de Profundidade e os 793 de Superfície são de indiferenciado, recicláveis ou misto? Quais são os ecopontos de vidro, papel e embalagens, e quem os recolhe, a Vitrus ou a Resinorte? Pode haver têxtil nestes locais (acesso de camião, licença) e em que tipo de contentor?

**Porque perguntamos.** `municipal_alerts.csv`, alerta 22: 1 386 contentores sem fração. Os **1 187 locais candidatos** (837 com coordenada precisa, 589 com enterrado) sustentam o modo "local existente" a 250 € por ponto (pressuposto). O plano municipal diz que a Resinorte faz a recolha seletiva fora das áreas de semienterrados [F74], pelo que os ecopontos podem nem estar no pacote. Um enterrado de 5 m³ não serve para têxtil sem adaptação (hipótese nossa).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Indiferenciado ou misto, têxtil permitido | Manter os 1 187 candidatos no modo `existing` | `stream` no ETL; [análise municipal](../dados/analise-contentores-municipais.md) |
| **B.** Ecopontos da Resinorte | Exigir acordo; candidatos só dos locais da Vitrus | Candidatos; custo do modo `existing` |
| **C.** Têxtil não permitido | Rede só em locais novos (`street`) | Cenários A e B; slide da rede |

**Valor assumido.** Estimativa: 250 €/ponto em local existente, sem custo de acesso; `stream = desconhecido`.
**A quem · prazo.** V. **22.**

### Q9. Fibrenamics: critérios de lote, destino de baixo valor e papel

> **Pergunta (Luís Miguel).** Que critérios de lote (composição mínima da fibra dominante, cor, elastano, botões e fechos, humidade, formato do fardo) a Fibrenamics precisa de ver para ensaiar têxtil pós-consumo triado? Que destino de baixo valor existe para o rejeito (14,1% = 42,3 t) e para a reciclagem (26,5% = 79,9 t)? Qual o seu papel neste desafio, e o que podemos dizer em público?

**Porque perguntamos.** O passaporte do lote e a bolsa de fibra são a ponte para a indústria. Não sabemos se a Fibrenamics aceita pós-consumo (M7), nem se é mentor do TexVitrus: o enunciado só indica Lucas Nascimento e o Prof. Paulo Afonso (M18). A recolha média é de 5,8 t por semana (301,3 ÷ 52, cálculo).

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Ensaia e aceita lotes | Carta de intenção e 3 a 5 fardos no plano do piloto; campos do passaporte conforme os critérios | Esquema do passaporte; [Mentores](mentores.md); slide 8 |
| **B.** Só pré-consumo | Destino de baixo valor como hipótese, sem nomear a Fibrenamics | Slide 6; registo M7 |
| **C.** Não responde | Contacto de oportunidade, não mentor atribuído | Registo M18 |

**Valor assumido.** Estimativa: passaporte atual (fibra dominante, composição declarada, estado, peso, com 0,415 kg por peça como pressuposto); nenhuma frase "validado pela Fibrenamics".
**A quem · prazo.** F; confirmar o papel com O. **22.**

### Q10. Êxito, orçamento e piloto

> **Pergunta.** O que consideram êxito para este desafio, e o que levaria a Vitrus a pilotar três meses em duas freguesias (toneladas, €/t, taxa de rejeito)? Quem decide (Vitrus, Câmara, juntas, Resinorte), com que orçamento e em que prazo? O plano de ação estima cerca de 5 milhões de euros para contentores em todas as freguesias: é esse o teto de referência?

**Porque perguntamos.** O pedido final do pitch é o piloto. O plano municipal (Ação 1) estima "cerca de 5 milhões de euros" e uma meta de **+30% de recolha seletiva**, que aparece como "até 2025" (p. 51) e "até 2026" (p. 67) [F74]. O recomendador sugere Gondar e a União de Arosa e Castelões (recomendação do `POST /planning/pilot`). Arosa e Castelões tem 699 habitantes e 33 contentores municipais, 9 deles com coordenada suspeita.

| Se a resposta for | O Novelo passa a… | Atualizar |
| --- | --- | --- |
| **A.** Aceitam, freguesias X | Fixar X; KPIs e piso de sinal de 1,71 t | `pilot.py`; slide 8; [Estratégia](estrategia-para-ganhar.md) |
| **B.** Preferem outras | Reexecutar o recomendador com restrições | `POST /planning/pilot` |
| **C.** Não pilotam | Pedir validação com dados medidos e lote com a Fibrenamics | Slide 8; [Cenários](cenarios-e-contingencias.md) F |

**Valor assumido.** Estimativa: piloto de 3 meses, 2 freguesias, piso de sinal de 1,71 t; orçamento sem teto oficial (o simulador compara vários; o exemplo de 60 000 €/ano é ilustrativo).
**A quem · prazo.** V. **22.**

---

## 3. Enquadramento que sustenta as perguntas

Pesquisa de 20 de outubro de 2026; fontes em [Fontes](../pesquisa/fontes.md) (F69 a F80). O quadro europeu já está em [Enquadramento regulatório](../pesquisa/enquadramento-regulatorio.md).

| Facto | Fonte | Perguntas |
| --- | --- | --- |
| O **RGGR** (Anexo I do Decreto-Lei 102-D/2020, de 10 de dezembro) obriga os municípios a recolher têxteis seletivamente até 1 de janeiro de 2025 (art. 36.º, n.º 2, c). O n.º 7 integra o custo nas tarifas; o n.º 8 exclui o que estiver sob RAP; o n.º 9 deixa a ANR fixar metas de pontos de recolha; o n.º 10 proíbe incinerar ou aterrar o recolhido para reutilização e reciclagem, salvo resíduos das operações de valorização; o n.º 11 permite fixar a percentagem máxima de contaminantes. Texto consolidado em vigor desde 23/05/2025 | [F69] | T5, B6, R6 |
| O DL 102-D/2020 foi alterado pela Lei 52/2021, pelo DL 11/2023, pelo DL 24/2024 (26 de março) e pelo DL 81/2025 (22 de maio, que completa a transposição da Diretiva 2018/851) | [F71], [F79] | B7 |
| Nota Técnica da APA (maio de 2025): têxtil usado, entregue e avaliado por profissional, não é resíduo; o que entra em **contentor** é sempre resíduo, com envolvimento do município por acordo ou subcontratação; códigos LER 20 01 10 e 20 01 11, depois 19 12 08; reporte no MIRR (formulários B e C1) | [F70] | R9, B8 |
| Em **8 de outubro de 2026** a APA disse que a transposição será "na próxima alteração ao UNILEX" e que falta definir modelo nacional, entidades gestoras, critérios, financiamento, valores, articulação com municípios e SGRU, metas e reporte. Houve sessões a 23 de janeiro e 8 de outubro | [F71] | B7 (reconfirma B11) |
| O presidente da APA diz que é urgente avançar com uma entidade gestora e que nem todos os municípios têm circuito de têxteis (24 de setembro de 2026) | [F72] | B7 |
| Até 2025, o têxtil em contentores de rua não era tratado como resíduo (intenção de reutilizar); hoje convivem a recolha para reutilização e a obrigação municipal de recolha de resíduos têxteis (vogal da APA, 12 de março de 2026) | [F73] | R9, B9 |
| A **Humana** retirou 256 contentores de vários municípios por já não aceitar pagar taxa de ocupação ou contrapartida para um serviço que passou a ser obrigação municipal; recolheu 3 919 t em 25 concelhos em 2025 e fica com 826 contentores | [F76] | T3, R7 |
| Plano de Ação Integrado de Guimarães: 5,4% e 0,7 kg; 315 kg de indiferenciado por habitante em 2023; 27 operadores LER 04, quatro com R3 ou R5; Ação 1 de cerca de 5 M€; meta de +30%; contentores em 88 escolas; Resinorte na recolha seletiva fora dos semienterrados | [F74] | Q6, Q8, Q10 |
| Os enterrados sob gestão da Vitrus têm 3 000 e 5 000 L (excerto de pesquisa), compatível com 17 de 3 m³ e 574 de 5 m³ no pacote; a Câmara anunciou em março de 2026 mais de 300 ecopontos (excerto de pesquisa) | [F77], [F80] | M1, R4 |

**Benchmarks para ancorar números** (não são promessas):

| Referência | Valor | Estado |
| --- | --- | --- |
| Guimarães, recolha seletiva de têxteis, 2025 | 1,92 kg/hab/ano | Cálculo (registo A2) |
| França, 2024 | 4,27 kg/hab | Secundária, por verificar na fonte primária (C1) |
| UE-27, recolha seletiva, 2020 | 4,4 kg/hab, de cerca de 16 kg gerados | Primária (C8) |
| Têxteis no indiferenciado: Portugal / Guimarães | cerca de 4% (Deckers 2024) / 5,4% | Plano municipal [F74]; Guimarães por confirmar (Q6) |
| Estimativas nacionais de resíduos têxteis urbanos | 250 mil t e 22,5 kg por agregado [F72]; 275 mil t e cerca de 25 kg por habitante [F78] | Secundárias e divergentes: **não usar em slide** sem a fonte primária |

---

## 4. Perguntas por tema

A última coluna resume a ação por resposta e o sítio a atualizar. As dez perguntas principais aparecem com a referência ao seu cartão.

### 4.1 Têxteis recolhidos e destino

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| T1 | V · 22 | Ver [Q7](#q7-como-foi-medido-o-destino-e-a-que-preço): como foi medido o destino de cada entidade | Sarah = 50/37/13% exatos de 118,632 t | Ver Q7 |
| T2 | V · 22 | As quatro entidades cobrem **todo** o têxtil recolhido em Guimarães em 2025? Há outras (Humana, Wippy, Cáritas, ecocentros, lojas)? | 301,265 t = Ultriplo 134,130 + Sarah 118,632 + Nova Etapa 42,883 + Vitrus 5,620 | Se há mais: nova entidade no ETL e recalcular A1, A2, A9. Se não: manter |
| T3 | V · 25 | Que contratos existem com cada entidade (duração, exclusividade, taxa de ocupação ou contrapartida por t)? Alguma renegociou ou deixou de pagar em 2026? | Humana retirou 256 contentores por este motivo [F76]; a Nota Técnica pede contratos com os operadores [F70] | Se há risco de saída: cenário "rede reduz"; ver custo do modo `existing` em `params.py` |
| T4 | V · 25 | Podem enviar a série **mensal** de 2025 por entidade, mais 2024 e janeiro a setembro de 2026? | A folha tem só totais anuais; a Sarah "dá kg por mês" na origem | Se sim: sazonalidade e efeito da obrigação de 1/1/2025 em "Ponto de partida" e na medição do piloto. Se não: taxa constante, "estimativa" |
| T5 | V · 22 | O que conta como "rejeito"? Porque é a Vitrus 56,9% (5,62 t) e as outras 10,0% a 14,5%? Quem fez a amostra e quando? | Rejeito total 42,3 t = 14,1%; Vitrus 3,197 t de 5,620 t | Se é amostra pequena ou escolar: etiqueta metodológica e não usar para o piloto. Se é geral: subir a taxa de rejeito usada no piloto (hoje 14,1%) |
| T6 | V · 25 | Podem enviar os três relatórios de origem (Ultriplo 2025, Nova Etapa, To Be Green) e o ficheiro "Sarah Trading Destinos"? | O xlsx cita-os como fonte, mas não os traz | Se sim: `data/raw/` e rever método por mês e por destino |
| T7 | V · 25 | Qual a composição da recolha: roupa, calçado, têxteis-lar; adulto e criança; peso médio por peça? | O passaporte usa 0,415 kg por peça (pressuposto) | Se há medição: substituir os pesos por tipo no passaporte e no piso de sinal (1,71 t) |
| T8 | V, M · 21 | Ver [Q6](#q6-o-que-significam-07-kghabmês-e-54): o que medem os 0,7 kg/hab/mês e os 5,4% | Três medidas entre 8,4 e cerca de 25 kg/hab/ano | Ver Q6 |
| T9 | V · 21 | O que a Vitrus entende por "caracterização do lixo indiferenciado com a fração têxtil"? Existe a de Guimarães? | A folha `RSU` é de Portugal (517 kg/hab.ano, 2024) e da Europa, não do concelho | Se existe: substituir a folha; se não: dizer "nacional" no ecrã |
| T10 | V · 25 | A folha `RSU` tem cinco pontos por explicar: Europa soma 97,8%, Portugal 99,21%, "Têxteis sanitários" 9,1% (o dobro de 4,55%), e duas células sem rótulo ("5 ton" e 0,408). Qual o significado? | `waste_composition.csv` | Se erro de digitação: corrigir o ETL; se real: nota na análise |
| T11 | V · 25 | A recolha inclui calçado? Em que quantidade, e com que destino? | A diretiva cobre calçado (anexo IV-C); o ficheiro não distingue | Se sim: categoria "calçado" no passaporte e no modelo |
| T12 | V · 25 | Para onde vão fisicamente as 179,0 t de reutilização, as 79,9 t de reciclagem e as 42,3 t de rejeito (operador, país)? Com que código LER? | O Sankey mostra o destino sem local; a Nota Técnica pede LER e e-GAR [F70] | Se exportam: assinalar no Sankey; se local: ligar a recicladores reais na bolsa de fibra |
| T13 | V · pós | As 5,62 t da Vitrus são a campanha das escolas? A notícia fala de cerca de 3 t em mais de 30 escolas [F57] e o plano de 88 escolas [F74] | Vitrus = 1,9% do total, rejeito 56,9% | Se sim: modo "instituições" e Sankey de valorização local (mantas, sacos) |

### 4.2 Rede de contentores de têxteis

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| R1 | V · 21 | Ver [Q2](#q2-a-lista-de-contentores-de-têxteis): a lista, o formato e a data | `containers.status = awaiting_data` | Ver Q2 |
| R2 | V · 21 | Podem seguir o [modelo de campos](#anexo-a-modelo-de-ficheiro-de-contentores-de-têxteis): latitude antes de longitude, capacidade em litros, freguesia por Dicofre? | O pacote de 20 out tem Y/X trocados em 3 de 5 ficheiros e 912 capacidades sem unidade | Se sim: importação direta. Se não: ETL corrige por intervalo e alerta |
| R3 | V · 21 | Que tipos de contentor de têxteis existem (rua, enterrado, escola, ecocentro)? Se a lista vier sem tipo, podemos assumir "têxtil"? | Cenário B.1 "sem tipo" tem probabilidade alta | Se confirmam: `--default-kind textile` e dizê-lo no ecrã |
| R4 | V · 22 | Quantos estão ativos hoje? Quantos foram retirados ou instalados desde 1/1/2025? Os "mais de 300 ecopontos" de 2026 incluem têxteis? | Cenários E.3 n.º 37: as fontes não mencionam têxteis; notícia de março de 2026 sobre mais de 300 ecopontos [F80] | Se incluem: contar na rede de partida; se não: lacuna maior |
| R5 | V · 22 | Quem recolhe cada contentor, com que frequência e com que viatura? É a Vitrus ou o operador? | Nenhum dos 40 circuitos é de têxteis; o têxtil é recolhido por quatro entidades, três delas externas à Vitrus | Se são externos: o VRP não otimiza esses km; o Novelo mede custo e cobertura, não rotas |
| R6 | V, M · 25 | Qual a regra de colocação (distância à população, população por ponto, escolas, juntas, associações com mais de 200 associados)? | `people_per_point` 1 500 (rua) e 4 000 (existente) são pressupostos; o plano propõe contentores em associações com mais de 200 associados (linha de intervenção 1, ponto 2) [F74] | Se há regra: restrição do otimizador. Se não: manter pressuposto |
| R7 | V, M · 25 | Quem autoriza cada ponto (junta, Câmara)? Que taxa de ocupação do espaço público se cobra por contentor? | A Humana pagava taxa ou contrapartida [F76] | Se há taxa: custo anual por ponto no modelo |
| R8 | V · 25 | Qual a capacidade (litros) dos contentores de têxteis e o enchimento típico entre recolhas? Há roubo ou vandalismo? | `collections_per_year` = 26 e 4,0 t por viatura (pressupostos) | Se há dados: calibrar frequência e toneladas por recolha |
| R9 | V · 25 | A Vitrus e a Câmara classificam estes contentores como rede de **resíduo têxtil** ou de **têxtil usado**? Há contratos revistos? Quem reporta no MIRR? | Nota Técnica da APA [F70]: o que entra em contentor é sempre resíduo | Se resíduo com contrato: o relatório RAP inclui a rede; se não: risco de conformidade a nomear |
| R10 | V · 25 | As rotas e km dos operadores externos (Ultriplo, Sarah, Nova Etapa) podem ser partilhados? | Base de qualquer VRP real de têxteis | Se sim: substituir o fator de desvio 1,3 por km reais |

### 4.3 Contentores municipais recebidos (pacote de 20 de outubro)

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| M1 | V · 22 | Ver [Q8](#q8-os-contentores-municipais-e-o-seu-uso-para-têxteis): que fração são Profundidade e Superfície, e quais são os ecopontos | 1 386 com `stream = desconhecido` | Ver Q8 |
| M2 | V · 25 | O que é uma "**plataforma**" (2 casos em Profundidade, 5 m³)? | `kind = platform`, sem marca | Se plataforma de elevação do enterrado: unir ao `underground` na contagem |
| M3 | V · 25 | A `Quantidade` nos resíduos verdes (1 a 7, soma 95 em 46 linhas) é o número de contentores no local? | `units_declared` 95 contra 46 contentores contados | Se sim: contagem de unidades = 95; senão manter 46 |
| M4 | V · 25 | As capacidades da Tipologia estão em litros (912 sem unidade: 10, 30, 45, 80, 1100)? Os 5 de 10 L são 110 L? Quais as 10 capacidades "???" (B596 a B602, B607 e mais 2)? | 4 315 830 L declarados; `capacity_status = assumed_litres` | Se litros: marcar `ok`; se 110 L: corrigir os 5; preencher as 10 |
| M5 | V · 22 | O inventário está completo em **Lordelo** (8 contentores, 2,0 por 1 000 hab.), **Serzedo e Calvos** (6, 2,7), **Tabuadelo e São Faustino** (7, 2,9) e **Infantas** (7, 4,0), contra 17,4 no concelho? Ou a recolha é porta a porta? | Nenhuma localidade dos circuitos fica ligada a Serzedo e Calvos, Tabuadelo e São Faustino ou Infantas (9 freguesias sem localidade); Lordelo cobre 13,3% da área a 300 m | Se faltam dados: pedir ficheiros. Se é porta a porta: marcar `door_to_door` por freguesia e separar "sem dados" de "sem contentores" no recomendador |
| M6 | V · 22 | Qual a **data de referência** do inventário e o que mudou desde então? | O projeto QGIS é de 9 de maio de 2025 (QGIS 3.36.2); sem data no ficheiro | Etiqueta "inventário de [data]" no mapa e nos candidatos |
| M7 | V · 25 | Que **versão da CAOP** devem usar? Qual o código oficial das 5 uniões (030876, 030881, 030883, 030884, 030890) contra os provisórios 0308U1 a 0308U5? | O pacote traz CAOP 2019; a DGT aprovou a CAOP2025 a 28/1/2026 [F66]; o plano fala em 55 freguesias, a CAOP em 48 | Se 2025: pedir/descarregar e trocar `caop_guimaraes.geojson`; trocar códigos em `parishes.csv` |
| M8 | V · 25 | O que significa o prefixo **BC** e a relação com Profundidade? | 233 de 394 BC localizados (59%) estão a ≤ 15 m de um contentor de rua, mas só 5 de 376 coincidem em número com o enterrado de igual número | Se BC é um contentor de orgânico instalado ao lado do de rua (hipótese nossa): partilham o local e não duplicam candidatos |
| M9 | V · 22 | As **79 coordenadas** a mais de 1 km da freguesia declarada estão erradas ou é o nome? Lista em `municipal_containers.csv` (`coord_suspect = true`) | Profundidade 6, Superfície 23, Coletivo 25, Tipologia 21, Verdes 4; Arosa e Castelões 9 de 33, Longos 9 de 31, Costa 8 de 140, Mesão Frio 7 de 107 | Se coordenada errada: pedir correção. Se nome: manter o polígono |
| M10 | V · 25 | Existem os **29 sem coordenadas** (C688, C792, C794, BC191, BC328, BC405, B236, B242 e mais 21)? C792 e C794 só têm ID e capacidade | 29 `pending`, fora do mapa e das contagens | Se existem: pedir coordenadas. Se não: retirar |
| M11 | V · 25 | Podem recolher por GPS os **509** contentores com coordenadas de 3 casas decimais (508 em Superfície)? Os 11 "Escola Secundária" estão em ruas diferentes? | Erro até cerca de 100 m; 350 locais aproximados | Se sim: subir a precisão dos candidatos |
| M12 | V · 25 | Porque estão os cabeçalhos Y e X **trocados** em Profundidade (593), Coletivo (394) e Verdes (46)? Mantém-se nos próximos ficheiros? | 1 033 linhas; Superfície e Tipologia estão certos | Baixo impacto: o ETL corrige por intervalo; pedir correção na fonte |
| M13 | V · 25 | Os contentores C617 e C618 ("Tv de entre latas", declarados em Figueiredo) estão a 453 m do concelho: erro de coordenada? | 2 rejeitados em `municipal_containers_rejected.csv` | Se erro: corrigir e reintegrar |
| M14 | V · 25 | Qual a **frequência de recolha e o custo por esvaziamento** de enterrado, superfície e orgânico? | Para estimar o ganho de pôr têxtil nos mesmos locais | Se há valores: custo de recolha por modo no simulador |
| M15 | V · pós | "Cidade" (41 contentores), "Penha" (7), "PEVIDÉM" (3) e "Caldas das Taipas" (1) são o quê? | 52 `nao_mapeada`; a freguesia vem do polígono | Baixo impacto: confirmar "Cidade" = centro histórico |
| M16 | V · pós | Os 12 grandes produtores (32 contentores só no Hospital Senhora da Oliveira) e os 9 de hotelaria têm contacto B2B para roupa de cama, toalhas e fardamento? | 922 contentores de produtores; 452 locais | Se sim: modo B2B dedicado; nomes só com autorização (L2) |

### 4.4 Circuitos, viaturas e turnos

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| V1 | V · 22 | Ver [Q5](#q5-recolher-têxteis-nos-circuitos-e-viaturas-atuais): têxteis nos circuitos atuais, capacidade e descarga | 0 de 40 circuitos de têxteis | Ver Q5 |
| V2 | V · 22 | De onde saem os circuitos e onde se descarrega (depósito, compactador de Aldão, Resinorte)? Coordenadas? | Depósito = centro de Guimarães (pressuposto); BIO 5 vai a "Aldão (compactador)" | Se há depósito: `depot_lat/lon` e VRP |
| V3 | V · 22 | Custos por km, hora, combustível e motoristas | Ver [Q4](#q4-custos-unitários-e-vida-útil) | Ver Q4 |
| V4 | V · 22 | Os 9 circuitos sem viatura (BIO 5, C8, C12, C15, C20, C21, C22, C23, C24) estão integrados noutros ou faltam no planeamento? | Alerta 1; 8 dos 18 circuitos porta a porta de indiferenciado | Se integrados: mapear; se faltam: a recolha a pedido não conta com eles |
| V5 | V · 25 | As viaturas 29-48-XU e 74-HN-36 são reserva, oficina ou apoio? Estão livres para um piloto? | Nunca têm circuito; alerta 9 | Se livres: cenário "viatura dedicada" |
| V6 | V · 25 | Em 12 dos 101 turnos a tripulação é 0 (MONSTROS, PAYT noite, LAVAGEM CONTENTORES, C.H, SEM CIRCUITO): erro ou sem equipa? | Os outros: 41 turnos com 3, 40 com 2, 8 com 1 (`shifts.csv`) | Se erro: corrigir `fleet_capacity.csv` e o custo de mão de obra |
| V7 | V · 25 | Confirmam V1 = AR-93-SQ, V2 = AR-81-SQ, V3 = 60-93-ZG ou AS-75-SG, V4 = AN-50-LT? | Alerta 2: códigos V1 a V4 por trocar por matrículas | Se sim: substituir no ETL e fechar o alerta |
| V8 | V · 25 | Podem completar localidades e dias de SELETIVO, RECICLAGEM, CARTÃO, MONSTROS, PAYT, CONTENTORES e LAVAGEM? | Alerta 10: têm viaturas mas não localidades nem dias | Se sim: cobertura de recicláveis e apoio no mapa |
| V9 | V · 25 | Há janelas horárias (centro histórico), limites de ruído, regras de fim de semana ou feriado? Qual a regra de horas de condução? | 7 turnos de noite, 8 ao domingo; folha FERIADOS CHG (04/06/2026) não usada | Se há: restrições no VRP e no "E se...?" |
| V10 | V · 25 | Viaturas multi-tipologia (60-93-ZG faz C7 e BIO 3 no mesmo turno): lava-se a caixa entre fluxos? Serve para têxtil, que tem de ir seco e sem compactar? | Alerta 8 | Se não serve: requisito de caixa para viatura de têxteis |
| V11 | V · 25 | A semana de 21 a 25/09/2026, o sábado 19/09 e o domingo 20/09 são típicos? O planeamento do fim de semana é da mesma semana? | Alerta 11 | Se típicos: "semana tipo" no modelo |
| V12 | V · 25 | Têm a lista oficial das 82 localidades com freguesia? | 11 sem coordenadas ("Ruas Estreitas", "Urgezess(5ª)"...) e 21 sem freguesia (61 de 82 ligadas) | Se sim: fecha a ligação circuito → freguesia |
| V13 | V · 25 | Quilómetros, tempos e toneladas por circuito e por viatura, e pesagens? | O fator de desvio 1,3 e o limite de 20 s são pressupostos | Se sim: calibrar VRP e rotas |
| V14 | V · pós | Há GPS ou telemetria nas viaturas? | Rotas reais em vez de linha reta × 1,3 | Se sim: OSRM com perfis reais |

### 4.5 Orçamento, metas, RAP e prazos

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| B1 | V · 22 | Ver [Q4](#q4-custos-unitários-e-vida-útil): custos unitários | `params.py` | Ver Q4 |
| B2 | V · 22 | De onde vem o orçamento para a rede de têxteis em 2026 e 2027 (Vitrus, Câmara, Fundo Ambiental, FEDER, PRR)? Há teto anual? | A Ação 1 do plano estima cerca de 5 M€ com financiamento misto [F74, p. 65] | Se há teto: valor por omissão do simulador |
| B3 | V · 22 | O que conta como êxito: toneladas, captura, €/t, cobertura, rejeito máximo? | O pitch precisa de uma frase-âncora com X e Y | Se há metas: KPI do cenário B e do piloto |
| B4 | V · 25 | A meta de **+30% de recolha seletiva** é sobre que base e para que ano (2025 ou 2026)? | O plano diz "até 2025" (p. 51) e "até 2026" (p. 67) [F74]; 301,265 × 1,3 = 391,6 t (cálculo) | Se a base é 301,3 t: cenário de referência "meta do plano" a 391,6 t |
| B5 | V · 22 | Ver [Q10](#q10-êxito-orçamento-e-piloto): o que levaria a Vitrus a pilotar | Pedido final do pitch | Ver Q10 |
| B6 | V, M · 25 | O custo da recolha seletiva de têxteis já entra na tarifa (art. 36.º, n.º 7 do RGGR)? Qual a tarifa de aterro ou incineração por tonelada, para o custo evitado? | A fórmula de custo em [Dados e modelo](../engenharia/dados-e-modelo.md) não tem custo evitado; o n.º 8 exclui o que ficar sob RAP [F69] | Se sim: custo evitado por t; relatório RAP mostra quando sai da tarifa |
| B7 | V, M · 25 | Qual a posição da Vitrus e da Câmara sobre a RAP de 2028? Já falaram com a APA ou a ANMP? Querem o relatório RAP como dossiê de custo eficiente? | A APA diz que falta tudo o que é nacional (8/10/2026) [F71]; registo B11 | Se sim: texto e métricas do relatório RAP; slide de 2028 |
| B8 | V · pós | Quem reporta os têxteis no MIRR/SILiAmb? As 301,3 t coincidem com o reportado à APA? | A Nota Técnica pede reporte anual [F70] | Se coincide: sobe para "verificado" (A1); se não, explicar a diferença |
| B9 | V · pós | Que prazo têm os operadores para rever contratos com o município? | [F70]; Humana [F76]; [F73] | Se há prazo: risco no cenário de saída |
| B10 | V · pós | Que calendário interno têm a Vitrus e a Câmara (concurso de contentores, orçamento de 2027, revisão de contratos) antes de 17 de abril de 2028? | Prazos europeus em [F71]; o plano fala em implementação faseada [F74] | Se há calendário: alinhar o piloto e o roadmap do slide 8 |

### 4.6 Dados em falta

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| F1 | V, M · pós | Têm toneladas de têxtil por **contentor ou ponto, por mês**? | Hoje a lacuna por freguesia assume 22,9% igual em todas | Se sim: calibração por zona e lacuna real em vez de estimativa |
| F2 | V, M · pós | Têm a população por quarteirão (BGRI) ou por lugar? | A cobertura de 31,4%, 47,8% e 70,9% é de **área**, não de pessoas | Se sim: cobertura de população; senão manter "área" |
| F3 | V, M · pós | Têm uma estimativa de população por freguesia mais recente do que os Censos 2021? | Os rácios por 1 000 hab. e a lacuna usam 2021; o plano cita 156 277 habitantes (INE, 2022) [F74] | Se sim: trocar `population` em `parishes.csv` com o ano indicado |
| F4 | M · pós | Usam indicadores de rendimento, idade ou tipo de alojamento por freguesia no planeamento? (hipótese: explicam diferenças de captura) | Só há TIPAU: 36 freguesias predominantemente urbanas, 11 medianamente urbanas e 1 rural (`parishes.csv`) | Se sim: segundo fator de procura além do TIPAU; senão manter |
| F5 | V · pós | Há contagens de população flutuante (turistas, estudantes) por zona? | Azurém tem 13 contentores no campus da UMinho; hotelaria tem 21 contentores | Se sim: ajustar a procura em Azurém e centro |
| F6 | M · pós | Existe o mapeamento previsto no plano (linha de intervenção 1, ponto 3: indústrias têxteis com e sem MIRR)? | O setor têxtil pesa cerca de 63% da indústria do concelho [F74] | Se sim: camada de produtores industriais |
| F7 | V · 25 | Podem enviar os dados de 2026 (janeiro a setembro) e de 2024? | Efeito da obrigação de 1/1/2025 e da Capital Verde Europeia | Se sim: tendência em "Ponto de partida" |
| F8 | V · pós | Há reclamações ou pedidos de cidadãos sobre contentores de roupa? | Procura percebida | Se sim: camada de pedidos |

### 4.7 Legal e RGPD

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| L1 | V · 21 | Ver [Q1](#q1-autorização-de-uso-dos-dados-e-do-nome): autorização de uso | `data/raw/` no Git | Ver Q1 |
| L2 | V · 22 | Podemos mostrar **nomes de produtores** (922 contentores, 452 locais, 6 tipos) no mapa e na demo? Há empresários em nome individual? Há contacto B2B autorizado? | Restauração 304 produtores distintos, escolas 87, estabelecimentos 39, lares 17, grandes produtores 12, hotelaria 9 | Se não: camada só agregada |
| L3 | V · 22 | Podemos mostrar **matrículas** e nomes de operadores (Ultriplo, H Sarah Trading, Nova Etapa) nos slides? | 29 matrículas; rejeito por operador é dado comercial | Se não: "operador A, B, C" e matrículas mascaradas |
| L4 | O, V · 21 | O repositório (público hoje) pode ficar assim com `data/raw/`? Pode ir sem esses ficheiros? | A organização verifica o histórico (E12); hashes SHA-256 em `sources.json` | Como já é público: retirar os ficheiros brutos (e do histórico, se exigido) e manter só os hashes |
| L5 | O · 22 | A organização tem política RGPD para fotos, gravação de pitches e contas de convidado (jurados, mentores)? | A app envia e-mails de verificação e boas-vindas a convidados | Se há: aviso e retenção; se não: sem contas de jurados, só demonstração |
| L6 | V · 22 | Aceitam que dados agregados da Vitrus (nunca nomes nem matrículas) sigam para modelos de IA de terceiros via OpenRouter? | Os recursos de IA enviam texto e dados do cenário a um fornecedor externo; sem chave a API responde 503 | Se não: copiloto sem dados da Vitrus; documentar em [IA](../engenharia/ia.md) |
| L7 | O, V · pós | Que licença pode ter o repositório e que direitos tem a Vitrus sobre os dados depois de 28 de outubro? A app pode manter os dados em produção? | A propriedade intelectual é dos autores [F59]; condições próprias dos desafios (M17) | Se há restrição: remover dados da produção |

### 4.8 Operação: lote, triagem e recicladores

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| O1 | F · 22 | Ver [Q9](#q9-fibrenamics-critérios-de-lote-destino-de-baixo-valor-e-papel): critérios de lote e destino de baixo valor | Rejeito 42,3 t; reciclagem 79,9 t | Ver Q9 |
| O2 | V · 25 | Quem triaria os lotes do piloto, onde e com que balança? | O peso é pressuposto (0,415 kg por peça) | Se há balança: peso real; protocolo de 30 a 50 peças |
| O3 | V · 25 | Onde vai o QR do lote (fardo, saco, contentor) e quem o lê? Que campos podem ser públicos no passaporte? | O passaporte é público | Se há restrição: reduzir campos públicos |
| O4 | V · 25 | Aceitam a triagem por foto como pré-triagem, com o operador a confirmar? Que erro toleram? | Exatidão por medir (D4) | Se aceitam: critério de aceitação da matriz de confusão |
| O5 | V, F · 25 | Com que recicladores trabalham (destino das 79,9 t)? Podem apresentar-nos Sasia, Recutex, Riopele ou CITEVE? | Falta uma frase de reciclador para o slide 6 | Se sim: mensagem com referência; senão "em conversa" |
| O6 | F · 25 | Qual o tamanho mínimo de fardo e a frequência de entrega? A amostragem do piloto (1 032 peças por célula, efeito de desenho 2) é adequada? | Piso de sinal de 1,71 t (pressuposto) | Se não: rever `pilot.py` |
| O7 | V · pós | Em que formato têm as pesagens (balança, e-GAR)? Aceitam exportação semanal em CSV? | Evitar integração com ERP | Se sim: importador CSV |
| O8 | V, F · 25 | Podemos mostrar na bolsa de fibra nomes reais de recicladores ou só "reciclador A"? | Nomes são dados comerciais | Se não: mascarar |

### 4.9 Avaliação, regras e formato (organização)

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| J1 | O · 21 | Ver [Q3](#q3-regras-pitch-e-submissão-de-23-de-outubro): Regras, pitch e submissão | E4 a E8 | Ver Q3 |
| J2 | O · 21 | Quanto dura o pitch? Há perguntas do júri, quanto tempo? A demo ao vivo é permitida? Que ligação, ecrã e som há na sala? | E5 pressuposto de 5 min; kit de contingência | Se muda: [Cenários](cenarios-e-contingencias.md) A.2 |
| J3 | O · 21 | A submissão é só na TAIKAI? Que campos e ficheiros são obrigatórios? Como declarar IA, APIs e código de terceiros? Há rascunho? | Prazo de 23 out, 17h30; E11 | Se há campos novos: lista do dia 22 |
| J4 | O · 22 | Quem integra o júri (nomes ou perfis)? Há representantes da Vitrus, da Câmara, da UMinho ou da Fibrenamics? | A Vitrus atribui o prémio do desafio (E13) | Se há: adaptar a linguagem; se não: pitch para júri misto |
| J5 | O · 22 | O Luís Miguel Oliveira é mentor deste desafio? Qual a disponibilidade dele e do Prof. Paulo Afonso, e onde (CIAJG)? | M18: o enunciado só indica Lucas Nascimento e o Prof. Paulo Afonso | Se sim: pode ser dito "mentor"; se não: contacto de oportunidade |
| J6 | O · 22 | Os desafios de empresas têm condições próprias de dados e propriedade intelectual (M17). Quais as do TexVitrus? | [F59], [F61] | Se há: ajustar licença e Q1 |
| J7 | O · 25 | Há regras sobre material de apoio (vídeo, PDF, folheto), número de pessoas em palco e quem opera a demo? | Plano com Hélder a apresentar e Flávio a operar | Se restringe: reajustar o ensaio |
| J8 | O · 25 | Como e quando se comunica o feedback do júri e os resultados de 28 de outubro? | Cenários F | Se há feedback escrito: pedir uma cópia |
| J9 | O, V · 22 | O que a organização e a Vitrus entendem por "potencial de continuidade" (parceiro confirmado, plano, equipa)? Que exemplos de edições anteriores consideram bons? | Critério de 20%; texto oficial: "protótipo funcional com potencial de continuidade, não um produto acabado" (E10) | Se há exemplos: ajustar o slide 8 e o plano de continuidade |

### 4.10 Continuidade pós-hackathon

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| C1 | V · 22 | Ver [Q10](#q10-êxito-orçamento-e-piloto): êxito, orçamento e piloto | Pedido final | Ver Q10 |
| C2 | V · pós | Gondar e a União de Arosa e Castelões são viáveis? Gondar: 2 581 hab., 16 contentores (6,2 por 1 000 hab.), 14 locais públicos, cobertura a 300 m 47,3%, 0 coordenadas suspeitas. Arosa e Castelões: 699 hab., 33 contentores (47,2), 28 locais públicos, 56,4%, 9 suspeitas, a única freguesia "predominantemente rural" | `municipal_by_parish.csv`; `parishes.csv` | Se não: recomendador com outras (Lordelo é a nº 1 da lacuna estimada, 25,8 t/ano) |
| C3 | V, M · pós | Quem são os contactos nas juntas de freguesia, na Resinorte e no Laboratório da Paisagem? Pode apresentar-nos? | O plano lista 55 juntas, Vitrus, Resinorte e To Be Green como partes interessadas [F74] | Se sim: mensagem com referência |
| C4 | V, F, P · pós | Existe uma candidatura (PRR, FEDER, LIFE, Horizon) onde o Novelo possa entrar? | O plano lista fundos mistos e NetZero Cities [F74] | Se sim: escrever o consórcio; senão "hipótese" |
| C5 | F, P · pós | Há espaço para uma dissertação ou um projeto sucessor do Lusitano? | Mentores | Se sim: tema e orientador por escrito |
| C6 | V · pós | Quem aloja, mantém e financia o Novelo depois de 28 de outubro? Pode manter o acesso aos dados? | Produção em Coolify | Se não: exportar e apagar |
| C7 | V · pós | Que formato de relatório de piloto querem receber (KPIs, periodicidade)? | KPIs do piloto já na app | Se há formato: relatório RAP adaptado |

### 4.11 Modelo e investimento (Prof. Paulo Afonso)

A lista completa está em [Mentores](mentores.md#prof-paulo-afonso-uminho-produção-e-sistemas). Aqui só ficam as que dependem dos dados de 20 de outubro.

| ID | Quem · prazo | Pergunta | Dado que a motiva | Respostas → ação |
| --- | --- | --- | --- | --- |
| P1 | P · 21 | Para cobertura, o raio de 300 m por **área** (47,8%) é defensável quando falta a população por quarteirão? | Pergunta F2 (BGRI em falta) | Se não: cobertura ponderada por população das freguesias |
| P2 | P · 21 | A lacuna por freguesia, com captura igual de 22,9% em todas, é uma aproximação aceitável? | 48 freguesias; sem têxtil por freguesia | Se não: mostrar só ranking de potencial |
| P3 | P · 21 | Como tratar 350 locais com coordenada aproximada (±100 m) e 79 coordenadas suspeitas na otimização? | Alertas municipais 7 e 18 | Se pede: simulação com ruído posicional |
| P4 | P · 21 | O piso de 1,71 t em 3 meses (2 freguesias × 2 modos, efeito de desenho 2) é razoável? | `pilot.py` | Se não: rever o piso |
| P5 | P · 21 | Que método de custeio devemos usar quando os custos da Vitrus chegarem em partes? | [Q4](#q4-custos-unitários-e-vida-útil) | Se TDABC ou TCO: nota metodológica |

---

## 5. Inconsistências e anomalias nos dados

Cada linha justifica uma pergunta. As contas são nossas e repetíveis a partir de `data/processed/`.

### 5.1 Têxteis (`dados_textil.xlsx`)

| # | Anomalia | Números | Efeito se ficar por resolver | Pergunta |
| --- | --- | --- | --- | --- |
| 1 | A Sarah está "kg exatos por mês e por destino", mas a divisão é redonda | 59,316 / 43,894 / 15,422 t = 50% / 37% / 13% de 118,632 t | 55,5% do total (167,135 t) é estimado, não 16,1% | T1, Q7 |
| 2 | Nova Etapa e Vitrus usam percentagens de relatórios | Nova Etapa 50/40/10 sobre 42,883 t; Vitrus 9,16/33,96/56,88 sobre 5,620 t | Sankey observado com "estimativa" em 16,1% | Q7 |
| 3 | Rejeito muito diferente entre entidades | 10,0% (Nova Etapa, percentagem do relatório), 13,0% (Sarah), 14,5% (Ultriplo), 56,9% (Vitrus) | O 14,1% global pesa pouco a Vitrus (1,9% do total) | T5 |
| 4 | Reutilização muito diferente | 9,2% (Vitrus) a 72,9% (Ultriplo); a Ultriplo dá 54,6% de toda a reutilização | Média escondida por um só operador | T1 |
| 5 | A composição dos RSU é de Portugal e da Europa | Portugal 517 kg/hab.ano; Europa soma 97,8%; Portugal 99,21% | Não há caracterização de Guimarães no ficheiro | T9, T10 |
| 6 | Têxteis sanitários valem o dobro dos têxteis | 9,1% contra 4,55% (soma 13,65%) | Risco de o potencial incluir fração não recuperável | Q6 |
| 7 | Células sem rótulo | "5 ton" e 0,408 na folha `RSU` | Dúvida sobre o que mais foi deixado na folha | T10 |

### 5.2 Circuitos, viaturas e turnos

| # | Anomalia | Números | Efeito se ficar por resolver | Pergunta |
| --- | --- | --- | --- | --- |
| 8 | Nenhum circuito é de têxteis | 0 de 40 (24 indiferenciados, 7 orgânicos, 3 recicláveis, 1 volumosos, 1 PAYT, 2 apoio, 2 a confirmar) | "Sem km novos" não está provado | Q5 |
| 9 | Circuitos sem viatura | 9 de 40; 8 de 18 porta a porta de indiferenciado | A recolha a pedido perde base | V4 |
| 10 | Viaturas nunca atribuídas | 2 de 29 (29-48-XU, 74-HN-36) | Capacidade livre por confirmar | V5 |
| 11 | Turnos sem tripulação | 12 de 101 | Custo de mão de obra errado | V6 |
| 12 | Códigos de viatura V1 a V4 | 4 códigos por trocar por matrículas | Ligação circuito → viatura incerta | V7 |
| 13 | Serviços sem localidades nem dias | 7 (SELETIVO, RECICLAGEM, CARTÃO, MONSTROS, PAYT, CONTENTORES, LAVAGEM) | Recicláveis sem cobertura | V8 |
| 14 | Localidades sem coordenadas ou sem freguesia | 11 de 82 sem coordenadas; 21 sem freguesia | 9 freguesias sem localidade ligada | V12 |
| 15 | Sem capacidade, depósito nem custos | 0 campos no ficheiro | 4,0 t e centro de Guimarães são pressupostos | Q4, V2 |
| 16 | Datas misturadas | Semana 21 a 25/09/2026, sábado 19/09, domingo 20/09 | Fim de semana pode não ser da mesma semana | V11 |

### 5.3 Contentores municipais (pacote de 20 de outubro)

| # | Anomalia | Números | Efeito se ficar por resolver | Pergunta |
| --- | --- | --- | --- | --- |
| 17 | Coordenadas trocadas nos cabeçalhos | 3 de 5 ficheiros; 593 + 394 + 46 = 1 033 linhas | Pontos no sítio errado sem correção | M12 |
| 18 | Coordenadas a mais de 1 km da freguesia declarada | 79 (3,0% dos 2 670 comparáveis) | Contagens por freguesia e candidatos errados | M9 |
| 19 | Freguesia declarada diferente do polígono | 316 de 2 670 (11,8%); 210 a mais de 100 m | Nomes não fiáveis | M9 |
| 20 | Escritas da freguesia | 166 escritas para 48 freguesias; 52 contentores com nome que não é freguesia | A normalização depende de uma tabela nossa | M15 |
| 21 | Coordenadas aproximadas | 509 com 3 casas ou menos (508 em Superfície); 350 locais | Distâncias curtas pouco fiáveis | M11 |
| 22 | Sem coordenadas | 29 | Fora do mapa e das contagens | M10 |
| 23 | Capacidades "???" | 10 (B596 a B602, B607 e mais 2) | Soma de litros incompleta | M4 |
| 24 | Capacidade sem unidade | 912 (Tipologia) lidas como litros | Assunção por confirmar | M4 |
| 25 | Capacidade de 10 L | 5 contentores de produtores | Possível 110 L | M4 |
| 26 | Fração desconhecida | 1 386 (593 + 793) | Candidatos a têxtil sem base | Q8 |
| 27 | `Quantidade` ambígua | 46 linhas, valores 1 a 7, soma 95 | Contagem de unidades dupla | M3 |
| 28 | Freguesias com muito poucos contentores | Lordelo 2,0; Serzedo e Calvos 2,7; Tabuadelo e São Faustino 2,9; Infantas 4,0 por 1 000 hab., contra 17,4 | "Sem dados" confundido com "sem contentores" | M5 |
| 29 | Rácio inflacionado e suspeito | Arosa e Castelões: 47,2 por 1 000 hab. (33 contentores, 699 hab.), 9 suspeitos | Pode distorcer o piloto | C2 |
| 30 | Fora do concelho | 2 contentores (C617, C618) a 453 m | Rejeitados | M13 |
| 31 | IDs `BC` não espelham Profundidade | 5 de 376 com número igual estão a ≤ 15 m | Relação só espacial | M8 |
| 32 | Códigos provisórios | 5 uniões: 0308U1 a 0308U5 contra 030876, 030881, 030883, 030884, 030890 | Ligação por nome | M7 |
| 33 | Sem data nem versão | Projeto QGIS de 9 mai 2025; CAOP 2019; CAOP2025 aprovada em 28/1/2026 | Inventário e limites podem estar desatualizados | M6, M7 |
| 34 | Muitos contentores no mesmo ponto | 32 no Hospital Senhora da Oliveira; 11 "Escola Secundária" num ponto aproximado | Locais fundidos | M11 |

### 5.4 Plano municipal e fontes públicas

| # | Anomalia | Números | Efeito se ficar por resolver | Pergunta |
| --- | --- | --- | --- | --- |
| 35 | 0,7 kg e 5,4% × 315 kg não coincidem | 8,4 contra 17,0 kg/hab/ano; 1 317,4 contra 2 667,7 t | Potencial incerto por um fator 2 (cálculo) | Q6 |
| 36 | Dados de caracterização de 2016 | Resumo de Perebynos et al. 2023 [F75], excerto de pesquisa | Valor com 10 anos em 2026 | Q6 |
| 37 | Freguesias e população | O plano diz 55 freguesias e 156 277 habitantes (INE, 2022); a CAOP tem 48 e o INE (Censos 2021) 156 830 | Diferença de 553 hab. (0,35%, cálculo) | M7 |
| 38 | Meta de +30% com dois anos | "até 2025" e "até 2026" no mesmo plano | Sem base nem data | B4 |
| 39 | "27 operadores" não é só Guimarães | 27 operadores LER 04 em Guimarães e sete concelhos vizinhos; 4 com reciclagem ou valorização | A11 deve dizer "região", e LER 04 é resíduo industrial | O5 |
| 40 | Números nacionais divergentes | 250 mil t e 22,5 kg por agregado [F72]; 275 mil t e 25 kg por habitante [F78] | Não usar em slide | Q6 |

---

## 6. Mensagens prontas

Todas em pt-PT, sem afirmar nada que ainda não foi ouvido. Se a mensagem de 19 de outubro ao Lucas já foi enviada, usar esta como seguimento.

### 6.1 Vitrus Ambiente (Lucas Nascimento)

**E-mail**

**Assunto:** Novelo (TexVitrus): seis confirmações para fechar os números até quinta, 22 de outubro

Bom dia, Lucas,

Obrigado pelos dados. Já os usámos no Novelo: 301,3 t em 2025, 40 circuitos, 29 viaturas e os 2 751 contentores municipais de 20 de outubro. A leitura deixou perguntas concretas. Eis as seis que mais pesam, por ordem:

1. **Autorização.** Podemos usar em público (slides, demo e repositório partilhado com a organização) os vossos dados e o nome da Vitrus? O que deve ficar só agregado, nomeadamente nomes de produtores e matrículas?
2. **Contentores de têxteis.** Quando recebemos a lista, em que formato e com que operador? O pacote de 20 de outubro só traz outras frações.
3. **Custos.** Custo por recolha, por quilómetro, por hora de equipa, por contentor (compra, instalação, lavagem) e vida útil. Ordens de grandeza servem.
4. **Circuitos.** Nenhum dos 40 circuitos é de têxteis. Podem recolher-se têxteis nos circuitos e viaturas atuais, com que capacidade e onde se descarrega? Os 9 circuitos sem viatura estão integrados noutros? As viaturas 29-48-XU e 74-HN-36 estão livres?
5. **Potencial.** Encontrámos o Plano de Ação Integrado para a Circularidade Têxtil (URBACT, 25/11/2025). Os 0,7 kg/hab/mês referem-se ao têxtil que fica no indiferenciado ou à geração total? Os dados de composição são de 2016? Há uma caracterização mais recente?
6. **Destino.** O ficheiro da H Sarah Trading diz "kg exatos", mas dá exatamente 50%, 37% e 13% de 118,632 t. É pesagem ou percentagem? E qual o preço por tonelada de cada fração?

Temos ainda uma tabela com 40 inconsistências nos ficheiros, para resolver em conjunto. Teria 15 minutos hoje ou amanhã?

Cumprimentos,
Hélder Gonçalves e Flávio Fernandes (Novelo, desafio TexVitrus)

**WhatsApp**

> Olá Lucas, é o Hélder (Novelo). Usámos os vossos dados e ficámos com 6 dúvidas que bloqueiam os números: 1) podemos usar os dados e o nome da Vitrus em público? 2) quando chega a lista de contentores de têxteis? 3) custos por recolha, km, hora e contentor (ordens de grandeza servem); 4) dá para recolher têxtil nos circuitos atuais? 5) os 0,7 kg/hab/mês do plano são o que sobra no indiferenciado ou a geração total? 6) a Sarah Trading é pesagem ou 50/37/13%? Tem 15 minutos hoje ou amanhã?

### 6.2 Fibrenamics (Luís Miguel Oliveira)

**E-mail**

**Assunto:** Novelo (TexVitrus): 10 minutos sobre critérios de lote pós-consumo

Bom dia, Luís Miguel,

Somos o Hélder e o Flávio, da equipa Novelo, no desafio TexVitrus do Hack4Guimarães 2035. O Novelo desenha a rede de recolha de têxteis de Guimarães ao menor custo e entrega a cada lote um passaporte (fibra dominante, composição declarada, estado e peso). Partimos de dados da Vitrus: 301,3 t em 2025, das quais 26,5% (79,9 t) seguiram para reciclagem e 14,1% (42,3 t) para rejeito.

Precisávamos de ouvir a sua opinião em quatro pontos:

1. **Critérios de lote.** O que a Fibrenamics precisaria de ver num lote pós-consumo para o ensaiar (composição mínima, cor, elastano, botões e fechos, humidade, formato do fardo)?
2. **Destino de baixo valor.** Para misturas e rejeito, que destinos existem (não tecidos, isolamento, compósitos) e com que exigências?
3. **Ensaio.** Seria possível caracterizar 3 a 5 fardos do piloto? Com que custo e prazo?
4. **Papel e linguagem.** É mentor deste desafio? E o que podemos dizer em público: "em conversa com a Fibrenamics", ou nada?

Não afirmaremos qualquer validação enquanto não a tivermos por escrito. Tem 10 minutos entre hoje e quinta-feira?

Cumprimentos,
Hélder Gonçalves e Flávio Fernandes

**WhatsApp**

> Bom dia, Luís Miguel. Somos o Hélder e o Flávio (Novelo, desafio TexVitrus). Temos 4 perguntas: que critérios de lote pós-consumo a Fibrenamics precisa de ver; que destino de baixo valor existe para misturas e rejeito; se é possível caracterizar 3 a 5 fardos do piloto; e se é mentor do desafio e o que podemos dizer em público. Tem 10 minutos até quinta?

### 6.3 Organização do Hack4Guimarães

**E-mail**

**Assunto:** Equipa Novelo (TexVitrus): Regras, submissão de 23 de outubro e pitch de 26

Bom dia,

Somos a equipa Novelo (Hélder Gonçalves e Flávio Fernandes), no desafio 5, TexVitrus. Para não falharmos nada, pedimos que nos indiquem ou enviem:

1. O texto do separador **Rules** na TAIKAI, com o detalhe de cada um dos quatro critérios.
2. A duração do pitch, se há perguntas do júri e quanto tempo duram, e se a demo ao vivo é permitida.
3. O que a submissão de **23 de outubro às 17h30** tem de conter (ligação do repositório, vídeo, PDF, ligação da aplicação) e como identificar as ferramentas de IA, APIs e código de terceiros.
4. Se o repositório pode ficar público (hoje é) com os dados brutos, ou se os devemos retirar, para a verificação de originalidade.
5. As condições próprias do desafio TexVitrus sobre dados e propriedade intelectual.
6. Se o Luís Miguel Oliveira, da Fibrenamics, é mentor deste desafio, e o horário dos mentores no CIAJG.
7. O formato da sala no dia 26 (ligação, ecrã, som) e a ordem dos pitches.

Obrigado,
Hélder Gonçalves e Flávio Fernandes

**WhatsApp**

> Bom dia, somos a equipa Novelo (TexVitrus). Podem enviar-nos o texto do separador Rules da TAIKAI e dizer-nos: duração do pitch e das perguntas, se a demo ao vivo é permitida, o que a submissão de 23/10 às 17h30 tem de conter, e se o repositório pode ficar público (hoje é) com os dados brutos, ou se os devemos retirar? Obrigado.

---

## 7. Guião de 15 minutos

Para a reunião com a Vitrus (Lucas). Uma pergunta de cada vez, com o telemóvel aberto no Novelo. As perguntas que sobrarem seguem por escrito.

| Min. | Bloco | Mostrar | Perguntas | Gravar |
| --- | --- | --- | --- | --- |
| 0 a 2 | Abertura | Ecrã "Qualidade dos dados" (12 + 25 alertas) | Pedir licença para gravar apontamentos | Hora de início; quem está presente |
| 2 a 4 | Permissões | Lista de ficheiros em `data/raw/` | [Q1](#q1-autorização-de-uso-dos-dados-e-do-nome) | "Sim", "só agregado" ou "não", por tipo de dado; quem confirma por escrito |
| 4 a 6 | Rede de têxteis | Mapa vazio da camada de têxteis | [Q2](#q2-a-lista-de-contentores-de-têxteis) | Data prometida, formato, quem envia |
| 6 a 8 | Circuitos | Ecrã "Circuitos" e os 9 sem viatura | [Q5](#q5-recolher-têxteis-nos-circuitos-e-viaturas-atuais), V4, V5 | Circuitos elegíveis; capacidade; depósito |
| 8 a 9 | Custos | Ecrã "Pressupostos" | [Q4](#q4-custos-unitários-e-vida-útil) | Cada valor com unidade e ano; "confidencial" quando for |
| 9 a 11 | Potencial e destino | Sankey e "Ponto de partida" | [Q6](#q6-o-que-significam-07-kghabmês-e-54), [Q7](#q7-como-foi-medido-o-destino-e-a-que-preço) | Definição dos 0,7; ano; Sarah medida ou percentagem |
| 11 a 13 | Contentores municipais | Mapa municipal e candidatos | [Q8](#q8-os-contentores-municipais-e-o-seu-uso-para-têxteis), M5, M9 | Fração; quem recolhe os ecopontos; data do inventário |
| 13 a 15 | Piloto e fecho | Recomendador de piloto | [Q10](#q10-êxito-orçamento-e-piloto) | Quem decide, orçamento, prazo; reler as decisões e as datas de envio |

**Como gravar cada resposta:** a frase literal; quem a disse e quando; unidade e ano; documento ou ficheiro citado; "posso dizer isto em público?" (sim, não, só agregado); quem envia o quê e até quando; o que o Novelo muda. Reler em voz alta: "Percebi X, certo?".

**Variantes.** *Fibrenamics (10 min):* abertura (1), [Q9](#q9-fibrenamics-critérios-de-lote-destino-de-baixo-valor-e-papel) (6), O5, O6 e C4 (2), fecho (1). *Organização (5 min):* [Q3](#q3-regras-pitch-e-submissão-de-23-de-outubro), L4, J6.

---

## 8. Registo de respostas

Preencher durante a reunião ou na hora seguinte. Uma linha por resposta; ver a [regra de propagação](#9-regra-para-propagar-as-respostas).

| ID | Pergunta (curta) | Quem respondeu | Data e canal | Resposta literal | Unidade, ano, fonte | Público? | Atualizar | Feito (data, commit) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q1 | Uso público dos dados e do nome | | | | | | | |
| Q2 | Lista de contentores de têxteis | | | | | | | |
| Q3 | Regras, pitch, submissão | | | | | | | |
| Q4 | Custos unitários e vida útil | | | | | | | |
| Q5 | Têxteis nos circuitos atuais | | | | | | | |
| Q6 | O que medem 0,7 e 5,4% | | | | | | | |
| Q7 | Medição do destino e preços | | | | | | | |
| Q8 | Fração municipal e têxtil nos locais | | | | | | | |
| Q9 | Fibrenamics: lote, baixo valor, papel | | | | | | | |
| Q10 | Êxito, orçamento, piloto | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |

---

## 9. Regra para propagar as respostas

**Prazo:** no máximo uma hora depois de a resposta chegar, e sempre no mesmo commit que o código ou o texto que muda.

1. **Registar** a resposta na tabela acima, literal, com nome, data e canal.
2. **Classificar** o estado: dado da Vitrus, primária, secundária, pressuposto ou por verificar. Uma opinião de mentor nunca passa a "validado" sem autorização escrita.
3. **Escrever** onde o tipo de resposta manda:

| Tipo de resposta | Escrever em | Atualizar também |
| --- | --- | --- |
| Número da Vitrus (custo, preço, tonelada) | [Registo](../pesquisa/registo-de-afirmacoes.md), linhas A16 em diante | `params.py`, tabela de pressupostos em [Dados e modelo](../engenharia/dados-e-modelo.md); repetir cenários A, B e francês |
| Ficheiro novo (contentores de têxteis, correções) | `data/raw/` (só ficheiros oficiais, sem editar), depois `just etl` | [Análise dos dados](../dados/analise-dados-recebidos.md), [Análise municipal](../dados/analise-contentores-municipais.md), registo A14 e G |
| Significado de um campo (0,7; fração; `Quantidade`) | Registo (alterar A8, A10 ou G) | [Dados e modelo](../engenharia/dados-e-modelo.md); ETL (`stream`, `capacity_status`) |
| Autorização ou restrição de uso | Registo e [Cenários](cenarios-e-contingencias.md) B.4 | Retirar nomes e matrículas; verificar `git ls-files data/raw` |
| Regras ou formato do pitch | [Critérios](criterios-de-avaliacao.md) (colar o texto) e registo E5 a E8 | Protocolo de uma hora; [Narrativa](narrativa-do-pitch.md); [Estratégia](estrategia-para-ganhar.md) |
| Opinião ou validação de mentor | Registo, bloco F (M19 em diante) | [Mentores](mentores.md); slides 6 e 8 |
| Contacto ou promessa | [Estratégia](estrategia-para-ganhar.md), contactos | Plano de continuidade |

4. **Recalcular** o que mexe: `just etl`, cenários, `just gen` se a API mudar. Se o €/t mudar mais de 30%, dizê-lo abertamente (Cenários B.2).
5. **Verificar** com `just check` e `grep -rn "](" docs README.md` (ligações).
6. **Agradecer** a quem respondeu, dizendo o que mudou no Novelo.
7. **Se não houver resposta** até ao prazo: usar o valor assumido do cartão, com a palavra "estimativa", e registar "sem resposta" com a data.

---

## Anexo A. Modelo de ficheiro de contentores de têxteis

Pedido a enviar à Vitrus com a [pergunta Q2](#q2-a-lista-de-contentores-de-têxteis). O importador (`scripts/etl/containers.py`) é tolerante, mas estes campos evitam os problemas do pacote de 20 de outubro.

| Campo | Formato | Para quê |
| --- | --- | --- |
| `id_contentor` | texto único | Linhagem e auditoria |
| `entidade_operadora` | texto (Ultriplo, H Sarah Trading, Nova Etapa, Vitrus, outra) | Quem recolhe |
| `tipo` | rua, enterrado, escola, ecocentro, outro | Tratamento de "sem tipo" |
| `capacidade_litros` | número, em litros | Evita capacidades sem unidade |
| `latitude`, `longitude` | graus decimais WGS84 (6 casas), **latitude primeiro** | Evita cabeçalhos trocados |
| `freguesia_dicofre` | 6 dígitos da CAOP | Evita 166 escritas diferentes |
| `morada` | texto | Confirmação no terreno |
| `data_instalacao`, `data_remocao` | AAAA-MM-DD | Data de referência |
| `estado` | ativo, inativo, danificado | Rede de partida |
| `recolhas_por_semana` | número | Custo e capacidade |
| `toneladas_2025` | número, por contentor, se existir | Calibrar a captura por zona |

---

## Fontes e ligações

Numeração em [Fontes](../pesquisa/fontes.md): **F59, F61, F62, F66** (hackathon e CAOP, já existentes) e **F69 a F80** (novas, consultadas a 20 de outubro de 2026). Registo: A1 a A15, B11, C1, C8, D4, E4 a E14, G e M7, M17 e M18 em [Registo de afirmações](../pesquisa/registo-de-afirmacoes.md).

| N.º | Fonte |
| --- | --- |
| F69 | DGSL, artigo 36.º do Decreto-Lei 102-D/2020, texto consolidado |
| F70 | APA, Nota Técnica relativa à gestão de têxteis pós-consumo (maio de 2025), publicada pela ANMP |
| F71 | APA, "Têxtil: Responsabilidade Alargada do Produtor", sessão de 8 de outubro de 2026 |
| F72 | Jornal T, "APA quer setor têxtil preparado para nova responsabilidade sobre os resíduos" (24 de setembro de 2026) |
| F73 | Ambiente Online, "Desafios e oportunidades do novo fluxo dos têxteis", Ana Cristina Carrola, APA (12 de março de 2026) |
| F74 | Município de Guimarães e URBACT, Plano de Ação Integrado para a Circularidade Têxtil (25/11/2025) |
| F75 | Perebynos, Sepúlveda e Ribeiro (2023), estudo sobre têxteis no indiferenciado em Guimarães |
| F76 | Portugal Têxtil, "Humana deixa de recolher têxtil em várias cidades" (2026) |
| F77 | Câmara Municipal de Guimarães, "Equipamentos de deposição" (excerto de pesquisa) |
| F78 | BOG-EC, "Resíduos têxteis: um ano depois da entrada em vigor da recolha seletiva obrigatória" |
| F79 | Diário da República, Decreto-Lei 81/2025, de 22 de maio |
| F80 | Terras do Homem, "Guimarães reforça reciclagem com mais de 300 ecopontos" (16 de março de 2026), excerto de pesquisa |

Documentos relacionados: [Mentores](mentores.md) · [Estratégia para ganhar](estrategia-para-ganhar.md) · [Cenários e contingências](cenarios-e-contingencias.md) · [Critérios de avaliação](criterios-de-avaliacao.md) · [Análise dos dados recebidos](../dados/analise-dados-recebidos.md) · [Análise dos contentores municipais](../dados/analise-contentores-municipais.md) · [Dados e modelo](../engenharia/dados-e-modelo.md).
