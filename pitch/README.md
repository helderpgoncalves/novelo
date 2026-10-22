# Deck do pitch

O deck do Novelo em PowerPoint, gerado por código (`pptxgenjs`) para que cada número venha dos dados e das capturas reais da app.
Doze diapositivos para os cinco minutos e cinco de apoio para as perguntas do júri, com notas do orador em cada um.

| Ficheiro | O que é |
| --- | --- |
| `build.js` | O deck: tema da marca (Linho, Tinta, Floresta, Areia; Newsreader e Inter), esquemas, secções, notas |
| `assets.js` | Recursos: mapas reais a partir de `video/src/data/geo.json`, recortes das capturas em `video/public/shots`, capa dither, QR e o vídeo do plano B |
| `qr-novelo.png` | QR para https://novelo.helder.si nas cores da marca |

## Gerar

Precisa das capturas e dos dados do vídeo (ver [o vídeo](../video/README.md)) e da skill de pptx do Claude, por causa do `applyTheme`.

```bash
cd pitch && npm install
node assets.js
PPTX_SKILL=<pasta da skill pptx> NODE_PATH=$PWD/node_modules node build.js   # → out/novelo-pitch.pptx
```

## Fontes

O deck usa **Newsreader Medium** nos títulos e **Inter** no texto. Instalar as duas antes de abrir no PowerPoint; são livres (SIL OFL) e estão no Google Fonts. Sem elas, o PowerPoint troca por outra fonte e os títulos mudam de largura. O PDF exportado já leva as fontes embebidas.

## Regras

- Os números são os do [registo de afirmações](../docs/pesquisa/registo-de-afirmacoes.md) e da [visão geral](../docs/projeto/visao-geral.md). As estimativas dizem «estimativa».
- Se os cenários de referência mudarem, voltar a capturar a app (`video/scripts/capture.mjs`) e gerar o deck de novo.
