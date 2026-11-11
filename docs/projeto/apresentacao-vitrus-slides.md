# Especificação do deck — apresentação à Vitrus e à Câmara

Documento **autocontido**: contém tudo o que é preciso para construir o PowerPoint (9 diapositivos + 3 anexos) sem acesso ao repositório. O guião falado completo está em [Guião de ensaio](apresentacao-vitrus-guiao.md) e o plano da sessão em [Plano completo](apresentacao-vitrus-camara.md). Sessão: **12 de novembro de 2026**, 25 minutos + perguntas, apresentada por Flávio Fernandes à Vitrus (equipa operacional) e ao presidente da Câmara de Guimarães, na mesma sala.

**O papel do deck:** a app é a apresentação. Os slides aparecem em cinco momentos: abertura (1), problema (2), ponte (3), bloco da triagem (4–7) e pedidos/fecho (8–9). Os anexos só se abrem se houver pergunta. Cada diapositivo traz nas **notas do orador** a fala exata daquele momento.

## 1. Especificações globais

| Item | Valor |
| --- | --- |
| Formato | 16:9 (1920 × 1080 px) |
| Fundo | Linho `#F4F1EA` (todos os diapositivos) |
| Texto | Tinta `#14211D` |
| Acento principal | Floresta `#2E6B57` (títulos de números, destaques, faixas) |
| Detalhe | Areia `#C4A06A` (apenas pequenos detalhes: filetes, selos) |
| Títulos | Newsreader (Google Fonts; fallback Georgia) 40–44 pt, peso 500 |
| Corpo | Inter (Google Fonts; fallback Arial) 18–24 pt |
| Rodapé de fontes | 10 pt, Tinta a 70%, canto inferior esquerdo, em **todos** os diapositivos exceto capa e «Obrigado» |
| Número do diapositivo | canto inferior direito, 10 pt |
| Língua | Português de Portugal, acentos corretos. **Não traduzir nem mudar os textos** |
| Números | Formato pt-PT: vírgula decimal («101,9 €/t»), espaço de milhares («3 003 t»). Junto a cada número estimado aparece «estimativa» |
| Símbolo | Se fornecido, o símbolo Novelo entra só na capa e no «Obrigado», 24 px, Floresta. Não usar clipart nem ícones decorativos |

**Regras:** uma ideia por diapositivo; título que é a conclusão (não o tema); máximo de ~40 palavras visíveis por diapositivo (exceção: a tabela do slide 5); nenhum número fora da lista da secção 3; alinhamento à esquerda; sem sombras nem gradientes.

## 2. Quando cada slide entra

| Tempo | Slide | Momento |
| --- | --- | --- |
| 0:00–1:30 | 1 | Abertura |
| 1:30–2:30 | 2 | Os 4 números do problema |
| 3:30–4:00 | 3 | Ponte para a demonstração na app |
| 19:30–20:45 | 4 | A escala da triagem |
| 20:45–21:55 | 5 | As sete abordagens |
| 21:55–23:20 | 6 | A proposta em camadas |
| 23:20–24:00 | 7 | Desenhar juntos |
| 24:00–25:10 | 8 | Os três pedidos |
| 25:10 + perguntas | 9 | Obrigado (fica no ecrã) |

## 3. Os números canónicos (não usar outros)

| Número | Como aparece | Fonte/estado |
| --- | --- | --- |
| 301,3 t | recolhido à parte em 2025 | Vitrus, medido |
| ≈ 3 003,3 t/ano | têxtil ainda no indiferenciado | 51 250,6 t × 5,86% (APA RARU 2025); estimativa |
| 9 em cada 10 kg | captura atual: 9,1% | estimativa |
| 105,64 €/t | custo de aterro evitado (40 TGR + 65,64 Resinorte) | Vitrus, 22 out 2026 |
| 17 abr 2028 | prazo da RAP têxtil | Diretiva (UE) 2025/1892 |
| 431,1 t/ano · 101,9 €/t · 45 542 € evitado · −1 628 €/ano líquido | cenário B, 60 000 €/ano | modelo; estimativa |
| 317 269 €/ano | aterro evitado no alvo (3 003,3 × 105,64) | cálculo |
| 42 500 € | viatura de caixa fechada (5 312,50 €/ano em 8 anos) | concurso de Gaia; pressuposto |
| ≈ 1 M → ≈ 10 M peças/ano | escala 301 t → 3 003 t, a 0,3 kg/peça | pressuposto; estimativa |
| 32–48 ETC · 55 000–83 000 h/ano | triagem peça a peça no alvo | cálculo; estimativa |
| 24,5–98 mil €/ano | custo de IA no alvo peça a peça | estimativa |
| 56,9% | rejeito do canal sem controlo (amostra 5,6 t) ≈ 1 700 t/ano desperdiçadas | To Be Green/Vitrus; estimativa |
| 2–3 ETC | triagem em camadas, concelho inteiro | estimativa |
| 50–200 mil €/ano | sacos no pico (~1 M sacos, 0,05–0,20 €/saco) | estimativa |
| 385 sacos/trimestre → ±5 p.p. a 95% | auditoria por amostragem | estatística padrão |
| 1 187 + 86 | lugares públicos candidatos + escolas | pacote QGIS da Vitrus, 20 out |
| 2 751 · 2 026 | contentores municipais · locais | pacote QGIS da Vitrus |
| Conformidade ≥ 80% · rejeito do verde ≤ 15% · recusados à porta < 5% | métricas do piloto | proposta (issue #21) |

## 4. Diapositivos

### Slide 1 — Capa (0:00–1:30)

- Linha pequena no topo (Areia): `Apresentação à Vitrus e ao Município de Guimarães`
- Título: `Novelo`
- Subtítulo: `Do saco ao fio: a rede de recolha de têxteis de Guimarães, ao menor custo`
- Rodapé central: `Guimarães · 12 de novembro de 2026 · Flávio Fernandes e Hélder Gonçalves`
- Linha pequena por baixo: `Projeto vencedor · Hack4Guimarães 2035 · Desafio 5 TexVitrus`

**Notas do orador:** «Bom dia, senhor presidente. Bom dia, Lucas, equipa da Vitrus. Obrigado por receberem o Novelo — e obrigado, já agora, pelos dados: sem os números que vocês nos abriram, nada do que vou mostrar existiria. Sou o Flávio Fernandes; o Hélder Gonçalves, que hoje não pôde estar, segue connosco à distância. Há três semanas, o Hack4Guimarães pôs uma pergunta: como desenhar a rede de recolha de têxteis de Guimarães ao menor custo. Ganhámos esse desafio — mas o prémio que interessa está aqui: uma ferramenta a funcionar, em produção, que responde em números à pergunta que vocês fizeram: onde recolher, como, e a quanto fica cada tonelada tirada do aterro. Nos próximos 25 minutos, a app é a apresentação — os slides servem só para duas coisas: uma decisão que vos quero propor sobre a triagem, e três pedidos. Começo pelo princípio: onde estamos.»

### Slide 2 — «9 em cada 10 kg de têxtil ainda vão para o lixo» (1:30–2:30)

Quatro números em cards horizontais (número em Floresta, Newsreader, ~72 pt; legenda por baixo em Inter 16 pt):

| Número | Legenda |
| --- | --- |
| `301,3 t` | `recolhidas à parte em 2025 · medido` |
| `≈ 3 003 t/ano` | `ainda no indiferenciado · estimativa` |
| `105,64 €/t` | `custo de aterro evitado · Vitrus` |
| `17 abr 2028` | `responsabilidade alargada do produtor` |

Rodapé de fontes: `Vitrus 2025 · 51 250,6 t × 5,86% (APA, RARU 2025) — estimativa · Vitrus 22 out 2026 · Diretiva (UE) 2025/1892`

**Notas do orador:** «Quatro números, e são todos vossos. 301,3 toneladas de têxtil recolhidas à parte em 2025 — medido, são os vossos dados. Cerca de 3 003 toneladas por ano ainda vão no indiferenciado — estimativa: 5,86 por cento do indiferenciado do concelho, a base da APA que vocês próprios nos indicaram. 105,64 euros é o que cada tonelada desviada do aterro deixa de custar. E o relógio: 17 de abril de 2028, prazo da responsabilidade alargada do produtor. Isto resume o desafio: nove em cada dez quilos de têxtil que Guimarães gera ainda vão para o lixo — e em 2028 a fatura muda de dono. Quem chegar a essa mesa a saber o seu custo por tonelada defende o seu número. E a frase que resume o que encontramos: com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia 431 toneladas por ano do aterro, a 101,9 euros por tonelada — e os 45 542 euros de tratamento evitado pagam a operação. Estimativa — e é por isso que há um piloto para confirmar.»

### Slide 3 — «O que está a funcionar — e vamos ver ao vivo» (3:30–4:00)

Três colunas (título da coluna em Floresta, 24 pt; corpo Inter 18 pt):

| Planear | Decidir em português | Provar |
| --- | --- | --- |
| `Simulador e cenários comparáveis; rotas medidas pelas estradas reais (OpenStreetMap)` | `«E se...?» traduz a pergunta; o otimizador calcula; o verificador rejeita números sem origem` | `Triagem por fotografia, passaporte do lote, relatório RAP num clique` |

Frase de fecho por baixo (Inter 20 pt, itálico): `A app é a apresentação — os slides servem para duas coisas: a triagem e os pedidos.`

Rodapé de fontes: `Em produção: novelo.helder.si`

**Notas do orador:** «O que está a funcionar cabe em três verbos: planear — simulador, cenários e rotas medidas pelas estradas reais; decidir em português — perguntar "e se...?" e receber números verificados; e provar — da peça triada ao relatório de 2028. Tudo funciona, e tudo se vê agora, ao vivo. Vamos lá.»

### Slide 4 — «À escala de 3 003 t, a triagem peça a peça não escala» (19:30–20:45)

Duas zonas. À esquerda, a escala (duas linhas, número grande):

| `Hoje · 301 t` | `≈ 1 milhão de peças/ano` |
| --- | --- |
| `Alvo · 3 003 t` | `≈ 10 milhões de peças/ano (estimativa)` |

À direita, os dois becos sem saída (cards com filete Areia):

- `Operador, peça a peça` → `32–48 ETC · 55 000–83 000 h/ano · 24,5–98 mil €/ano de IA (estimativas)`
- `Sem controlo à entrada` → `56,9% de rejeito ≈ 1 709 t/ano desperdiçadas (amostra 5,6 t; estimativa)`

Rodapé de fontes: `0,3 kg/peça (pressuposto) · 20–30 s/peça (uso real) · To Be Green 2025 (56,9%) · cálculo da equipa`

**Notas do orador:** a fala do bloco 12 do [guião](apresentacao-vitrus-guiao.md) (desde «Volto à vossa sugestão de 4 de novembro...» até «...a que granularidade é que cada decisão tem de ser tomada.»).

### Slide 5 — «Sete abordagens; nenhuma é "o cidadão tria peça a peça"» (20:45–21:55)

Tabela de 7 linhas, duas colunas (`Abordagem` · `Veredicto`). As linhas **B, C e G** aparecem riscadas (linha horizontal sobre o texto, Tinta a 40%). A linha **D** tem fundo Floresta a 12% e texto Floresta a negrito; a linha **E** tem filete Areia:

| Abordagem | Veredicto |
| --- | --- |
| `A · Status quo: operador, peça a peça` | `não escala — fica como auditoria` |
| ~~`B · Cidadão tria peça a peça em casa`~~ | ~~`a participação morre`~~ |
| ~~`C · Declaração do saco, sem verificação`~~ | ~~`reproduz os 56,9%`~~ |
| **`D · Triagem partilhada em camadas`** | **`recomendada`** |
| `E · Mínima: dois sacos + verificação à porta` | `arranque` |
| `F · Pontos comunitários (escolas, juntas)` | `complemento de educação` |
| ~~`G · Externalizar nos licenciados (o hoje)`~~ | ~~`sem dados próprios para 2028`~~ |

Rodapé de fontes: `AEA (2024) · Fashion for Good, Sorting for Circularity (2025) · análise da equipa (issue #21)`

**Notas do orador:** a fala do bloco 13 do [guião](apresentacao-vitrus-guiao.md).

### Slide 6 — «A proposta para começar: triagem partilhada em camadas» (21:55–23:20)

Fluxo horizontal de 5 passos (caixas ligadas por setas finas em Floresta; número do passo pequeno em Areia):

1. `Dois sacos` — `verde «vestir de novo» · azul «deu a vida» · regra de 3 perguntas impressa`
2. `Declaração opcional` — `QR, 30 segundos · funciona sem app`
3. `Porta · 10 s` — `conforme · em dúvida · recusado`
4. `Auditoria ~20%` — `amostragem com a triagem por foto · 385 sacos/trimestre → ±5 p.p. (95%)`
5. `Feedback` — `educativo · nunca multa`

Faixa de números por baixo (Inter 20 pt, alinhados com separadores `·`):

`~2–3 ETC no concelho (vs 32–48) · sacos: 50–200 mil €/ano no pico · aterro evitado: 317 269 €/ano — paga os sacos · arranque: dois sacos + porta; digital ao 2.º mês`

Rodapé de fontes: `estimativas · 3 003,3 t × 105,64 €/t (cálculo) · amostragem: n = 385/trimestre, ±5 p.p., 95%`

Se houver captura do «Vai no saco?» (telemóvel), entra como recorte pequeno ao canto com legenda `«Vai no saco?» — o conselho antes do saco; nada guardado`. Opcional.

**Notas do orador:** a fala do bloco 14 do [guião](apresentacao-vitrus-guiao.md).

### Slide 7 — «Desenhemos isto juntos» (23:20–24:00)

Duas colunas com título em Floresta:

| `Sessão de desenho com a operação` | `O piloto decide com números` |
| --- | --- |
| `os sacos: cor, texto, quem imprime` | `participação a subir` |
| `o dia fixo por freguesia` | `conformidade ≥ 80%` |
| `a recusa à porta` | `rejeito do saco verde ≤ 15%` |
| `a auditoria no depósito` | `recusados à porta < 5%` |

Frase de fecho (Inter 22 pt, itálico): `O hackathon deu a pergunta; a solução desenha-se com quem a opera.`

Rodapé de fontes: `métricas do piloto — proposta da equipa (issue #21)`

**Notas do orador:** a fala do bloco 15 do [guião](apresentacao-vitrus-guiao.md).

### Slide 8 — «Três pedidos» (24:00–25:10)

Três blocos numerados (número grande em Areia, Newsreader):

1. **`Piloto`** — `Aldão + Arosa e Castelões (+ freguesias de controlo) · 8–12 semanas · a começar em janeiro`
2. **`Dados que só a Vitrus tem`** — `€/h e €/km das viaturas · kg mensais por entidade · tempo de uma paragem · orçamento dos sacos`
3. **`Triagem`** — `aprovar a direção: partilhada em camadas, arranque mínimo · sessão de desenho dentro de 2 semanas`

Rodapé de fontes: `cenário «Piloto» e métricas na plataforma · pressupostos com fonte em /assumptions`

**Notas do orador:** a fala do bloco 16 do [guião](apresentacao-vitrus-guiao.md), desde «O ecrã do piloto...» até «...daqui a duas semanas.»

### Slide 9 — «Obrigado» (25:10 + perguntas)

- Frase-âncora (Newsreader 28 pt, Floresta, centrada):

> `Com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia 431,1 t por ano do aterro a 101,9 € por tonelada — e os 45 542 € de tratamento evitado pagam a operação.`

- Por baixo, pequeno: `estimativa — é por isso que há um piloto a pedir`
- QR (ver secção 5) ao canto inferior direito com legenda `novelo.helder.si`
- `Flávio Fernandes · Hélder Gonçalves`

**Notas do orador:** «Deixo a frase com que comecei: com uma viatura nova só para o têxtil e sem um único contentor novo, Guimarães desvia 431 toneladas por ano do aterro, a 101,9 euros por tonelada — e o tratamento evitado paga a operação. Estimativa — e é exatamente por isso que existe um piloto a pedir. Obrigado, senhor presidente; obrigado, equipa. Fico para as vossas perguntas.»

### Anexos (só se houver pergunta)

**A1 — «A rede não fica só onde é barato»**: `fora das freguesias urbanas: 55,5% da população servida · nas urbanas: 72,8% (cenário 60 000 €/ano, estimativa) · Arosa e Castelões sem serviço neste orçamento — entra no piloto · Diretiva 2025/1892, art. 22.º-C, n.º 9, b)`.

**A2 — «Onde o têxtil se perde»**: `48 freguesias · 2 751 contentores municipais em 2 026 locais (não são de têxteis) · 1 187 lugares candidatos + 86 escolas · cobertura a 300 m: 47,8% da área · pacote QGIS da Vitrus, 20 out 2026`.

**A3 — «Pressupostos com fonte»**: `viatura 42 500 € (concurso de Gaia; pressuposto) · recolha a 30 km/h · 0,3 kg/peça · desvio de linha reta 1,37–1,48 (calibração OSRM) · aterro 105,64 €/t (Vitrus) · todos editáveis em /assumptions`.

## 5. Recursos

- **QR**: aponta para `https://novelo.helder.si`. Módulos em Floresta `#2E6B57` sobre fundo Linho/branco, zona de silêncio de 4 módulos, mínimo 400 px (slide 9) — gerar com qualquer biblioteca de QR (ex.: `qrencode -t PNG -l M`).
- **Símbolo do Novelo**: se o utilizador fornecer `brand/simbolo/novelo-simbolo-positivo.svg`, converter para PNG e usar na capa e no «Obrigado». Sem o ficheiro, não substituir por outro gráfico.
- **Capturas da app**: nenhum slide depende delas. A única opcional é o «Vai no saco?» no slide 6 (recorte de telemóvel, 390 × 844). Se não existir, omitir.

## 6. Exportação e aceitação

Exportar **PPTX com as notas do orador preenchidas** e **PDF** dos 9 diapositivos (sem anexos). Fontes: instalar Newsreader e Inter (Google Fonts, SIL OFL) ou abrir no Google Slides, onde existem de origem.

Checklist de aceitação:

- [ ] 9 diapositivos + 3 anexos; títulos exatos como na secção 4
- [ ] Nenhum número fora da lista da secção 3; «estimativa» onde a lista diz estimativa
- [ ] Frase-âncora idêntica no slide 9 e nas notas do slide 2 (números: 431,1 t · 101,9 €/t · 45 542 €)
- [ ] Rodapé de fontes em todos os diapositivos exceto 1 e 9
- [ ] Notas do orador preenchidas em todos
- [ ] B, C e G riscados no slide 5; D destacado; E com filete Areia
- [ ] pt-PT com acentos; números com vírgula decimal e espaço de milhares
