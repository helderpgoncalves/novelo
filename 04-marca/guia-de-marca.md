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

**Regras:** área livre à volta igual a metade do diâmetro do ponto central; tamanho mínimo 24 px no ecrã; nunca rodar, esticar, contornar ou pôr sombra.

## Logotipo

Símbolo à esquerda, palavra "Novelo" em Newsreader Medium à direita. Versões em `logotipo/`, com fundo transparente: positivo para fundos claros, negativo para fundos escuros. Altura mínima 32 px.

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
| `redes/novelo-capa-1920x1080.png` | 16:9 | Capa da página do projeto, primeiro slide |
| `redes/novelo-banner-2400x450.png` | 16:3 | Banner da página do projeto e do repositório |
| `redes/novelo-partilha-1200x630.png` | 1,91:1 | Imagem de partilha (Open Graph) do site |

## Tom de voz

Direto, concreto, sem promessas vagas. Números com unidade e fonte. Português europeu. Dizemos "estimativa" quando é estimativa.
