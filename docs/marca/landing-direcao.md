# Landing: direção, tipografia, imagem, telemóvel e SEO

Documento de trabalho para a landing (`/pt/`, `/en/`) e para quem a implementa. Junta a pesquisa de referências, a direção
proposta, a tipografia escolhida (já descarregada), o hero em dither, o painel de entrada, o checklist de telemóvel e o SEO
ponta a ponta, com a lista ficheiro a ficheiro do que implementar. A linguagem visual está em
[`linguagem-dither.md`](linguagem-dither.md); a marca em [`guia-de-marca.md`](guia-de-marca.md).

## Resumo da decisão

| Tema | Decisão |
| --- | --- |
| Conceito | **«O fio que liga a cidade.»** Rede, novelo, fibra: o território visto de cima, feito de pontos, e os três fios do símbolo como fio condutor da página. |
| Imagem | **Fotografia de Guimarães com dither próprio**: a Penha no hero e no painel de entrada; Paço dos Duques (faixas), antiga fábrica têxtil e Couros (cartões), Plataforma das Artes (CTA final); claro e escuro, mesma série e mesmo motor, sem texturas geradas. Licenças livres; os créditos vivem na página «Créditos e licenças» (`/pt/creditos`, `/en/credits`), ligada no rodapé. |
| Tipografia | **Newsreader** (títulos, número), **Inter** (texto), **Geist Mono** (etiquetas e dados), em subsets pt-PT de **110,7 KB** no total. Mantém a voz da marca; não se troca de serifa. |
| Navbar | Transparente sobre o hero; ao rolar, Linho a 80% com desfoque e linha de 1 px; indicador ativo por *scroll-spy*; em telemóvel, folha a ecrã inteiro com ligações grandes e CTA fixo em baixo. |
| Movimento | Pouco e barato: revelação por opacidade e 12 px de deslocamento, parallax da imagem só por CSS, sem bibliotecas. Canvas só como opção (secção «Efeito»). |
| Regra | Nada pesado. JS da landing sem dependências novas; hero AVIF ≤ 120 KB em telemóvel, ≤ 180 KB em tablet, ≤ 250 KB em desktop 1× e ≤ 450 KB em retina; fundos ≤ 60 KB. |

---

## 1. Pesquisa: referências e «user feeling»

Metodologia: abri cada página em outubro de 2026 com leitura de texto (estrutura, navegação, copy, ordem de secções) e
completei o que o texto não mostra (movimento, tipografia, desfoque) com o que é conhecido e verificável em cada site. O que
**não** consegui confirmar a partir da página aparece marcado «a confirmar no navegador». Para decisões finais de movimento,
abre cada URL e observa 5 minutos.

| # | Marca | URL | Hero | Navbar | O que levar para o Novelo |
| --- | --- | --- | --- | --- | --- |
| 1 | Linear | https://linear.app | Etiqueta de novidade que liga ao *changelog*, título curto, subtítulo de uma linha, ecrãs do produto reais | Logótipo, menus (Produto, Recursos), Clientes, Preços, e à direita Docs, Abrir app, Entrar, Registar | Produto real como prova; etiquetas «Fig. 0.2» a numerar secções; prova social quantificada («40 000 equipas»); CTA final curto |
| 2 | Stripe | https://stripe.com | Título centrado sobre onda de gradiente, dois CTA (Começar, Entrar com Google), faixa de logótipos | Mega-menu (Produtos, Soluções, Developers), botão de contacto na barra | Duas ações lado a lado, números de escala («135+ moedas», «99,999% de disponibilidade»), *bento* de produtos; a densidade de informação é tolerada porque o ritmo é calmo |
| 3 | Vercel | https://vercel.com | Fundo escuro, geometria e grelha como textura, título grande em Geist | Barra fixa com desfoque, menus simples, Entrar e Registar | Uma textura de fundo que é identidade (grelha); tipografia própria com variante mono para dados |
| 4 | Apple | https://www.apple.com/pt/ | Imagem de produto a toda a largura, uma frase | Barra global fina e translúcida; sub-barra local que fica fixa ao rolar | Tipografia enorme com *optical sizing*; sub-barra de contexto translúcida; revelações ligadas ao scroll, discretas |
| 5 | Arc | https://arc.net | Mascote e ilustração, tom amigável | Mínima | Humor e calor sem perder clareza; o produto «tem personalidade» |
| 6 | Notion | https://www.notion.com | Título, dois CTA, ilustração de linha, logótipos de clientes | Menus e CTA | Ilustração com carácter (não *stock*); CTA primário e secundário sempre visíveis |
| 7 | Raycast | https://www.raycast.com | «Your shortcut to everything.», gráfico do teclado | Store, Pro, AI, iOS, Windows, Teams, Pricing, Entrar | Um objeto desenhado com carinho no hero; mural de testemunhos reais; métrica específica («99,8% sem falhas») |
| 8 | Anthropic | https://www.anthropic.com | Frase de missão e imagem larga | Poucas entradas, CTA «Try Claude», pesquisa | Serifa editorial com muito ar; cartões repetem «etiqueta, título, resumo, ação»; ritmo de revista |
| 9 | Mistral | https://mistral.ai | Arte de blocos/píxeis em laranja, tipografia técnica | Simples | Pixel/halftone **como identidade** (o mais próximo da nossa linguagem dither); mono para etiquetas (a confirmar no navegador) |
| 10 | Ramp | https://ramp.com | Título afirmativo, dados de poupança, produto | Menus e demonstração | Números grandes como argumento; tom confiante |
| 11 | Mercury | https://mercury.com | Imagem de fundo a toda a largura, «Radically different banking», campo de email + «Abrir conta», «Ver demonstração» | Mega-menu (Produtos), Soluções, Recursos, Preços; à direita Dashboard, Entrar, Abrir conta | CTA com um só campo; faixa de números («450K+», «4,9 na App Store»); testemunhos com nome |
| 12 | Are.na | https://www.are.na | «Are.na is…» com duas frases de manifesto, linha de tempo («15 anos e 72 dias»), numeração 1 a 5 do «Como funciona» | Logótipo, Entrar, Registar | Voz de manifesto; passos numerados; tipo próprio (Areal, da Dinamo) |
| 13 | Teenage Engineering | https://teenage.engineering | Loja, minúsculas, navegação densa e repetida em barras | Barra principal + secundária + rodapé | Tom seco e preciso; minúsculas como assinatura; objeto e preço, nada mais |
| 14 | Patagonia | https://www.patagonia.com | A página obtida era de manutenção («Sit tight»); o resto é conhecido: fotografia editorial de campo, histórias antes de produto | Navegação por categoria, atividade e causa | Fotografia como argumento ético; crédito do fotógrafo sempre visível (aqui: CC BY-SA) |
| 15 | Allbirds | https://www.allbirds.com | Produto e matéria-prima | Categorias | Pegada de carbono mostrada por produto: o dado de sustentabilidade vive junto da decisão, não num relatório à parte |

### O que estas páginas têm em comum (o «feeling»)

1. **Uma ideia por ecrã.** Um título, uma linha de apoio, uma ação. O ritmo vertical respira: 96 a 160 px entre secções em desktop.
2. **Produto à vista cedo.** Linear, Raycast, Mercury mostram o produto no primeiro ecrã ou no seguinte.
3. **Números específicos** em vez de adjetivos («99,8% sem falhas», «450K+»). Para o Novelo: os números reais da Vitrus, sempre com fonte.
4. **Tipografia como imagem.** Títulos muito grandes, tracking apertado, optical sizing; um segundo tipo (mono) para dados e etiquetas.
5. **Navegação discreta e com estado.** Barra transparente ao topo, vidro fosco ao rolar, indicador da secção atual, uma única ação primária.
6. **Textura própria.** Grelha (Vercel), onda (Stripe), píxel (Mistral), halftone (nós): um motivo reconhecível em vez de *stock*.
7. **Prova social proporcional ao estágio.** Para um projeto de hackathon, a prova é o dado real, a fonte e a equipa; testemunhos inventados nunca.
8. **CTA repetido e coerente.** Mesmo texto e mesmo botão no hero, a meio e no fim; secundário sempre mais discreto.
9. **Movimento com função.** Revelar, orientar, confirmar; nada decorativo contínuo exceto uma peça (o objeto do hero).
10. **Desempenho percebido.** Texto primeiro, imagem do hero pré-carregada, sem saltos de layout; quem ganha confiança é o que carrega já.

---

## 2. Direção proposta para o Novelo

### Conceito: «o fio que liga a cidade»

O Novelo desenha a rede de recolha de têxteis de Guimarães ao menor custo. O novelo é o objeto, o fio é a rede, a fibra é o
que regressa ao ciclo. A página conta isso em três imagens: a cidade vista da Penha feita de pontos (o território), os três
fios do símbolo em pontos (a rede) e os números reais (a decisão). Os **fios** atravessam a página: uma linha fina Areia que
desce no lado esquerdo e se liga ao símbolo de cada secção (opcional, só se for barata).

### Narrativa do hero

| Elemento | Conteúdo (pt-PT) |
| --- | --- |
| Etiqueta (mono, 12 px) | `HACK4GUIMARÃES 2035 · DESAFIO TEXVITRUS` |
| Título (Newsreader 500) | **Recolha seletiva de têxteis, desenhada ao menor custo.** (já existe em `landing_title`; «ao menor custo» em itálico, `Newsreader Display Italic`) |
| Linha de apoio (Inter) | Orçamento e meta entram; saem cenários comparáveis em euros, toneladas e €/t para a rede de recolha de Guimarães. (`landing_lead`) |
| CTA | **Criar conta** (primário) e **Entrar** (secundário); nota «sem cartão, acesso por aprovação» só se for verdade (usar `landing_register_note`) |
| Prova em linha (mono) | `301,3 t recolhidas em 2025 · 0,16 kg/hab/mês · 156 830 habitantes` (números da Regra Zero, com a fonte no hover/`title`) |
| Imagem | Hero dither (Penha), claro/escuro; a zona esquerda quase só papel (texto), a direita com o santuário e o vale |
| Crédito | Página «Créditos e licenças» (autor, licença com ligação, origem e uso de cada fotografia; `photo-credits.ts` é a fonte única). O rodapé liga a ela; sem bloco inline |

### Sistema de secções (ritmo)

Fundo alterna Linho (claro) → faixa dither suave → Linho; **uma** secção escura (Tinta) a meio para o contraste.

| # | Secção | Fundo | Conteúdo | Notas |
| --- | --- | --- | --- | --- |
| 1 | Hero | Linho + hero dither | Narrativa acima | Altura `min-height: 100svh`, texto à esquerda |
| 2 | Números | Linho | Quatro números em Newsreader 500 tabulares, etiqueta mono, fonte | Os mesmos de hoje (`Proof`) |
| 3 | Problema | Linho | Parágrafo-manifesto de 3 frases, número grande «22,9%» (captura atual) | `text-wrap: balance` |
| 4 | Como funciona | foto «fábrica» (cartão) | 3 passos numerados 01, 02, 03 (mono): orçamento e meta; cenários; decisão | Símbolo em pontos como marcador |
| 5 | Produto | Linho | Captura real do simulador (claro e escuro, WebP/AVIF) em moldura simples | Sem *mockup* de aparelho |
| 6 | Funcionalidades | Linho | Grelha 2×3, título serif curto + uma linha | Sem ícones genéricos |
| 7 | Copiloto («E se…?») | Tinta (escura) | Pergunta e resposta com o verificador de números | A secção escura única |
| 8 | Dados e fontes | Linho | Lista de fontes com contagem; honestidade sobre limites | |
| 9 | Impacto | foto «couros» (cartão da rede) | Sankey observado (59,4% / 26,5% / 14,1%) | Números da Regra Zero |
| 10 | Para quem | Linho | Decisores, operadores, mentores | |
| 11 | FAQ | Linho | Perguntas com `<details>` | Alimenta o JSON-LD FAQPage |
| 12 | CTA final | foto «plataforma» (escuro) | Título, Criar conta, Entrar | Símbolo em pontos à direita |

### Navbar (comportamento)

| Estado | Desktop (≥ 1024 px) | Telemóvel e tablet (< 1024 px) |
| --- | --- | --- |
| Repouso (topo) | Altura 72 px, transparente, sem linha; logótipo à esquerda, 5 ligações ao centro (Como funciona, Funcionalidades, Copiloto, Dados, Perguntas), à direita `PT / EN` (mono), Entrar (ghost), Criar conta (primário) | Altura 56 px + `env(safe-area-inset-top)`; logótipo e botão de menu de 44 px |
| Ao rolar > 8 px | Altura 60 px; fundo `color-mix(in srgb, var(--background) 80%, transparent)`, `backdrop-filter: blur(12px) saturate(1.4)`, linha de 1 px `--border`; transição 200 ms | O mesmo; **esconde ao rolar para baixo e volta ao rolar para cima** (limiar de 48 px, ignorado com o menu aberto) |
| Indicador ativo | Sublinhado de 2 px Floresta que desliza (transform) para a ligação da secção visível (IntersectionObserver com `rootMargin: -45% 0px -50% 0px`); `aria-current="location"` | Ligação ativa em Floresta no menu |
| Menu | n/a | Folha a ecrã inteiro (`100dvh`), ligações em Newsreader 32 px com numeração mono 01 a 05, **Criar conta** fixo em baixo com `env(safe-area-inset-bottom)`; `inert` no resto, foco preso, Esc fecha, `overscroll-behavior: contain` |
| CTA fixo | n/a | Depois do hero, barra fixa de baixo com «Criar conta» (altura 56 px + safe-area); some no rodapé |
| Âncoras | `scroll-margin-top: 80px` em todas as secções, `scroll-behavior: smooth` só sem `prefers-reduced-motion` | idem, 72 px |

iOS: a cor da barra do sistema acompanha a secção (ver checklist). Android: a barra gestual não tapa o CTA fixo (safe-area).

### Movimento

| O quê | Como | Custo |
| --- | --- | --- |
| Revelar secção | `opacity 0→1` e `translateY(12px→0)` em 500 ms `cubic-bezier(.2,.7,.2,1)`, uma vez, por IntersectionObserver (já existe `reveal.ts`) | ~0 |
| Parallax do hero | `animation-timeline: scroll(root)` a mover a imagem 24 px e `scale(1.04)`; sem suporte fica estático | Compositor, ~0 |
| Números a contar | Só os 4 números do bloco 2, 700 ms, uma vez; sem `prefers-reduced-motion` | ~0 |
| Indicador da navbar | `transform: translateX` com transição de 250 ms | ~0 |
| Entrada da fotografia | Fade de 280 ms e zoom de 1,5% só quando a imagem chega depois do primeiro desenho | 1 transição |

### O que NÃO fazer

- Sem bibliotecas de animação (GSAP, Framer Motion, Lottie), sem WebGL, sem vídeo de fundo, sem *smooth-scroll* por JS.
- Sem gradientes, sombras de brilho, vidro fosco decorativo fora da navbar, nem roxos (guia de marca).
- Sem mais de uma imagem dither por ecrã; sem dither atrás de dados, tabelas ou formulários.
- Sem testemunhos ou logótipos de clientes que não existem; sem números fora de `docs/engenharia/dados-e-modelo.md`.
- Sem fontes extra além das três; sem `font-display: block`.
- Sem `100vh`, sem `position: fixed` com `transform` ancestral, sem `overflow: hidden` no `body`.

---

## 3. Tipografia

### Escolha

| Papel | Família | Ficheiro (em `apps/web/public/fonts/`) | Bytes | Eixos e subset |
| --- | --- | --- | --- | --- |
| Títulos, números grandes | Newsreader (SIL OFL) | `newsreader-display-roman.woff2` | 41 768 | `wght` 500, `opsz` 36 a 72 (variável), pt-PT |
| Ênfase em título | Newsreader Italic | `newsreader-display-italic.woff2` | 24 684 | `wght` 400, `opsz` 60 |
| Texto, UI | Inter | `inter-landing.woff2` | 30 140 | `wght` 400 a 600, `opsz` 14, `tnum`, `case`, `zero` |
| Etiquetas, dados, código | Geist Mono (SIL OFL) | `geist-mono-landing.woff2` | 14 120 | `wght` 400 a 500 |
| **Total** | | | **110 712** | ≤ 120 KB cumprido |

Licenças e proveniência: `apps/web/public/fonts/LICENSES.md`. Regenerar: `just brand-fonts` (`scripts/brand/fonts_landing.py`).

**Porquê Newsreader.** É a voz da marca (o wordmark é Newsreader Medium, opsz 72): o título da landing e o logótipo partilham desenho,
e a página lê-se como uma publicação editorial, que é o tom certo para decisores municipais. Tem eixo ótico (`opsz` 6 a 72): em
tamanhos grandes os traços finos ficam finos e os serifs afiados, em corpo pequeno engrossa. Cobre todos os acentos do português,
tem algarismos tabulares (`tnum`) e é OFL. Trocar de serifa para a landing partiria a coerência com o logótipo.

**Porquê Inter e não outra grotesca.** Já está na app (continuidade landing a produto), tem `tnum`, `case`, `zero`, optical size
a 14 px para texto corrido e cobre o português por inteiro. Inter Tight, Hanken Grotesk e Schibsted Grotesk são alternativas
válidas mas não acrescentam o suficiente para justificar um segundo tipo de texto.

**Porquê Geist Mono.** 14 KB, `wght` 400 a 500, legível a 12 px e com desenho contemporâneo que combina com Inter; dá o registo
«dado» às etiquetas, números de passo e à linha de prova do hero. É o terceiro tipo e fica restrito a etiquetas e dados.

### Candidatos avaliados

Tamanhos medidos com o mesmo subset (pt-PT) e os mesmos eixos reduzidos; «n/m» = não medido.

| Fonte | Licença | Variável e `opsz` | pt-PT | `tnum` | Peso (subset) | Veredicto |
| --- | --- | --- | --- | --- | --- | --- |
| **Newsreader** | OFL | sim, `opsz` 6-72, `wght` 200-800 | completo | sim | 85,8 KB (wght 400-500, opsz 12-72); **41,8 KB** (wght 500, opsz 36-72) | **Escolhida** (marca) |
| Fraunces | OFL | sim, `opsz` 9-144, `SOFT`, `WONK` | completo | sim | 55,2 KB (wght 400-500, SOFT e WONK fixos) | Mais personalidade e mais «divertida»; compete com o wordmark. Boa alternativa se se mudar a marca |
| Instrument Serif | OFL | não (peso único, sem `opsz`) | completo | n/m | 14,6 KB (regular), 15,1 KB (itálico) | Condensada e elegante, mas sem peso Medium nem `opsz`; não bate com o logótipo |
| Source Serif 4 | OFL | sim, `opsz` | completo | sim | n/m | Excelente para texto longo; demasiado neutra para títulos da marca |
| Literata | OFL | sim, `opsz` | completo | sim | n/m | Pensada para leitura em ecrã; pesada para landing |
| DM Serif Display | OFL | não | completo | não | n/m | Contraste forte, peso único, genérica |
| Gloock | OFL | não | completo | não | n/m | Carácter próprio mas pesada e de peso único |
| Playfair Display | OFL | sim | completo | sim | n/m | Muito vista; contraste excessivo em tamanhos médios |
| Inter | OFL | sim, `opsz` 14-32, `wght` 100-900 | completo | sim | 46,3 KB (400-600, opsz 14-32); **30,1 KB** (opsz 14 fixo) | **Escolhida** (texto) |
| Geist | OFL | sim | completo | sim | n/m | Boa, muito próxima de Inter; sem ganho |
| **Geist Mono** | OFL | sim, `wght` | completo | n/a | **14,1 KB** (400-500) | **Escolhida** (etiquetas) |
| Inter Tight, Schibsted Grotesk, Hanken Grotesk | OFL | sim | completo | sim | n/m | Alternativas ao Inter; sem ganho |
| Bricolage Grotesque | OFL | sim (`opsz`, `wdth`) | completo | n/m | n/m | Expressiva demais para o tom institucional |
| JetBrains Mono, IBM Plex Mono | OFL | JetBrains sim; Plex estática | completo | n/a | n/m | Mais pesadas que Geist Mono para o mesmo papel |

### Escala (fluida)

Rácio ~1,25 em desktop; os extremos do `clamp` são 360 px e 1280 px de viewport. Newsreader com `font-optical-sizing: auto`
(o navegador faz `opsz` = tamanho em px, preso a 36-72 no nosso subset).

| Token | CSS | Fonte | Entrelinha | Tracking | Uso |
| --- | --- | --- | --- | --- | --- |
| `--fs-display` | `clamp(2.75rem, 1.55rem + 5.4vw, 6.25rem)` | Newsreader 500 | 1,0 | -0,028em | `h1` do hero |
| `--fs-h2` | `clamp(2rem, 1.3rem + 3vw, 3.75rem)` | Newsreader 500 | 1,06 | -0,02em | Títulos de secção |
| `--fs-h3` | `clamp(1.5rem, 1.2rem + 1.2vw, 2rem)` | Newsreader 500 | 1,15 | -0,012em | Títulos de cartão |
| `--fs-stat` | `clamp(2.5rem, 1.6rem + 4vw, 4.5rem)` | Newsreader 500, `tnum` | 1,0 | -0,02em | Números grandes |
| `--fs-lead` | `clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem)` | Inter 400 | 1,5 | -0,005em | Linha de apoio |
| `--fs-body` | `1rem` (16 px; 17 px ≥ 1024 px) | Inter 400 | 1,6 | 0 | Texto corrido, 60 a 70 caracteres |
| `--fs-small` | `0.875rem` | Inter 400 | 1,5 | 0 | Notas e fontes |
| `--fs-label` | `0.75rem` | Geist Mono 500 | 1,3 | +0,08em, maiúsculas | Etiquetas, números de passo, dados |

### Regras

```css
h1, h2, h3 { text-wrap: balance; font-optical-sizing: auto; font-kerning: normal; hyphens: manual; }
p, li, blockquote { text-wrap: pretty; max-width: 68ch; }
.display, h1, h2 { font-family: "Newsreader Display", "Newsreader", Georgia, serif; font-weight: 500; font-feature-settings: "kern", "liga"; }
.stat, [data-num] { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
body { font-family: "Inter Landing", "Inter", system-ui, sans-serif; font-feature-settings: "kern", "calt"; -webkit-text-size-adjust: 100%; text-rendering: optimizeLegibility; }
.label { font-family: "Geist Mono Landing", ui-monospace, monospace; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; font-size: var(--fs-label); font-feature-settings: "zero"; }
```

Itálico de ênfase só em 1 a 3 palavras do título («ao menor custo»). Números com unidade em pt-PT (`formatTonnes`, etc.). Pontos finais
nos títulos de frase completa; sem maiúsculas em títulos (exceto etiquetas mono).

### `@font-face` e pré-carregamento (copiar)

```css
@font-face { font-family: "Newsreader Display"; src: url("/fonts/newsreader-display-roman.woff2") format("woff2"); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: "Newsreader Display"; src: url("/fonts/newsreader-display-italic.woff2") format("woff2"); font-weight: 400; font-style: italic; font-display: swap; }
@font-face { font-family: "Inter Landing"; src: url("/fonts/inter-landing.woff2") format("woff2"); font-weight: 400 600; font-style: normal; font-display: swap; }
@font-face { font-family: "Geist Mono Landing"; src: url("/fonts/geist-mono-landing.woff2") format("woff2"); font-weight: 400 500; font-style: normal; font-display: swap; }
```

```html
<link rel="preload" href="/fonts/newsreader-display-roman.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/inter-landing.woff2" as="font" type="font/woff2" crossorigin />
```

Só se pré-carregam as duas fontes do primeiro ecrã (68 KB). Itálico e mono carregam depois (`swap`). Sem CLS: gerar fallbacks com
métricas ajustadas (`size-adjust`, `ascent-override`, `descent-override`) com `@capsizecss/metrics` ou `fontaine` para Georgia e
Arial, e usá-los depois da fonte na pilha. A CSP já permite `font-src 'self'`.

Nota: as fontes da app (`newsreader-latin-*.woff2`, `inter-latin-*.woff2`, 650 KB) continuam a servir o resto do produto; a landing não as carrega.

---

## 4. Hero: a Penha ao fim do dia

Fotografia «Costa, Penha, Guimarães» de RaquelRosa7 (CC BY-SA 4.0, a mesma do painel de entrada); ficheiros, pesos e decisões em [`linguagem-dither.md`](linguagem-dither.md).
Componente: `apps/web/src/components/photos.tsx` (`HeroPicture`); CSS: bloco «Hero» de `styles.css` (`.lp-hs*`).

- **Dois arranjos, mesmas condições de media no `<picture>` e no CSS** (`landing-assets.generated.ts`): *largo* (`min-width: 640px` e `min-aspect-ratio: 6/5`):
  fotografia 16:10 a toda a largura, texto à esquerda sobre o céu, cartão com o número no canto da floresta (só ≥ 1024 px e até 2:1);
  *empilhado* (telemóvel e tablet de pé): fotografia 4:5 com o campanário da Penha logo abaixo da barra, texto na metade de baixo (polegar), véu curto (5,5 rem)
  só atrás do texto, pico e encostas vivos.
- Primeiro ecrã em telemóvel: barra, pico, eyebrow, título (≤ 4 linhas, itálico verde), subtítulo curto (`landing_lead_short`), um botão primário («Ver a demo ao vivo»), ligações discretas («Criar conta», «Ver o código») e a linha de prova (301,3 t, 22,9% estimativa). Cabe em 375 × 667.
- LCP: `fetchpriority="high"`, sem lazy, cor do céu como fundo, `preload` por `prefers-color-scheme` e media (campo `preload` do `manifest.json`).
- Escuro: véu à esquerda no ecrã largo (texto claro sobre o flanco dourado); claro: só em ecrãs menos largos que 17:10.
- Sem parallax, sem véu de pontos, sem canvas: a fotografia só tem o fade de chegada e o texto só o escalonamento do que está sob o título.

---

## 5. Painel de entrada (login e registo)

Rotas: `apps/web/src/routes/_auth.tsx` e `_auth/*.tsx`; painel em `features/auth/auth-panel.tsx`.

**Desktop (≥ 1024 px): *split-screen*.** Coluna esquerda 54% com `login-painel-{light|dark}-{960|1440}.avif` (3:4, fotografia da Penha em meio-tom, a imagem
de produção, mantida), a etiqueta, a frase de valor (Newsreader) e três factos sobre a zona clara; coluna do formulário 46% (mín. 480 px).
**Telemóvel: sem imagem nem logótipo**, só o formulário.

---

## 6. Checklist de telemóvel

| # | Item | Como |
| --- | --- | --- |
| 1 | Viewport | `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">` (já existe) |
| 2 | Altura de ecrã | `min-height: 100svh` no hero (nunca `100vh`); `100dvh` só em folhas e menus; fallback `min-height: 100vh` antes da regra `svh` |
| 3 | Safe areas | `padding-inline: max(16px, env(safe-area-inset-left))`; navbar `padding-top: env(safe-area-inset-top)`; CTA fixo e rodapé `padding-bottom: calc(12px + env(safe-area-inset-bottom))` |
| 4 | `theme-color` por secção | `<meta name="theme-color">` atualizado por IntersectionObserver: hero e secções claras `#F4F1EA`, secção escura `#14211D`; manter as duas metas com `media="(prefers-color-scheme)"` e, ao rolar, escrever só a que corresponde ao tema atual (já há `lib/theme.tsx`) |
| 5 | iOS PWA | `apple-mobile-web-app-status-bar-style: default` (já) e `viewport-fit=cover`; testar com a app instalada: topo opaco, sem texto branco sobre Linho |
| 6 | Barra de endereço dinâmica (Safari) | Nada de `position: fixed; height: 100vh`; o hero cresce com `svh`; navbar escondida ao rolar para baixo reaproveita espaço |
| 7 | Overscroll | `html { overscroll-behavior-y: none }` na landing (sem *bounce* branco sobre o hero escuro); no menu e nas folhas `overscroll-behavior: contain` |
| 8 | Toque | `-webkit-tap-highlight-color: transparent` com `:active` visível; alvos ≥ 44 px (iOS) e ≥ 48 px dos CTA; espaçamento ≥ 8 px |
| 9 | Hover vs. toque | `@media (hover: hover) and (pointer: fine)` para efeitos de hover; em `pointer: coarse` sem hover, estado `:active` |
| 10 | Desfoque da navbar | `@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))` com `-webkit-backdrop-filter` e fundo opaco a 92% como fallback |
| 11 | Fontes sem FOIT/CLS | `font-display: swap`, pré-carregar só 2 ficheiros, fallbacks com métricas ajustadas, `h1` sem animação de entrada (LCP) |
| 12 | Imagem do hero | `width`/`height`, `fetchpriority="high"`, AVIF com `sizes="100vw"`, nunca `loading="lazy"`; formato móvel 4:5 em < 768 px |
| 13 | Dados e energia | `@media (prefers-reduced-data: reduce)` e `navigator.connection.saveData` escolhem 432/640 px e desligam o efeito; `prefers-reduced-motion` desliga B e C e o parallax |
| 14 | Teclado no ecrã | `interactive-widget=resizes-content` (já): em formulários o layout encolhe; evitar `position: fixed; bottom: 0` com campos (usar `sticky` dentro do formulário, `StickyActions`) |
| 15 | Safari: `sticky` | `position: sticky` falha dentro de ancestral com `overflow: hidden/auto`: usar `overflow: clip` e não `overflow-x: hidden` em `body` ou `main`; testar a navbar |
| 16 | Safari: `fixed` e `transform` | `position: fixed` dentro de elemento com `transform`/`filter` deixa de ser fixo: a navbar e o CTA ficam fora de qualquer pai transformado |
| 17 | Zoom | Campos a 16 px (sem zoom automático no iOS); nunca `maximum-scale=1` |
| 18 | Larguras 320 a 430 px | Título com `clamp` e `text-wrap: balance`; sem scroll horizontal (`html { overflow-x: clip }` e conteúdo ≤ 100vw); testar 320, 375, 390, 430 |
| 19 | Tablets e dobráveis | Pontos de quebra por contentor, não por aparelho: 480, 768, 1024; *Galaxy Fold* fechado a 280 a 320 px; `@media (horizontal-viewport-segments: 2)` não é necessário |
| 20 | Landscape | Hero `min-height: 100svh` com `max-height: 900px`; em landscape < 500 px de altura o texto do hero reduz para `--fs-h2`, a navbar não esconde |
| 21 | Notch e Dynamic Island | Conteúdo útil nunca sob `env(safe-area-inset-top)`; imagens de fundo podem sangrar |
| 22 | Android Chrome | Barra gestual: `padding-bottom` com `safe-area`; `theme-color` pinta a barra de estado; teclar `Voltar` fecha o menu (estado no histórico) |

---

## 7. SEO técnico e de conteúdo

### 7.1 O que existe hoje e o que falta

| Ficheiro | Estado | Falta |
| --- | --- | --- |
| `apps/web/index.html` | Um único `index.html` (SPA): `lang="pt-PT"` fixo, `title`, `description`, `canonical` raiz, `hreflang` pt-PT, en e x-default, OG e Twitter básicos, `og:image` PNG | Metas por idioma e por rota (um SPA só tem um conjunto); `og:image:alt`, `og:locale`, JSON-LD, `twitter:site`/`title`/`description`; `canonical` e `hreflang` por página |
| `apps/web/public/robots.txt` | Permite tudo e bloqueia `/api/` | Bloquear rotas privadas, ligar sitemap |
| `apps/web/public/sitemap.xml` | `/pt/`, `/en/`, `privacy`, `terms` com `hreflang` | `lastmod`, `x-default`, auto-referência completa |
| `apps/web/nginx.conf` | `gzip` básico, SPA `try_files`, segurança | Pré-render servido, `X-Robots-Tag` nas privadas, cache de ativos não *hashed*, compressão de AVIF/SVG, redirecionamento de `/` |
| `vite.config.ts` | PWA (manifest, ícones) | Manifest com nome/descrição por idioma não é possível; manter `lang: pt-PT` |

### 7.2 Títulos e descrições (por idioma)

Limites: título ≤ 60 caracteres, descrição 140 a 160. O Novelo não promete números sem fonte.

| Página | Idioma | `<title>` | `meta description` |
| --- | --- | --- | --- |
| Landing | pt-PT | `Novelo: recolha seletiva de têxteis, desenhada ao menor custo` (61) | `Novelo desenha a rede de recolha de têxteis de Guimarães ao menor custo: orçamento e meta entram, saem cenários comparáveis em euros, toneladas e €/t.` |
| Landing | en | `Novelo: textile collection, designed at the lowest cost` | `Novelo designs Guimarães' textile collection network at the lowest cost: budget and target go in, comparable scenarios come out in euros, tonnes and €/t.` |
| Entrar | pt-PT | `Entrar · Novelo` | `Entre no Novelo para desenhar e comparar cenários da rede de recolha de têxteis de Guimarães.` |
| Entrar | en | `Sign in · Novelo` | `Sign in to Novelo to design and compare textile collection network scenarios for Guimarães.` |
| Privacidade | pt-PT / en | `Política de Privacidade · Novelo` / `Privacy Policy · Novelo` | Resumo de 150 caracteres do que se recolhe e porquê |
| Termos | pt-PT / en | `Termos de Utilização · Novelo` / `Terms of Use · Novelo` | Idem |
| Passaporte de lote | pt-PT / en | `Passaporte do lote {código} · Novelo` | `Origem, triagem e destino do lote {código}: o percurso de cada saco de têxteis até à fibra.` |

### 7.3 `<head>` por página (modelo)

```html
<html lang="pt-PT"> <!-- "en" nas rotas /en/ -->
<title>Novelo: recolha seletiva de têxteis, desenhada ao menor custo</title>
<meta name="description" content="…" />
<link rel="canonical" href="https://novelo.helder.si/pt/" />
<link rel="alternate" hreflang="pt-PT" href="https://novelo.helder.si/pt/" />
<link rel="alternate" hreflang="en" href="https://novelo.helder.si/en/" />
<link rel="alternate" hreflang="x-default" href="https://novelo.helder.si/pt/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Novelo" />
<meta property="og:url" content="https://novelo.helder.si/pt/" />
<meta property="og:title" content="Novelo: recolha seletiva de têxteis, desenhada ao menor custo" />
<meta property="og:description" content="…" />
<meta property="og:image" content="https://novelo.helder.si/og/novelo-partilha-landing-pt.png" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Novelo: recolha de têxteis, desenhada ao menor custo. Pôr do sol sobre Guimarães em pontos dourados e verdes." />
<meta property="og:locale" content="pt_PT" />
<meta property="og:locale:alternate" content="en_GB" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="…" />
<meta name="twitter:description" content="…" />
<meta name="twitter:image" content="https://novelo.helder.si/og/novelo-partilha-landing-pt.png" />
<meta name="twitter:image:alt" content="…" />
```

Em `/en/`: `og:locale=en_GB`, `og:locale:alternate=pt_PT`, imagem `…landing-en.png`.
Imagens OG por página: landing → `landing`; `/login`, `/register` → `entrar`; `/passport/$code` → `passaporte`; relatório público (se existir) → `relatorio`.
Formatos: PNG, 1200×630, ≤ 292 KB: aceites por Facebook, LinkedIn, X, WhatsApp, Slack e iMessage (PNG e JPEG são os formatos universais; WebP e AVIF **não**). Zona
segura: texto importante em 1000×500 centrados (x 100 a 1100, y 65 a 565); o lockup e o título estão aí.
`og-image.png` (landing pt) e `og-image@2x.png` mantêm-se para compatibilidade.

`theme-color` e *manifest* (já em `index.html` e PWA): manter `#F4F1EA`/`#0F1815`, `manifest.webmanifest` gerado pelo plugin, `lang: pt-PT`.
Favicons: `favicon.svg`, `favicon.ico` 48, `apple-touch-icon` 180, ícones 192/512 e *maskable*: já gerados por `just brand`.

### 7.4 JSON-LD

Um bloco por tipo, no `<head>`, dentro de `<script type="application/ld+json">` (a CSP não bloqueia blocos de dados). Textos
por idioma. Sem avaliações, preços ou números que não existam.

```json
{ "@context": "https://schema.org", "@graph": [
  { "@type": "Organization", "@id": "https://novelo.helder.si/#org", "name": "Novelo",
    "url": "https://novelo.helder.si/", "logo": "https://novelo.helder.si/icons/icon-512.png",
    "email": "novelo@heldergoncalves.io", "sameAs": ["https://github.com/helderpgoncalves/novelo"] },
  { "@type": "WebSite", "@id": "https://novelo.helder.si/#site", "url": "https://novelo.helder.si/", "name": "Novelo",
    "inLanguage": ["pt-PT", "en"], "publisher": { "@id": "https://novelo.helder.si/#org" } },
  { "@type": "SoftwareApplication", "name": "Novelo", "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web", "inLanguage": "pt-PT",
    "description": "Ferramenta de decisão que desenha a rede de recolha seletiva de têxteis de Guimarães ao menor custo.",
    "url": "https://novelo.helder.si/pt/", "publisher": { "@id": "https://novelo.helder.si/#org" } }
] }
```

- **FAQPage** na landing, com as perguntas da secção FAQ (mesmo texto da página). Nota: desde 2023 o Google só mostra rich results de FAQ a sites de governo e saúde, mas o *markup* continua válido e ajuda outros motores e assistentes.
- **BreadcrumbList** nas páginas internas (`/pt/privacy`, `/pt/terms`): Início > Privacidade.
- `SoftwareApplication` não leva `offers` nem `aggregateRating` enquanto não houver preço nem avaliações reais (o teste de Rich Results avisa de campos recomendados em falta: aceitável).
- Validar com o Rich Results Test e o Schema Markup Validator.

### 7.5 Semântica e conteúdo

- Um único `h1` por página (o título do hero); `h2` por secção; `h3` por cartão. Sem saltos de nível.
- Landmarks: `header`, `nav aria-label`, `main id="content"`, `footer`; ligação «Saltar para o conteúdo» no topo.
- `alt`: imagens decorativas (hero dither, texturas) com `alt=""`; capturas do produto com `alt` descritivo («Simulador do Novelo com o orçamento e a meta à esquerda e a rede resultante no mapa»).
- Ligações internas com texto descritivo («Ver os dados e as fontes», não «clica aqui»): da landing a `/pt/privacy`, `/pt/terms`, ao registo e às secções por âncora.
- `lang` por idioma no `<html>` e `lang` em citações noutra língua.
- Conteúdo: o texto da landing tem de existir em HTML (ver pré-render); números com fonte; FAQ com 6 a 8 perguntas reais («Que dados usam?», «É de uso gratuito?», «Quem pode aceder?»).
- Partilha: botões de partilha são links simples (`https://wa.me/?text=…`, `https://www.linkedin.com/sharing/share-offsite/?url=…`, `mailto:`), sem *scripts* de terceiros.

### 7.6 `robots.txt`, `sitemap.xml` e *noindex*

`robots.txt` (as rotas da aplicação dependem de sessão; o URL com prefixo de idioma também):

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /pt/simulator
Disallow: /en/simulator
# (repetir para as rotas privadas: scenarios, chat, coverage, map, lots, reports, users, account, admin, triage, pilot…)
Sitemap: https://novelo.helder.si/sitemap.xml
```

Mais simples e seguro: no nginx, `X-Robots-Tag: noindex, nofollow` em todas as rotas **exceto** a lista de públicas
(`/`, `/pt/`, `/en/`, `/pt|en/privacy`, `/pt|en/terms`, `/pt|en/passport/*`, `/assets`, `/landing`, `/og`, `/icons`, `/fonts`), e
`<meta name="robots" content="noindex">` aplicado em runtime nas rotas `_auth` (login, registo, recuperar, convite) e `_app`. As
páginas de entrada (`login`, `register`) podem ter título e OG, mas **noindex**: não têm valor de pesquisa.
Passaportes públicos de lote: indexáveis (`index, follow`) mas **fora do sitemap** (códigos por lote).

`sitemap.xml` (`scripts/prerender.mjs` gera, com `lastmod` = data do último commit que tocou a página):

```xml
<url>
  <loc>https://novelo.helder.si/pt/</loc><lastmod>2026-10-20</lastmod>
  <xhtml:link rel="alternate" hreflang="pt-PT" href="https://novelo.helder.si/pt/"/>
  <xhtml:link rel="alternate" hreflang="en" href="https://novelo.helder.si/en/"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://novelo.helder.si/pt/"/>
</url>
```

(o mesmo para `/en/`, `privacy`, `terms`; cada URL referencia **todas** as variantes, incluindo ela própria).
`x-default` aponta a `/pt/` (mercado e idioma base); `/` responde 302 para `/pt/` ou `/en/` conforme `Accept-Language`, com `Vary: Accept-Language`.

### 7.7 Core Web Vitals

| Métrica | Meta | Como |
| --- | --- | --- |
| LCP | ≤ 2,5 s em 4G | O candidato é o título (texto, com fonte pré-carregada) ou a imagem do hero: `<link rel="preload" as="image" … fetchpriority="high">`, AVIF 640 em móvel, `width`/`height`; nenhuma imagem acima da dobra com `loading="lazy"` |
| CLS | 0 | `width`/`height` em todas as imagens; fallbacks de fonte com métricas ajustadas; navbar de altura fixa; sem *banners* injetados |
| INP | ≤ 200 ms | Sem JS pesado no scroll: *scroll-spy* e *reveal* por IntersectionObserver; `content-visibility: auto; contain-intrinsic-size: auto 800px` nas secções abaixo da dobra |
| TTFB | ≤ 200 ms | HTML estático servido por nginx; HTTP/2 (já via Traefik/Coolify) |
| Peso | ≤ 300 KB de JS inicial na landing, imagem do hero ≤ 300 KB (1280) | Landing em *chunk* próprio (`autoCodeSplitting` já), sem dependências novas |

### 7.8 Servir já renderizado a rastreadores (pré-render)

A landing é um SPA: Google executa JS, mas o `<head>` por idioma, a imagem OG e os rastreadores sem JS (LinkedIn, WhatsApp, Slack,
Facebook, muitos assistentes) só veem o `index.html` base. Recomendação, em duas fases, sem framework novo:

1. **Fase 1 (obrigatória, 1 a 2 h): `<head>` estático por rota.** Script `apps/web/scripts/prerender.mjs`, executado depois de `vite build`:
   para cada rota pública (`/pt/`, `/en/`, `/pt/privacy`, `/en/privacy`, `/pt/terms`, `/en/terms`, `/pt/login`, `/en/login`) copia
   `dist/index.html` para `dist/<rota>/index.html`, substitui `<html lang>`, `<title>`, descrição, `canonical`, `hreflang`, OG/Twitter e
   JSON-LD a partir de uma tabela (`src/lib/seo-routes.ts`, partilhada com as mensagens do Paraglide), e acrescenta um `<main>` estático
   no `<noscript>` com o `h1`, a linha de apoio, os 4 números e as ligações legais. Gera `sitemap.xml` com `lastmod`. Zero dependências novas.
2. **Fase 2 (opcional): pré-render completo com Playwright**, já instalado (`@playwright/test`): depois do passo anterior, `vite preview`,
   abrir cada rota com Chromium, esperar `networkidle`, gravar `page.content()` em `dist/<rota>/index.html`. React hidrata por cima
   (`hydrateRoot`) ou substitui (`createRoot`; sem *hydration mismatch* porque a página não tem estado de utilizador). Custo: +20 s no
   *build*, e só nas 8 rotas públicas.

Alternativas descartadas: Next.js/Astro (reescrever a app), SSR em runtime (mais uma peça a operar), `vite-react-ssg` (acopla ao router).

### 7.9 nginx, cache, compressão e segurança

Alterações em `apps/web/nginx.conf`:

```nginx
# pré-render: servir <rota>/index.html antes do fallback do SPA
location / {
    try_files $uri $uri/index.html /index.html;
    add_header Cache-Control "no-cache";
    include /etc/nginx/snippets/security-headers.conf;
}
# raiz: idioma por Accept-Language (302), nunca para crawlers de OG
location = / {
    set $lang pt;
    if ($http_accept_language ~* "^en") { set $lang en; }
    add_header Vary "Accept-Language" always;
    return 302 /$lang/;
}
# ativos com nome estável (sem hash): 30 dias + revalidação
location ~* ^/(landing|og|fonts|icons)/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, stale-while-revalidate=86400";
    include /etc/nginx/snippets/security-headers.conf;
    try_files $uri =404;
}
# não indexar o que é privado ou de sessão (exceto as públicas)
location ~ ^/(pt|en)/(login|register|forgot-password|reset-password|accept-invite|join|magic-link|verify-email|pending-approval|simulator|scenarios|chat|coverage|map|lots|reports|users|account|admin|triage|pilot|market|brands|assumptions|circuits|fleet|localities|municipal|data-quality)(/|$) {
    add_header X-Robots-Tag "noindex, nofollow" always;
    include /etc/nginx/snippets/security-headers.conf;
    try_files $uri /index.html;
}
gzip on; gzip_comp_level 5; gzip_min_length 1024; gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/javascript application/manifest+json application/xml image/svg+xml;
```

- **Brotli:** a imagem `nginx:alpine` oficial não traz o módulo. Opções: pré-comprimir no *build* (`vite-plugin-compression2`, gera `.br` e `.gz`) e servir com `gzip_static on;` (+ `brotli_static on;` se se mudar para uma imagem com o módulo), ou ativar o *compress* do Traefik do Coolify. AVIF, WebP, PNG e WOFF2 já são comprimidos: não os incluir em `gzip_types`.
- **HTTP/2 e HTTP/3:** terminados no Traefik/Coolify (Let's Encrypt); confirmar com `curl -I --http2 https://novelo.helder.si/`.
- **Cabeçalhos de segurança:** já há CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. Acrescentar `Strict-Transport-Security: max-age=31536000; includeSubDomains` (no Traefik ou no snippet, depois de confirmar que todos os subdomínios têm HTTPS), `Cross-Origin-Opener-Policy: same-origin` e `X-Content-Type-Options` (já). O JSON-LD inline não viola `script-src 'self'`.
- **Cache:** `/assets/` já é `immutable` por 1 ano; `index.html` e HTML pré-renderizado `no-cache`.

### 7.10 Checklist de validação

1. `curl -s https://novelo.helder.si/pt/ | grep -E "<title>|canonical|hreflang|og:image|ld\+json"`: tudo presente **sem executar JS**.
2. Rich Results Test (https://search.google.com/test/rich-results) e Schema Markup Validator (https://validator.schema.org).
3. Depurador de partilha: Facebook (https://developers.facebook.com/tools/debug/), LinkedIn Post Inspector (https://www.linkedin.com/post-inspector/), Card Validator do X (se disponível), e colar o link em WhatsApp, Slack e iMessage: a imagem aparece com o texto legível.
4. Lighthouse (móvel, 4G lento) e PageSpeed Insights: LCP ≤ 2,5 s, CLS 0, INP ≤ 200 ms, SEO 100, Acessibilidade ≥ 95, Melhores práticas ≥ 95.
5. Search Console: propriedade de domínio, submeter `sitemap.xml`, inspecionar `/pt/` e `/en/`, relatório de *hreflang* sem erros.
6. `curl -I` nas privadas: `X-Robots-Tag: noindex`; `robots.txt` e `sitemap.xml` acessíveis; `curl -I https://novelo.helder.si/` devolve 302 com `Vary`.
7. Teste em dispositivos reais: iPhone com Dynamic Island, iPhone SE, Pixel e Samsung (Android), iPad, dobrável; claro e escuro; Safari, Chrome, Firefox.

---

## 8. O que o agente de implementação deve fazer (ficheiro a ficheiro)

Ordem sugerida, cada passo independente e verificável.

1. **`apps/web/src/styles.css`**: acrescentar os quatro `@font-face` da secção 3, os tokens `--fs-*` e as regras tipográficas; manter as fontes da app. Classes `lp-display`, `lp-lead`, `eyebrow` passam a usar os tokens.
2. **`apps/web/index.html`**: dois `<link rel="preload">` de fontes; `<link rel="preload" as="image" … light>` do hero; `og:image:alt`, `og:locale`, `og:locale:alternate`, `twitter:title/description/image:alt`; ligar `og-image` à nova imagem; manter o `noscript` com `h1` e ligações.
3. **`apps/web/src/features/landing/hero.tsx`**: `<picture>` da secção 4 (claro/escuro conforme o tema), `figure` sem cartão, título com `<em>` no fim em `Newsreader Display Italic`, etiqueta mono, linha de prova. Manter um só `h1`.
4. **`landing-nav.tsx`**: navbar da secção 2 (estado de scroll, *scroll-spy*, esconder ao rolar no móvel, folha `100dvh`, CTA fixo móvel). Sem dependências.
5. **`layout.tsx`, `story.tsx`, `product.tsx`, `closing.tsx`**: ritmo e fundos da tabela de secções; `textura-*` como `background-image` com `image-set()` (AVIF) em camadas `::before` com `aria-hidden`; uma secção escura.
6. **Rodapé** (`footer.tsx`): marca, Produto, Projeto, Legal (Privacidade, Termos, Contacto, Créditos e licenças), cartão do Hack4Guimarães 2035 com a capa oficial, parceiros e barra com idioma e tema.
7. **`routes/_auth.tsx` e `features/auth`**: *split-screen* e faixa móvel da secção 5; `<meta name="robots" content="noindex">` nas rotas `_auth`.
8. **`apps/web/scripts/prerender.mjs`** (novo) e `package.json` (`"build": "vite build && node scripts/prerender.mjs && tsc --noEmit"`): fase 1 da secção 7.8; gerar `sitemap.xml` com `lastmod` e `hreflang`.
9. **`apps/web/public/robots.txt`**: bloquear as privadas; manter `Sitemap`.
10. **`apps/web/nginx.conf`**: blocos da secção 7.9; HSTS no `security-headers.conf` ou no Traefik.
11. **`mensagens` Paraglide (`messages/pt-PT.json`, `en.json`)**: `seo_*` (títulos, descrições, `og:image:alt`), `auth_panel_quote`, `landing_photo_credit`, FAQ.
12. **Passaporte público (`routes/passport.$code.tsx`)**: `<title>`, descrição e `og:image` = `novelo-partilha-passaporte-{pt|en}.png`, `canonical`, `robots: index, follow`; BreadcrumbList.
13. **Testes**: um teste de Vitest que verifique as metas por rota (títulos ≤ 60, descrições ≤ 160, uma `canonical`, `hreflang` recíproco) e um de Playwright que confirme o LCP (`PerformanceObserver`) e CLS 0 na landing em `390×844` e `1440×900`.
14. **Regenerar os ativos** se mudar algo: `just brand` (tudo) ou `just brand-landing`; `just brand-fonts` (fontes, precisa de rede).
15. **Corrigir a documentação** que diz que o repositório é privado (já corrigido nos docs desta entrega).

Ativos já criados e prontos a ligar: ver [`linguagem-dither.md`](linguagem-dither.md#ativos).

## Fontes

- https://linear.app, https://stripe.com, https://vercel.com, https://www.apple.com/pt/, https://arc.net, https://www.notion.com, https://www.raycast.com, https://www.anthropic.com, https://mistral.ai, https://ramp.com, https://mercury.com, https://www.are.na, https://teenage.engineering, https://www.patagonia.com, https://www.allbirds.com (consultados em 20 de outubro de 2026).
- Fontes: https://github.com/google/fonts (Newsreader, Inter, Geist Mono, Fraunces, Instrument Serif; OFL 1.1).
- Fotografia: https://commons.wikimedia.org/wiki/File:Costa_-_Penha,_Guimar%C3%A3es_-_20210501194326.jpg (CC BY-SA 4.0, RaquelRosa7).
- Google, *Structured data* e *FAQ rich results*: https://developers.google.com/search/docs/appearance/structured-data/faqpage
- Google, *hreflang* e versões localizadas: https://developers.google.com/search/docs/specialty/international/localized-versions
- web.dev, *Core Web Vitals*: https://web.dev/articles/vitals
- Open Graph: https://ogp.me
