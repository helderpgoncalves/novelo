# Vídeo de apresentação

O vídeo do Novelo, com 2 minutos e 14 segundos, em **16:9 (1920 × 1080)** e **9:16 (1080 × 1920)**. Feito em [Remotion](https://www.remotion.dev): cada cena é React, e os números, o mapa e os ecrãs vêm dos dados reais.

## O que mostra

| Cena | Conteúdo | Fonte |
| --- | --- | --- |
| Abertura | A Penha em meio-tom da marca | `scripts/brand/base` |
| O número | ≈ 51 250,6 t de indiferenciado do concelho × 5,86% ≈ 3 003,3 t por ano no lixo (estimativa) | Vitrus (Relatório e Contas 2025, p. 8), APA (RARU 2025, p. 24) |
| 9 em cada 10 | 200 pontos, 18 recolhidos à parte (9,1%) | Vitrus, APA (estimativa) |
| Destino | 59,4% reutilização, 26,5% reciclagem, 14,1% rejeito | Vitrus |
| A lei | 1 jan 2025, transposição a 17 jun 2027, RAP a 17 abr 2028 | Diretiva (UE) 2025/1892 |
| Onde se perde | 48 freguesias (CAOP 2019) e os contentores municipais, no mapa | Pacote QGIS da Vitrus |
| A viragem | Contentores de têxtil, não; nem no camião do lixo; a rede refeita em 24 h, com uma viatura de têxtil nova | Mentor da Vitrus, 21 e 22 out 2026 |
| A rede | A viatura de têxtil a partir de Polvoreira, o saco à porta, os locais existentes e as escolas, do cenário de 60 000 €/ano | Otimizador, API de dev |
| Resultado | 445,8 t, 102,8 €/t, 264,9 t reutilizáveis, uma viatura de 42 500 €; o tratamento evitado (47 093 €, a 105,64 €/t) contra o custo (45 828 €); curva de custo (estimativas) | Cenários de referência v5, Vitrus |
| Produto | 10 ecrãs reais da app, com scroll e zoom: uma troca real com o copiloto, a triagem de uma peça, o lote com QR e o relatório RAP | `scripts/capture.mjs`, `public/shots/ops` |
| Em resumo | Impacto, inovação, viabilidade e continuidade, cada um com a prova | `docs/projeto/visao-geral.md` |
| Rigor e pedido | Testes, produção e o piloto de 3 meses | `just check` |

A banda sonora é original e sintetizada por `scripts/music.py`, a 100 BPM, na mesma grelha das cenas. Não usa amostras nem música de terceiros.

## Gerar

Com a stack de dev a correr (`just dev`):

```bash
cd video && npm install
node scripts/prepare-data.mjs            # mapa, cenário e rede (API de dev + data/processed) → src/data/geo.json
python scripts/prepare-halftone.py       # meio-tom das fotografias da marca → src/data/halftone.json
node scripts/capture.mjs                 # ecrãs da app (desktop e telemóvel) → public/shots/app + src/data/shots.json
python scripts/music.py                  # banda sonora → public/audio/music.wav
node render.mjs all                      # → out/novelo-16x9.mp4 e out/novelo-9x16.mp4
node render.mjs all --silent             # versões sem som
```

As capturas de `public/shots` (o copiloto, o passaporte, as páginas do relatório RAP) e as fontes em `public/brand` não vão para o Git. Para rever, `npx remotion studio` ou `node stills.mjs Landscape 100,500`.
