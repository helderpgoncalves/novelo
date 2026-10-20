# Fontes self-hosted

Todas sob a SIL Open Font License 1.1 (https://openfontlicense.org): uso comercial, modificação (subsets) e
auto-alojamento permitidos. O texto integral da licença das famílias Inter e Newsreader está em `brand/fontes/*/OFL.txt`.

| Ficheiro | Família (origem) | Direitos de autor | Subset | Bytes |
| --- | --- | --- | --- | --- |
| `inter-latin-*.woff2`, `inter-latin-ext-*.woff2` | Inter (Google Fonts) | 2016 The Inter Project Authors (https://github.com/rsms/inter) | latim e latim-ext, todos os eixos (app) | - |
| `newsreader-latin-*.woff2`, `newsreader-latin-ext-*.woff2` | Newsreader (Google Fonts) | 2020 The Newsreader Project Authors (https://github.com/productiontype/Newsreader) | latim e latim-ext, todos os eixos (app) | - |
| `newsreader-display-roman.woff2` | Newsreader | idem | pt-PT + pontuação, `wght` 500, `opsz` 36-72 | 41 768 |
| `newsreader-display-italic.woff2` | Newsreader Italic | idem | pt-PT + pontuação, `wght` 400, `opsz` 60 | 24 684 |
| `inter-landing.woff2` | Inter | idem | pt-PT + pontuação, `wght` 400-600, `opsz` 14, `tnum`, `case`, `zero`, `ss01`, `cv11` | 30 140 |
| `geist-mono-landing.woff2` | Geist Mono (Vercel) | 2024 The Geist Project Authors (https://github.com/vercel/geist-font) | pt-PT + pontuação, `wght` 400-500 | 14 120 |

Os quatro ficheiros `*-display-*` e `*-landing.woff2` (110 712 bytes no total) são os da landing e das páginas públicas: são
subsets com o conjunto de caracteres do português (`U+0020-007E`, `U+00A0-00FF`, aspas, travessões, reticências, `€`, `·`, `−`),
gerados com fontTools (`instancer` + `subset`, sem hinting) a partir dos TTF variáveis do repositório google/fonts. Reproduzir:
`docs/marca/landing-direcao.md`, secção «Tipografia».
