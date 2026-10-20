# Linguagem dither

O Novelo fala em **pontos**. Uma fotografia, um fio ou um campo de cor viram uma grelha de pontos de meio-tom cujo tamanho
diz a densidade: do branco do papel ao denso da tinta. É a imagem do mesmo gesto do produto (contar, agregar, decidir) e
fica nítida em qualquer ecrã, porque o ponto é geometria e não pixel de fotografia. Esta linguagem substitui os fundos
planos e os gradientes que o guia de marca já recusa.

Três referências do utilizador (`docs/marca/referencias/`) fixam o alvo estético:

| Referência | O que ensina | Como a tradução do Novelo responde |
| --- | --- | --- |
| `dither-montanha-dourado` | Ponto redondo fino a 45°, grão cintilante, tritone dourado, verde e tinta sobre fundo claro | Hero e OG em fotografia da Penha, rampa Areia, Floresta, Tinta |
| `dither-dunas-areia` | Pontos em cruz numa grelha ortogonal, densidade que nasce do branco e se condensa em cristas | Textura «dunas» (cruz a 0°) e fundo do passaporte |
| `dither-campo-verde` | Textura mínima por todo o papel, adensada só num canto, verde monotone | Textura «campo» e fundo do relatório |

## Princípios

1. **O papel é o fundo.** Linho (`#F4F1EA`) no claro, Tinta de fundo (`#0F1815`) no escuro. Os pontos nunca cobrem tudo: há sempre papel entre eles, e na zona de texto a densidade desce a 7%.
2. **Grelha a 45° para imagem, 0° para textura.** Fotografia e símbolo usam pontos redondos a 45° (a grelha desaparece e fica a forma); texturas abstratas usam cruz ou losango a 0° (a grelha é o motivo, como nas dunas de referência).
3. **A célula é proporcional à largura.** O número de células por largura é constante entre tamanhos (hero 16:9: 320; 4:3: 256; móvel: 216; painel de entrada: 240; faixa: 400; OG: 300), por isso o desenho é o mesmo em 640 ou 1920 px e só muda a nitidez. Células inteiras (2, 4, 6 px) evitam moiré em 1x.
4. **A densidade tem curva.** A fotografia passa por níveis automáticos (percentis 2 a 98), curva `d' = d^1,4` (claro; `1,35` no escuro) que aclara os meios-tons, piso de 5% (o papel nunca é liso) e teto de 95% (o preto nunca fecha). O ponto redondo tem raio `0,7072·√d` células: a densidade 1 enche a célula.
5. **Cor por ponto, não por píxel.** Cada ponto tem a cor da densidade no centro da sua célula, lida de uma rampa: Areia (zonas claras), Floresta (meios), Tinta (sombras). No escuro a rampa inverte-se: o ponto é luz (verde apagado, dourado, dourado claro) sobre o fundo escuro.
6. **O símbolo também é de pontos.** Os três fios e o ponto, com a geometria real do logótipo, viram densidade; cada fio mantém a sua cor (Verde claro, Floresta, Areia) e à volta nascem ondas de pontos. É a imagem «o fio que liga a cidade».
7. **Ótica antes de efeito.** Sem brilhos, sombras, gradientes suaves nem ruído de cor. O único «ruído» admitido é o grão (cobertura por píxel ± 15% nos bordos do ponto) e o jitter por célula (± 4%), e só em fotografia.

## Paleta e rampas

| Rampa | Claro (fundo Linho) | Escuro (fundo `#0F1815`) | Usar em |
| --- | --- | --- | --- |
| `ouro` | Areia `#C4A06A` → `#B49355` → Floresta `#2E6B57` → Tinta `#14211D` | `#3E6658` → `#4F7A66` → `#A08B5C` → Areia → `#E3C98F` | Fotografia (hero, painel, OG, banner, capa) e símbolo |
| `campo` | Verde claro `#A9C2B7` → Floresta → Tinta | `#3E6658` → Floresta clara `#7FB39C` | Relatório, fundos de secção suaves |
| `dunas` | Areia → Pedra `#5E6B66` → Tinta | `#3E6658` → Pedra → Areia | Passaporte, texturas abstratas |

As cores dos pontos são as do guia de marca; as paragens intermédias (`#B49355`, `#4F7A66`, `#A08B5C`, `#E3C98F`) são interpolações
para suavizar a rampa e não são cores de marca autónomas.

## Onde usar e onde não usar

| Usar | Não usar |
| --- | --- |
| Hero, faixas de secção, painel de entrada, partilha (OG), banners e capa | Atrás de tabelas, formulários, mapas e gráficos (o dither compete com os dados) |
| Uma única imagem dither por ecrã; texto sempre na zona de densidade baixa | Em botões, cartões de dados e ícones |
| Fundos de peças impressas (relatório RAP: capa) | Como textura repetida sobre o texto corrido |
| Em movimento só no hero, e só se não houver `prefers-reduced-motion` | Gradientes CSS, sombras e desfoque por cima das imagens dither |

## Acessibilidade e contraste

- O texto assenta sempre na zona sparse (7 a 10% de densidade). O gerador mede o contraste contra os blocos de 8 px do fundo (percentil 10 no texto escuro, 90 no claro) e **falha abaixo de 4,5:1**. Valores atuais: 6,6 a 7,3:1 nos claros e 4,56:1 no pior caso escuro (tagline da capa).
- Texto secundário sobre dither claro usa **Pedra escura `#46534E`** (7,6:1 sobre Linho): a Pedra `#5E6B66` sozinha (4,9:1) cai abaixo de AA assim que há pontos por baixo.
- As imagens são decorativas (`alt=""`), exceto OG (`og:image:alt`). O significado nunca vive só na imagem.
- Versão clara e escura de tudo: o escuro troca o fundo e inverte a rampa, não apenas as cores.

## Gerador

`scripts/brand/dither.py` é o motor (célula, ângulo, forma, curva, grão, jitter, semente, rampa, mapa de cor, campos de densidade).
`scripts/brand/dither_assets.py` define os ativos e verifica dimensões, peso e contraste; corre dentro de `just brand`.

| Parâmetro (`Halftone`) | Efeito | Valores usados |
| --- | --- | --- |
| `cell` | Lado da célula em px | `largura / células por largura` (2 a 6) |
| `angle` | Rotação da grelha | 45° (imagem), 0° (cruz) |
| `shape` | `round`, `cross`, `diamond`, `square` | `round` e `cross` |
| `gamma` | Curva de densidade | 1,35 a 1,4 (fotografia) |
| `grain`, `jitter` | Cintilação e variação por célula | 0 nos ativos finais (nitidez máxima) |
| `seed` | Semente (jitter e grão) | 7 |
| `softness` | Largura do anti-aliasing em px | 1,0 (nítido) |

Exemplo (Python):

```python
from dither import Halftone, photo_density, OURO
d = photo_density(foto, (1280, 720), gamma=1.4)            # claro = escuro-denso
img = Halftone(cell=4, angle=45, shape="round").render(d, OURO)
```

Campos disponíveis: `photo_density` (fotografia), `dunes_density`, `field_density` (canto adensado, direção `corner`),
`symbol_field` (símbolo em pontos, com `glow`), `gradient` e `value_noise` para novas composições. Para mudar a **direção do
degradé** usa-se `fade_left`, `fade_top` ou `gradient(h, w, (dx, dy))`, multiplicados pela densidade.

## Ativos

Tudo regenerável com `just brand` (`just brand-landing` só a landing). Pesos medidos na geração; `manifest.json` lista dimensões e bytes.

| Ativo | Ficheiros | Dimensões | Peso típico | Uso |
| --- | --- | --- | --- | --- |
| Hero 16:9 | `apps/web/public/landing/hero-16x9-{light,dark}-{640,1280,1920}.avif` | 640×360, 1280×720, 1920×1080 | 49 / 277 / 473 KB (claro) | Hero desktop |
| Hero 4:3 | `hero-4x3-{light,dark}-{768,1536}.avif` | 768×576, 1536×1152 | 100 / 414 KB | Tablet |
| Hero móvel 4:5 | `hero-mobile-{light,dark}-{432,864,1296}.avif` | 432×540, 864×1080, 1296×1620 | 52 / 248 / 425 KB | Telemóvel (texto em cima, imagem em baixo) |
| Fallback sem AVIF | `hero-*-{light,dark}-{640,768,432}.webp` | idem, menores | ~60 a 120 KB | `<picture>` |
| Painel de entrada (desktop) | `login-painel-{light,dark}-{960,1440}.avif` | 960×1280 e 1440×1920 (3:4) | 321 / 557 KB | Split-screen em ecrãs largos |
| Faixa de entrada (móvel) | `login-faixa-{light,dark}-{1200,2400}.avif` | 1200×360 e 2400×720 (10:3) | 52 / 162 KB | Cabeçalho do ecrã de entrada |
| Texturas de secção | `textura-{fio,campo,dunas}-{light,dark}-1280.avif` | 1280×720 | 71 a 176 KB | Fundos de faixas e CTA final |
| Tile vetorial | `tile-cruz-{light,dark}.svg` | 16×16 repetível | 0,2 KB | Fundo discreto de secção (`background-image`, 0,5 a 1 de opacidade) |
| Partilha (OG) | `apps/web/public/og/novelo-partilha-{landing,entrar,passaporte,relatorio}-{pt,en}.png`; `og-image.png`; `og-image@2x.png` | 1200×630 (landing também 2400×1260) | 130 a 292 KB cada | `og:image`, `twitter:image` |
| Banner | `brand/redes/novelo-banner-2400x450{,-escuro}.png`, `docs/img/banner-{proposta,projeto,escuro}.png` | 2400×450 | ~280 KB | README, docs |
| Capa | `brand/redes/novelo-capa-1920x1080{,-escuro}.png` | 1920×1080 | ~590 KB | Redes sociais, slides |

Pontos nítidos: o AVIF a qualidade 80 com croma 4:4:4 (sem subamostragem) preserva a forma do ponto; as imagens com texto e
logótipo são PNG de paleta adaptativa sem dither (≤ 292 KB para caberem no limite de 300 KB das redes sociais). O mesmo desenho
sem perdas em WebP sem perdas pesa 2 a 3 vezes mais (550 KB o hero 1280), por isso só se usa o AVIF como formato final.

## Licença da fotografia

O hero, o painel de entrada e as variações de fotografia derivam de uma fotografia CC BY-SA 4.0: ver
`apps/web/public/landing/CREDITS.md`. A atribuição vai no rodapé da landing.
