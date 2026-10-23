# Deck do pitch

O deck do Novelo em PowerPoint, gerado por código (`pptxgenjs`) para que cada número venha dos dados e das capturas reais da app.
Dez diapositivos para os 4 minutos do pitch (mais 1 de perguntas) e anexos de apoio para o júri, com tempo e fala nas notas do orador de cada um.

| Ficheiro | O que é |
| --- | --- |
| `build.js` | O deck: tema da marca (Linho, Tinta, Floresta, Areia; Newsreader e Inter), esquemas, secções, notas |
| `assets.js` | Recursos: mapas reais a partir de `video/src/data/geo.json`, recortes das capturas em `video/public/shots`, capa dither, QR e o vídeo do plano B |
| `capture-mobile.cjs` | Capturas de telemóvel **uniformes** da produção (390 × 844 a 3x, mesma moldura): cenário, rotas por estrada, triagem, passaporte e fotografias |
| `qr-novelo.png` | QR para https://novelo.helder.si nas cores da marca |

## Gerar

Precisa dos dados do vídeo (`video/src/data/numbers.json`), das imagens de `docs/img` (geradas da produção por `scripts/docs/page-shots.cjs`) e da skill de pptx do Claude, por causa do `applyTheme`.

```bash
cd pitch && npm install
node assets.js
COOKIE_FILE=<ficheiro com __Host-access_token=...> node capture-mobile.cjs   # opcional: refaz os telemóveis (admin, 15 min)
PPTX_SKILL=<pasta da skill pptx> NODE_PATH=$PWD/node_modules node build.js   # → out/novelo-pitch.pptx
```

## Fontes

O deck usa **Newsreader** nos títulos e **Inter** no texto. No Google Drive/Slides ambas existem de origem (basta carregar o `.pptx` e abrir com o Google Slides). No PowerPoint, instalar as duas antes de abrir; são livres (SIL OFL) e estão no Google Fonts. Sem elas, o programa troca por outra fonte e os títulos mudam de largura. Os gráficos de barras e de linhas são objetos nativos do PowerPoint; o Google Slides mostra-os como imagem. O vídeo do plano B só é reproduzido no PowerPoint (o Google Slides ignora vídeos embebidos): levar o `.mp4` à parte.

## Regras

- Os números são os do [registo de afirmações](../docs/pesquisa/registo-de-afirmacoes.md) e da [visão geral](../docs/projeto/visao-geral.md). As estimativas dizem «estimativa».
- Se os cenários de referência mudarem, voltar a capturar a app (`video/scripts/capture.mjs`) e gerar o deck de novo.
