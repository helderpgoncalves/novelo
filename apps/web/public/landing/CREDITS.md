# Ativos da landing

Todas as imagens desta pasta são **fotografias de Guimarães com licença livre**, adaptadas em meio-tom Novelo (duotone ouro, floresta e tinta) por
`scripts/brand/hero_derivatives.py` (`just brand-landing`) e `scripts/brand/login_panel.py` (`just brand-login`). Os originais reduzidos (2400 px)
estão em `scripts/brand/base/*-fonte.jpg`. Não há texturas geradas nem imagens fornecidas pelo utilizador.
As três fotografias de referência em `docs/marca/referencias/` são só referência de estilo e **não se usam** na app.

A atribuição vive na página pública «Créditos e licenças» (`/pt/creditos`, `/en/credits`), alimentada por `apps/web/src/features/landing/photo-credits.ts` (fonte única). O rodapé de todas as páginas públicas liga a ela (ligação visível e razoável, que as licenças CC BY e CC BY-SA aceitam); já não há bloco de créditos inline.

**Partilha nos mesmos termos (CC BY-SA).** As imagens adaptadas de fotografias CC BY-SA (Penha, Paço dos Duques, Couros, Plataforma das Artes)
são obras derivadas e partilham-se sob a mesma licença (CC BY-SA, versão da fotografia de origem). A da fábrica têxtil é CC BY 4.0 (basta o crédito).
O código e o restante repositório não mudam de licença por isso: só estes ficheiros de imagem.

## Fotografias

| Ficheiros | Fotografia | Autor | Licença | Página | Data |
| --- | --- | --- | --- | --- | --- |
| `hero-*`, `login-painel-*` | «Costa, Penha, Guimarães» (`Costa_-_Penha,_Guimarães_-_20210501194326.jpg`) | RaquelRosa7 | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Costa_-_Penha,_Guimar%C3%A3es_-_20210501194326.jpg | 2021-05-01 |
| `fundo-paco-*` | «DJI 0145.paço duques bragançaJPG» (Paço dos Duques de Bragança e Castelo, vista aérea) | Luis Miguel Jorge Duarte | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:DJI_0145.pa%C3%A7o_duques_bragan%C3%A7aJPG.jpg | 2019-02-06 |
| `fundo-fabrica-*` | «Antiga fábrica têxtil na rua da Liberdade 1» | V.B.Speranza | CC BY 4.0 | https://commons.wikimedia.org/wiki/File:Antiga_f%C3%A1brica_t%C3%AAxtil_na_rua_da_Liberdade_1.jpg | 2024-01-05 |
| `fundo-couros-*` | «Couros zone» (roda do antigo curtume, zona dos Couros) | V.B.Speranza | CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Couros_zone.jpg | 2025-02-08 |
| `fundo-plataforma-*` | «Plataforma das Artes - Guimarães - Portugal (8244353917)» | Vitor Oliveira (Portuguese eyes) | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Plataforma_das_Artes_-_Guimar%C3%A3es_-_Portugal_(8244353917).jpg | 2012-08-29 |

Licenças: CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ · CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/ · CC BY-SA 2.0 https://creativecommons.org/licenses/by-sa/2.0/.
Licenças confirmadas nos metadados da Wikimedia Commons (`LicenseShortName`) a 2026-10-20.

## Alterações feitas

Recorte, redução, conversão para meio-tom (grelha de pontos a 45º, cobertura por luminância, rampa de cor da marca; no escuro, densidade invertida),
codificação AVIF e WebP. Na Plataforma das Artes cortou-se a marca de água do autor (rodapé da imagem original). Nada mais foi retocado.

## Reproduzir

`just brand-landing` regenera `hero-*`, `fundo-*`, `manifest.json` e `src/features/landing/landing-assets.generated.{ts,css}`; os nomes levam o hash do conteúdo.
Ver `docs/marca/linguagem-dither.md`.

## Capa do Hack4Guimarães 2035 (`hackathon-cover-*`)

| Ficheiros | `hackathon-cover-480.*` e `hackathon-cover-960.*` (AVIF e WebP, 16:9) |
| --- | --- |
| Origem | Capa oficial do evento na Taikai: https://taikai.network/cmguimaraes/hackathons/hack4guimaraes2035 (imagem `hackathon-cover.png`, 1920×1080, descarregada de `taikai.azureedge.net`; o URL completo está em `scripts/brand/hackathon_cover.py`) |
| Organização | Promovido pelo Município de Guimarães, com a Set.Up Guimarães e o Mês da Economia de Guimarães (os três logótipos aparecem na própria capa) |
| Uso | Só contexto do evento: cartão «Construído para o Hack4Guimarães 2035» no rodapé da landing e secção Hackathon da página de créditos. Ligação ao evento. |
| Alterações | Nenhuma além de reduzir (960×540 e 480×270) e comprimir (AVIF q62, WebP q78). Sem cortes, filtros nem texto novo. |
| Direitos | A imagem, as marcas e os logótipos pertencem aos seus titulares (Município de Guimarães, Set.Up Guimarães, Mês da Economia, Taikai). Não há licença livre declarada: o uso é de divulgação do evento em que o Novelo participa, sem implicar patrocínio nem aprovação. Se um titular pedir a remoção, retira-se. |

O original (2,4 MB) **não** está no repositório: `just brand-hackathon` descarrega-o para `scripts/brand/cache/` (ignorada pelo Git), gera os derivados com
`avifenc` e `cwebp` e escreve `apps/web/src/features/landing/hackathon-cover.generated.ts`. Os nomes levam o hash do conteúdo (cache imutável no nginx);
a PWA não os põe em precache (`landing/**` está ignorado).
