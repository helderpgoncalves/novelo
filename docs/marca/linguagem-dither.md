# Linguagem visual: fotografia de Guimarães com dither próprio

A linguagem do Novelo é **fotografia de Guimarães com dither próprio**: fotografias de licença livre (Penha, Paço dos Duques, antiga fábrica
têxtil, Couros, Plataforma das Artes) convertidas em **meio-tom redondo a 45º**, em duotone ouro, floresta e tinta, todas pelo mesmo motor, com a
mesma célula, curva tonal e paleta. Não há texturas inventadas nem imagens do utilizador: as três fotografias em `docs/marca/referencias/` são só
referência de estilo. O papel (Linho `#F4F1EA`, Tinta `#0F1815`) é sempre o fundo.

## Fontes e licenças

Registo completo (título, página, data) em `apps/web/public/landing/CREDITS.md`; o crédito visível está na página «Créditos e licenças», ligada no rodapé das páginas públicas.

| Fotografia | Autor | Licença | Uso |
| --- | --- | --- | --- |
| Costa, Penha, Guimarães | RaquelRosa7 | CC BY-SA 4.0 | **Hero** (claro e escuro) e painel do ecrã de entrada |
| Paço dos Duques de Bragança e Castelo (vista aérea) | Luis Miguel Jorge Duarte | CC BY-SA 4.0 | Faixas entre secções (`photo-paco`) |
| Antiga fábrica têxtil na rua da Liberdade | V.B.Speranza | CC BY 4.0 | Cartões do problema e do mini-simulador (`photo-fabrica`) |
| Couros (roda do antigo curtume) | V.B.Speranza | CC BY-SA 4.0 | Cartão do mapa (`photo-couros`) |
| Plataforma das Artes | Vitor Oliveira | CC BY-SA 2.0 | CTA final, em escuro (`photo-plataforma`) |

Só se aceitam CC0, domínio público, CC BY, CC BY-SA e as licenças Unsplash, Pexels e Pixabay; nunca NC, ND nem direitos reservados, e ≥ 3000 px no lado
maior. Os derivados em meio-tom de fotografias CC BY-SA partilham-se nos mesmos termos (nota em `CREDITS.md`). Não se encontrou fotografia livre de
alta resolução de chaminés ou tijolo têxtil do Vale do Ave: a fábrica da rua da Liberdade e os Couros são o património industrial disponível.

## O motor (`scripts/brand/dither.py`, `lattice_halftone`)

- **Gera-se ao tamanho final.** Cada ficheiro é o meio-tom da fotografia calculado já na resolução de destino; nunca se reduz uma imagem que já é pontos
  (o que criava moiré e arredondava os pontos).
- **Pontos em coordenadas inteiras.** Os centros caem em `(a·m, a·n)` com `m + n` par: passo `a` px, célula `a·√2`. Cada ponto tem sempre a mesma forma sobre a
  grelha de píxeis. A razão largura/passo é constante em cada família (480 no hero largo, 272 no alto, 240 nos fundos), por isso as larguras de uma família
  são o mesmo desenho em escala inteira (2, 3, 4, 5 px por passo): sem batimento entre larguras.
- **Densidade por célula, não por amostra.** O tom de cada ponto é a média da sua célula; os pontos sub-píxel degradam em área (cobertura = área do círculo)
  em vez de cintilarem. Cantos e contornos: anti-aliasing analítico de 1 px.
- **Curva tonal.** Níveis por percentis (2 a 98), gama 1,4 (claro) ou 1,35 (escuro), cobertura máxima de 95% (as sombras não entopem) e mínima de 5% (as altas luzes
  mantêm um ponto). Claro: escuro = denso. Escuro: luminoso = denso, sobre Tinta; é uma conversão própria, não um filtro sobre a clara.
- **Duotone da marca.** Rampa Areia → Floresta → Tinta (claro) e Fio escuro → Areia (escuro), interpolada em sRGB linear. Sem perfil ICC embebido: tudo sRGB.
- **Determinístico.** Sem aleatoriedade; mesma entrada, mesmos bytes (os nomes levam o hash do conteúdo).
- **Sem grão.** O grão da referência antiga foi retirado: custava bytes e não melhorava a leitura.

## Hero: composição

`wide` 16:10 (texto à esquerda sobre o céu, que a curva `fade_left` aclara no claro e escurece no escuro para o texto ter contraste AA; medido na geração:
13,5:1 claro, 5,8:1 escuro) e `tall` 4:5 (telemóvel e tablet de pé, recorte de 800 × 1000 px em torno do campanário, que fica a 29% da altura por cima do texto).
A cor do primeiro desenho é a média do céu (`HERO_SKY`). No ecrã largo o cartão com o número fica no céu, no canto superior direito, e deixa o campanário livre.

## Formatos e pesos (decisão medida)

- **AVIF 4:4:4, `speed=2`.** Num recorte de 340 × 280 px do hero 1440 a 4:4:4 q52 (50 KB) é indistinguível do original sem perdas; 4:2:0 q52 poupa só 6% (47 KB) e
  desfoca a cor do ponto, por isso mantém-se 4:4:4. Qualidade inicial 60, que desce em passos de 2 se o orçamento não couber (piso 34; fundos, piso 26).
- **WebP com perdas q40 (`sharp_yuv`)** só como alternativa do hero para navegadores sem AVIF (todas as larguras). Os fundos são só AVIF: sem AVIF não há fundo, e a
  secção continua legível.
- Fundos puramente decorativos de pontos em SVG/CSS não igualam a fotografia (a forma vem da imagem); mantêm-se como AVIF ≤ 60 KB.

| Ficheiro (`apps/web/public/landing/`) | Largura × altura | AVIF claro / escuro | WebP claro / escuro | Orçamento AVIF | Antes (AVIF) |
| --- | --- | --- | --- | --- | --- |
| `hero-wide-{tone}-960` | 960 × 600 | 21 / 16 KB | 44 / 38 KB | ≤ 120 KB | 79 / 81 KB |
| `hero-wide-{tone}-1440` | 1440 × 900 | 71 / 56 KB | 257 / 283 KB | ≤ 180 KB | 168 / 172 KB |
| `hero-wide-{tone}-1920` | 1920 × 1200 | 72 / 65 KB | 382 / 406 KB | ≤ 250 KB | 221 / 226 KB |
| `hero-wide-{tone}-2400` | 2400 × 1500 | 181 / 155 KB | 638 / 716 KB | ≤ 450 KB | 365 / 378 KB |
| `hero-tall-{tone}-544` | 544 × 680 | 24 / 17 KB | 33 / 30 KB | ≤ 120 KB | 54 / 55 KB |
| `hero-tall-{tone}-816` | 816 × 1020 | 70 / 48 KB | 180 / 180 KB | ≤ 120 KB | 114 / 115 KB |
| `hero-tall-{tone}-1088` | 1088 × 1360 | 74 / 57 KB | 262 / 240 KB | ≤ 180 KB | 177 / 171 KB |
| `hero-tall-{tone}-1360` | 1360 × 1700 | 195 / 127 KB | 430 / 386 KB | ≤ 250 KB | 240 / 248 KB |
| `fundo-{paco,fabrica,couros,plataforma}-{tone}-960` | 960 × 640 | 30 a 47 KB | n/a | ≤ 60 KB | 54 / 38 KB (dunas, campo) |
| `fundo-{…}-{tone}-1440` | 1440 × 960 | 50 a 59 KB | n/a | ≤ 60 KB | 72 / 69 KB (dunas, campo) |

A coluna «Antes» é o pipeline anterior (recortes das três imagens do utilizador); a Penha em produção (grelha 16:9, `hero-16x9`) pesava 283 KB em 1280 e 484 KB em 1920.
Os nomes levam o **hash do conteúdo** (`hero-wide-light-1920.50418952.avif`): nginx serve-os com `Cache-Control: public, max-age=31536000, immutable`.
`landing-assets.generated.ts` e `.css` (gerados) trazem os nomes; `manifest.json` lista dimensões, pesos, o `preload` (que a prerender escreve no HTML) e a cor do céu.

## Carregamento

- `<link rel="preload" as="image">` por direção de arte e tema, com `imagesrcset` e `imagesizes` (o navegador só pede o que corresponde); `fetchpriority="high"`,
  sem `loading="lazy"`, `decoding="auto"` (com `async` o primeiro desenho pode sair sem imagem), dimensões explícitas (CLS 0), sem JS para a imagem.
- Cor sólida (média do céu) no hero enquanto a imagem chega. Fade de 280 ms só se a imagem chegar depois do primeiro desenho; `prefers-reduced-motion` e
  `Save-Data` respeitados (menor largura).
- Secções abaixo do hero com `content-visibility: auto`; fundos só se pedem quando o elemento existe. A PWA não faz precache de AVIF/WebP (`globPatterns`).

## Onde usar e onde não usar

| Usar | Não usar |
| --- | --- |
| Hero, faixas entre secções, CTA final, fundo de cartões em destaque (esbatido por máscara e opacidade) | Atrás de tabelas, formulários, mapas e gráficos |
| Texto sempre sobre a zona clara do céu, sobre um véu local curto ou sobre uma zona esbatida | Gradientes por cima da fotografia, desfoque, padrões gerados em CSS/SVG |

O mapa das freguesias (`parish-map.tsx`) é um gráfico de dados em meio-tom, não uma textura decorativa.

**Painel do ecrã de entrada.** Mantém a imagem de produção, `login-painel-{light,dark}-{960,1440}.avif` (3:4, a mesma Penha), gerada por `just brand-login`
(`scripts/brand/login_panel.py`, `dither.py` e `dither_assets.py`). Não foi alterada. Em telemóvel o ecrã de entrada não tem imagem.

## Gerador

`just brand-landing` (ou `just brand-hero`) corre `scripts/brand/hero_derivatives.py`: parâmetros em dicionários no topo (paleta, curva, recortes, larguras, orçamentos),
fontes reduzidas em `scripts/brand/base/*-fonte.jpg`, verificação de dimensões, peso e contraste AA, `manifest.json` e os ficheiros gerados da web. Demora uns minutos
(AVIF `speed=2`). Imagens de partilha (OG), banners e capa continuam em `scripts/brand/dither_assets.py` com o motor `Halftone` original.
