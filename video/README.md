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
| A rede | A viatura de têxtil a partir de Polvoreira, o saco à porta, os locais existentes e as escolas, do cenário de 60 000 €/ano; as 8 rotas seguem as estradas reais (traçado do OSRM) | Otimizador, API de produção |
| Resultado | 431,1 t, 101,9 €/t, 256,1 t reutilizáveis, uma viatura de 42 500 €; o tratamento evitado (45 542 €, a 105,64 €/t) contra o custo (43 914 €); curva de custo (estimativas) | Cenários de referência v5, Vitrus |
| Produto | 10 ecrãs reais da produção, com scroll e zoom: uma troca real com o copiloto, a triagem de um cachecol (Polo Ralph Lauren), o lote `NOV-6EYRXN` com QR e passaporte, e o relatório RAP | `scripts/capture.mjs`, `scripts/capture-ops.mjs` |
| Em resumo | Impacto, inovação, viabilidade e continuidade, cada um com a prova | `docs/projeto/visao-geral.md` |
| Rigor e pedido | 1 164 testes da API, 449 da web, 155 perguntas ao copiloto (99% dos números verificados), produção e o piloto de 3 meses | `just check`, `just eval-copilot` |

A banda sonora é original e sintetizada por `scripts/music.py`, a 100 BPM, na mesma grelha das cenas. Não usa amostras nem música de terceiros.

## Gerar

Os ecrãs e os dados vêm da **produção** (novelo.helder.si), com um administrador. Cria-se uma sessão de 15 minutos dentro do contentor da API (`create_access_token`) e guarda-se numa linha `__Host-access_token=...` num ficheiro fora do repositório (`COOKIE_FILE`). Em dev (`just dev`), omitem-se `WEB`, `API` e `COOKIE_FILE`.

```bash
cd video && npm install
mkdir -p public/brand && cp ../apps/web/public/fonts/{newsreader-latin-standard-normal,newsreader-latin-ext-standard-normal,newsreader-latin-standard-italic,inter-latin-standard-normal,inter-latin-ext-standard-normal}.woff2 public/brand/
cp ../brand/logotipo/novelo-logotipo-{positivo,negativo,empilhado-positivo,empilhado-negativo}.svg ../brand/simbolo/novelo-simbolo-{positivo,negativo}.svg public/brand/
API=https://novelo.helder.si/api/v1 COOKIE_FILE=... node scripts/prepare-data.mjs   # mapa, cenário e rotas por estrada → src/data/geo.json
node scripts/prepare-numbers.mjs         # números e curva (API de dev) → src/data/numbers.json
python scripts/prepare-halftone.py       # meio-tom das fotografias da marca → src/data/halftone.json
WEB=https://novelo.helder.si COOKIE_FILE=... node scripts/capture.mjs                 # ecrãs da app → public/shots/app + src/data/shots.json
WEB=https://novelo.helder.si COOKIE_FILE=... node scripts/capture-ops.mjs             # copiloto, triagem, lote, passaporte, relatório → public/shots
python scripts/music.py                  # banda sonora → public/audio/music.wav (numpy e scipy)
BROWSER=<chrome-headless-shell do Playwright> node render.mjs all   # → out/novelo-16x9.mp4 e out/novelo-9x16.mp4
node render.mjs all --silent             # versões sem som
```

`BROWSER` é opcional: sem ele o Remotion descarrega o seu Chrome. Se a primeira carga da composição esgotar o tempo (`Waiting for root component to load`), usar o `chrome-headless-shell` do Playwright (`~/Library/Caches/ms-playwright/chromium_headless_shell-*/…`). O `capture-ops.mjs` conversa com o copiloto (1 pergunta, ~75 s) e apaga a conversa e o cenário que cria.

As capturas de `public/shots` (o copiloto, o passaporte, as páginas do relatório RAP) e as fontes em `public/brand` não vão para o Git. Para rever, `npx remotion studio` ou `node stills.mjs Landscape 100,500`.
