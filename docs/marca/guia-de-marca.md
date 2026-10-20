# Novelo: guia de marca

Uma identidade calma e editorial: cores de fibra natural, uma serifa para a voz e uma sans neutra para o trabalho. Nada de gradientes, brilhos ou roxos.

## O símbolo

Três fios quase fechados à volta de um ponto. Os fios são o têxtil que volta ao ciclo; o ponto é o ponto de recolha. A abertura em cima diz que o ciclo ainda não está fechado, e é aí que o Novelo trabalha.

| Ficheiro | Usar em |
| --- | --- |
| `simbolo/novelo-simbolo-positivo.svg` | Fundos claros (linho ou branco) |
| `simbolo/novelo-simbolo-negativo.svg` | Fundos escuros (tinta) |
| `simbolo/novelo-simbolo-mono-escuro.svg` | Impressão a uma cor, carimbos, fundos claros |
| `simbolo/novelo-simbolo-mono-claro.svg` | Uma cor sobre fotografia ou fundo escuro |

Cada um tem PNG `@1x`, `@2x` e `@3x` (96, 192 e 288 px, com área livre incluída). O centro do anel é transparente (não há "buraco" pintado), por isso funciona sobre qualquer fundo. O `viewBox` dos SVG é a caixa de tinta, sem margem: centra-se pela tinta em qualquer contentor.

## Logotipo

Símbolo à esquerda, palavra "Novelo" em Newsreader Medium (opsz 72, tracking -1,8%) à direita. O wordmark é **convertido em curvas a partir da fonte real** (`brand/fontes/`), por isso nunca depende de fontes instaladas. Versões em `logotipo/`, fundo transparente: `positivo` (fundos claros), `negativo` (fundos escuros), `mono-escuro` e `mono-claro`; cada uma em horizontal e `empilhado`, em SVG e PNG (`@1x` 320 px, `@2x`, `@3x` e master de 2640 px de largura; nos empilhados 200 px em `@1x`). Os SVG têm caixa de tinta; os PNG incluem a área livre.

### Construção

Tudo deriva de uma só medida, a **altura de maiúscula** do wordmark (`C`, a altura do "N"). Medidas reais em `brand/geometria.json` (unidades da fonte, 2000/em: C = 1430, altura de x = 1024, overshoot do "o" = 22).

| Regra | Valor |
| --- | --- |
| Altura do símbolo (tinta) | `C` + 2 × overshoot do "o": sobe e desce ao mesmo nível que as redondas do wordmark |
| Eixo vertical do símbolo | Centro da tinta do símbolo = meio da altura de maiúscula (`C / 2`) |
| Distância símbolo-texto | `U = C / 3`, da tinta do símbolo à tinta do "N" |
| Caixa do lockup | Simétrica em torno do eixo do símbolo: ao centrar a caixa num contentor (flex, `items-center`) o símbolo fica no centro exato |
| Empilhado | Símbolo com altura `2C`, folga de `2U` até ao topo do "l", ambos centrados no eixo vertical do wordmark |

O ponto do anel fica ligeiramente acima do eixo (cerca de 4% da altura do símbolo): é intencional, porque a abertura está em cima e a massa dos fios fica em baixo; centrar o ponto em vez da tinta empurrava o símbolo para baixo da linha de base.

Em código usa-se sempre `BrandLogo` / `BrandSymbol` (`apps/web/src/components/brand-logo.tsx`), que desenham a mesma geometria (`brand-geometry.gen.ts`, gerado). Dimensiona-se só pela altura (`h-6`, `h-8`); nunca se monta símbolo e texto à mão. `tone="auto"` segue o tema claro/escuro.

### Área livre e tamanhos mínimos

- Área livre do lockup: `C / 2` em todos os lados (o PNG já a inclui). Do símbolo sozinho: um quarto da largura.
- Tamanho mínimo: lockup horizontal 96 px de largura (altura de maiúscula ≥ 8 px), empilhado 64 px, símbolo 16 px. Abaixo de 24 px o símbolo usa a variante ótica do favicon (dois fios mais grossos e ponto cheio).
- Contraste: wordmark e ponto 14,7:1 sobre Linho (e o negativo sobre Tinta); fio do meio negativo 7:1; os fios interiores e a areia são decorativos (< 3:1) e nunca levam texto. No favicon os fios foram clareados para ≥ 3:1 sobre Tinta (WCAG 1.4.11).

### Usos incorretos

Não rodar, esticar nem contornar; não pôr sombra, brilho ou gradiente; não recolorir os fios fora das paletas (positivo, negativo, mono); não alterar o espaço símbolo-texto nem alinhar o texto à mão; não redigitar "Novelo" noutra fonte; não usar o positivo sobre fundo escuro (o ponto desaparece) nem o negativo sobre claro; não pôr sobre fotografia sem mono-claro.

### Regenerar e verificar

`just brand` regenera tudo a partir de `scripts/brand/geometry.py` (única fonte de verdade): SVG e PNG de símbolo e logotipos, `favicon.svg` e `favicon.ico` (16/32/48), `apple-touch-icon` 180, ícones PWA 192/512 e `maskable-512` (tinta dentro do círculo de zona segura de 40%), avatares (quadrado e `circulo`), imagem de partilha OG 1200×630 (`apps/web/public/og-image.png`), capa e banner, imagens do email (logótipo para fundo claro e negativo para o modo escuro), o splash de `index.html`, o cabeçalho do relatório RAP e `brand-geometry.gen.ts`. Precisa de `rsvg-convert` (`brew install librsvg`). As bases das imagens de partilha (sem logótipo) estão em `scripts/brand/base/`.

`just check-brand` mede o alinhamento em píxeis a 512 px (base e altura de maiúscula do "N", altura e centro do símbolo, distância `U`, centragem do empilhado, ícones e zona segura, contrastes) e falha acima de 0,5 px. `brand/preview.html` mostra tudo sobre linho, branco e tinta a 16, 32, 64, 128 e 512 px, com as guias de construção. `just brand-shots` regenera as capturas do manifesto PWA com a stack em `just dev`.

## Cores

| Nome | Hex | Papel | Contraste sobre Linho |
| --- | --- | --- | --- |
| Linho | `#F4F1EA` | Fundo principal | - |
| Tinta | `#14211D` | Texto e títulos | 14,7:1 |
| Floresta | `#2E6B57` | Cor de marca, ligações, destaques | 5,6:1 |
| Pedra | `#5E6B66` | Texto secundário | 4,9:1 |
| Areia | `#C4A06A` | Só detalhe: um fio, um traço, um ponto | 2,2:1 (nunca em texto) |
| Linha | `#DCD5C8` | Divisórias e contornos | - |
| Floresta clara | `#7FB39C` | Floresta sobre fundo escuro | 7,0:1 sobre Tinta |

Proporção típica numa peça: 70% Linho, 20% Tinta, 8% Floresta, 2% Areia. Todas as combinações de texto cumprem WCAG AA.

## Tipografia

| Papel | Fonte | Peso | Notas |
| --- | --- | --- | --- |
| Logotipo e títulos | Newsreader | 500 (Medium) | Tracking -1,8% em tamanhos grandes; optical sizing ligado |
| Frases de destaque | Newsreader | 400 | Pode usar Floresta numa segunda linha |
| Texto e interface | Inter | 400 e 500 | 15 a 18 px no ecrã, entrelinha 1,5 |
| Etiquetas | Inter | 600 | Maiúsculas, tracking +22%, Floresta |
| Números de destaque | Newsreader | 500 | Algarismos alinhados |

Ambas são gratuitas e de código aberto (SIL Open Font License). Os ficheiros web estão em `fontes/`; as versões para desktop descarregam-se no Google Fonts.

```css
:root {
  --linho: #F4F1EA;
  --tinta: #14211D;
  --floresta: #2E6B57;
  --pedra: #5E6B66;
  --areia: #C4A06A;
  --linha: #DCD5C8;
  --floresta-clara: #7FB39C;
  --font-titulo: "Newsreader", Georgia, serif;
  --font-texto: "Inter", system-ui, sans-serif;
}
```

## Peças prontas

| Ficheiro | Medida | Para quê |
| --- | --- | --- |
| `avatar/novelo-avatar-claro-*.png` | 1024, 512, 256 | Perfil e ícone (claro, preferido) |
| `avatar/novelo-avatar-escuro-*.png` | 1024, 512, 256 | Perfil em plataformas de tema escuro |
| `avatar/novelo-avatar-circulo-{claro,escuro}-*.png` | 1024, 512, 256 | Versão já recortada em círculo (transparente fora) |
| `redes/novelo-capa-1920x1080.png` | 16:9 | Capa da página do projeto, primeiro slide |
| `redes/novelo-banner-2400x450.png` | 16:3 | Banner da página do projeto e do repositório |
| `redes/novelo-partilha-1200x630.png` | 1,91:1 | Imagem de partilha (Open Graph) do site |

## Tom de voz

Direto, concreto, sem promessas vagas. Números com unidade e fonte. Português europeu. Dizemos "estimativa" quando é estimativa.
