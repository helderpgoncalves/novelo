# Guião de slides

Pronto a passar para o deck. Oito slides para cinco minutos, **uma ideia por slide, título que diz a conclusão**, fonte no rodapé de cada um. A história e as falas completas estão na [narrativa do pitch](narrativa-do-pitch.md); os números, no [registo de afirmações](../pesquisa/registo-de-afirmacoes.md).

## Regras do deck

| Regra | Detalhe |
| --- | --- |
| Identidade | Fundo **linho**, texto **tinta**, **floresta** como cor principal, **areia** só como detalhe; Newsreader nos títulos, Inter no texto ([guia de marca](../marca/guia-de-marca.md)) |
| Densidade | Um número grande por slide (corpo 96 pt ou mais), o resto em segundo plano |
| Rodapé | Fonte de cada número, em letra pequena, com o ano |
| Estimativas | Palavra "estimativa" no próprio número ou ao lado |
| Imagens | Capturas reais da app (claro), nunca ilustrações genéricas; usar [os diagramas existentes](../img/diagrama-do-saco-ao-fio.png) |
| Notas do orador | Em cada slide, 2 ou 3 linhas; o slide não repete o que se diz |

## Mapa do deck

```mermaid
flowchart LR
    S1[1 Capa] --> S2[2 Problema]
    S2 --> S3[3 Referência]
    S3 --> S4[4 Demo]
    S4 --> S5[5 IA]
    S5 --> S6[6 Indústria]
    S6 --> S7[7 2028]
    S7 --> S8[8 Pedido]
```

## Slides

### 1. Capa · 0:00 a 0:20

| | |
| --- | --- |
| **Título** | Do saco ao fio |
| **Subtítulo** | Novelo: a decisão da recolha de têxteis de Guimarães |
| **Visual** | Símbolo e logótipo Novelo sobre linho; uma linha: "Hack4Guimarães 2035 · Desafio TexVitrus" |
| **Número** | 72% dos têxteis descartados na Europa acabam no lixo indiferenciado |
| **Nota do orador** | Abre com o 72%. Passa logo ao problema local, sem apresentar a equipa. |
| **Rodapé** | AEA, Briefing 03/2024 (dados de 2020) |
| **Registo** | C10 |

### 2. Problema · 0:20 a 1:00

| | |
| --- | --- |
| **Título** | A recolha é obrigatória desde 2025 e ninguém a paga ainda |
| **Visual** | Linha do tempo horizontal: 1 jan 2025 (município obrigado) · 17 jun 2027 (transposição) · **17 abr 2028 (produtores pagam)**. Faixa a vermelho entre 2025 e 2028: "paga o município" |
| **Número** | 17 de abril de 2028 |
| **Nota do orador** | "Não há entidade gestora nem regime aprovado, diz a APA." Não digas "metas". |
| **Rodapé** | APA, FAQ têxteis, dez 2025; Diretiva (UE) 2025/1892 |
| **Registo** | B1, B4, B11, B12 |

### 3. Referência · 1:00 a 1:30

| | |
| --- | --- |
| **Título** | Guimarães recolhe menos de metade do que a França recolheria |
| **Visual** | Barras horizontais: Guimarães 1,9 · Catalunha 2,7 · França 4,27 · UE 4,4 (kg/hab/ano). Tracejado "à nossa escala: ≈ 670 t" |
| **Número** | 1,9 kg contra 4,27 kg por habitante |
| **Nota do orador** | "É uma referência, não uma meta." Menciona Sintra a retirar contentores. |
| **Rodapé** | Vitrus e INE, 2025; Refashion, 2024; ARC, 2024; AEA, 2020 |
| **Registo** | A2, C1, C8, C11, C14, C21 |

### 4. Demo · 1:30 a 3:30

| | |
| --- | --- |
| **Título** | Do orçamento ao relatório, em dois minutos |
| **Visual** | Captura do simulador com cenários A e B lado a lado; o resto é a app ao vivo |
| **Número** | O do cenário B (€/t e toneladas), "estimativa" |
| **Nota do orador** | Seguir o [roteiro da demo](narrativa-do-pitch.md#roteiro-da-demo). Um jurado faz a pergunta "E se...?". O QR é lido no telemóvel do jurado. |
| **Rodapé** | Cenários calculados pelo Novelo; pressupostos em "Pressupostos" |
| **Plano B** | Vídeo de 60 s e PDF RAP pré-gerado, num ficheiro local |

### 5. IA · 3:30 a 3:50

| | |
| --- | --- |
| **Título** | A IA conduz o otimizador; nunca faz contas |
| **Visual** | Diagrama em 4 passos: pergunta em português → alteração estruturada → otimizador → verificador de números |
| **Número** | Zero números calculados pelo modelo |
| **Nota do orador** | Responde à pergunta que o júri vai fazer: "e se a IA se engana?" |
| **Rodapé** | Verificador: todo o número da resposta tem de existir no resultado calculado |
| **Registo** | — |

### 6. Indústria · 3:50 a 4:15

| | |
| --- | --- |
| **Título** | A indústria tem capacidade; faltam lotes limpos |
| **Visual** | Lote com QR e composição ao lado do passaporte; ao lado, "Sasia ≈ 2 000 t/mês, pré-consumo" |
| **Número** | 2 000 t por mês, sobretudo pré-consumo (C16). A comparação com o potencial de Guimarães (5,5%) só se A8 estiver verificado |
| **Nota do orador** | "A foto não vê a fibra; a etiqueta sim. O operador confirma." Dizer a exatidão medida se existir (D4). |
| **Rodapé** | Público/Lusa, dez 2024; avaliação da triagem do Novelo |
| **Registo** | C16, D3, D4 |

### 7. 2028 · 4:15 a 4:40

| | |
| --- | --- |
| **Título** | Em 2028, quem provar o custo eficiente negoceia com os produtores |
| **Visual** | Captura do relatório RAP: custo por tipo de território (predominantemente urbana, mediamente urbana, predominantemente rural) |
| **Número** | "economicamente eficiente" (artigo 22.º-A, n.º 12) |
| **Nota do orador** | A diretiva só deixa cobrar o custo eficiente e transparente: é o que o relatório mostra. Menciona a economia social como parceira. |
| **Rodapé** | Diretiva (UE) 2025/1892, artigos 22.º-A e 22.º-C |
| **Registo** | B6, B10 |

### 8. Pedido · 4:40 a 5:00

| | |
| --- | --- |
| **Título** | Peço um piloto de três meses em duas freguesias |
| **Visual** | As duas freguesias recomendadas no mapa e três KPIs: toneladas, €/t, taxa de rejeito |
| **Número** | A frase-âncora: "X toneladas por ano a Y € por tonelada" |
| **Nota do orador** | Fecha com a frase-âncora e o pedido. Agradece e para. |
| **Rodapé** | Cenário B, estimativa a validar no piloto |
| **Registo** | cenário B; recomendador de piloto (em construção) |

## Checklist final do deck

- [ ] Cada número do deck tem linha no [registo](../pesquisa/registo-de-afirmacoes.md) com estado Dado Vitrus, Primária, Secundária ou Cálculo.
- [ ] Nenhum número "Por verificar" aparece (5,4%, 4 de 27, 228 €, 304 €, Humana 2025, Catalunha 75 €).
- [ ] X e Y da frase-âncora preenchidos com o cenário B de 22 de outubro.
- [ ] Rodapés de fonte em todos os slides.
- [ ] Vídeo de 60 s e PDF RAP guardados fora da rede.
- [ ] Os passos "em construção" só aparecem na demo se ensaiados a 25 de outubro.
- [ ] Três ensaios cronometrados e dentro de 5 minutos.
