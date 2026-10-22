# Guião de slides

Pronto a passar para o deck. Oito slides para cinco minutos mais um slide de apoio, **uma ideia por slide, título que diz a conclusão**, fonte no rodapé de cada um. Cada slide declara o critério de avaliação que serve e o seu peso (inovação 25%, viabilidade 25%, impacto 30%, apresentação e continuidade 20%; ver [Critérios de avaliação](criterios-de-avaliacao.md)). A história e as falas completas estão na [narrativa do pitch](narrativa-do-pitch.md); os números, no [registo de afirmações](../pesquisa/registo-de-afirmacoes.md).

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
    S8 -.-> S9[9 Apoio]
```

## Slides

### 1. Capa · 0:00 a 0:20

| | |
| --- | --- |
| **Critério e peso** | Apresentação e continuidade (20%): gancho e clareza, 20 s |
| **Título** | Do saco ao fio |
| **Subtítulo** | Novelo: a decisão da recolha de têxteis de Guimarães |
| **Visual** | Símbolo e logótipo Novelo sobre linho; uma linha: "Hack4Guimarães 2035 · Desafio TexVitrus" |
| **Número** | 72% dos têxteis descartados na Europa acabam no lixo indiferenciado |
| **Nota do orador** | Abre com o 72%. Passa logo ao problema local, sem apresentar a equipa. |
| **Rodapé** | AEA, Briefing 03/2024 (dados de 2020) |
| **Registo** | C10 |

### 2. Problema · 0:20 a 0:45

| | |
| --- | --- |
| **Critério e peso** | Impacto e relevância (30%), 25 s |
| **Título** | A recolha é obrigatória desde 2025 e o município paga-a sozinho |
| **Visual** | Linha do tempo horizontal: 1 jan 2025 (município obrigado) · 17 jun 2027 (transposição) · **17 abr 2028 (regime criado; os produtores pagam as peças postas à venda a partir daí)**. Faixa a vermelho entre 2025 e 2028: "paga o município"; depois, a faixa vai clareando: "as peças antigas ainda pesam no município" |
| **Número** | 17 de abril de 2028 |
| **Nota do orador** | "Não há entidade gestora nem regime aprovado, diz a APA." Não digas "metas". Não digas "em 2028 os produtores pagam a recolha": pagam a das peças vendidas pela primeira vez depois da lei nacional (o mais tardar 17 abr 2028). Leitura a confirmar com a APA. |
| **Rodapé** | APA, FAQ têxteis, dez 2025; Diretiva 2008/98/CE, art. 11.º (2018) e RGGR; Diretiva (UE) 2025/1892, art. 22.º-A, n.º 11 e 14 |
| **Registo** | B1, B4, B11, B12, B17 |

### 3. Referência · 0:45 a 1:00

| | |
| --- | --- |
| **Critério e peso** | Impacto e relevância (30%), 15 s |
| **Título** | Guimarães recolhe menos de metade do que a França recolheria |
| **Visual** | Barras horizontais: Guimarães 1,9 · Catalunha 2,7 · França 4,27 · UE 4,4 (kg/hab/ano). Tracejado "à nossa escala: ≈ 670 t" |
| **Número** | 1,9 kg contra 4,27 kg por habitante |
| **Nota do orador** | "É uma referência, não uma meta." Menciona Sintra a retirar contentores. |
| **Rodapé** | Vitrus e INE, 2025; Refashion, 2024; ARC, 2024; AEA, 2020 |
| **Registo** | A2, C1, C8, C11, C14, C21 |

### 4. Demo · 1:00 a 3:00

| | |
| --- | --- |
| **Critério e peso** | Os quatro, 120 s: viabilidade 40 s, impacto 40 s, inovação 40 s (ver [roteiro](narrativa-do-pitch.md#roteiro-da-demo)) |
| **Título** | Do orçamento ao relatório, em dois minutos |
| **Visual** | Captura do simulador com cenários A e B lado a lado; o resto é a app ao vivo |
| **Número** | O do cenário B (€/t e toneladas), "estimativa" |
| **Nota do orador** | Seguir o [roteiro da demo](narrativa-do-pitch.md#roteiro-da-demo). Um jurado faz a pergunta "E se...?". O QR é lido no telemóvel do jurado. |
| **Rodapé** | Cenários calculados pelo Novelo; pressupostos em "Pressupostos" |
| **Plano B** | Vídeo de 60 s e PDF RAP pré-gerado, num ficheiro local |

### 5. IA · 3:00 a 3:30

| | |
| --- | --- |
| **Critério e peso** | Viabilidade técnica (25%), 30 s |
| **Título** | A IA conduz o otimizador; nunca faz contas |
| **Visual** | Diagrama em 4 passos: pergunta em português → alteração estruturada → otimizador → verificador de números |
| **Número** | Zero números calculados pelo modelo |
| **Nota do orador** | Responde às perguntas que o júri vai fazer: "e se a IA se engana?" e "e se a IA falha?". Dizer: sem IA, o simulador e o relatório continuam a funcionar |
| **Rodapé** | Verificador: todo o número da resposta tem de existir no resultado calculado |
| **Registo** | — |

### 6. Indústria · 3:30 a 3:55

| | |
| --- | --- |
| **Critério e peso** | Inovação e originalidade (25%), 25 s |
| **Título** | A indústria tem capacidade; faltam lotes limpos |
| **Visual** | Lote com QR e composição ao lado do passaporte; ao lado, "Sasia ≈ 2 000 t/mês, pré-consumo" |
| **Número** | 2 000 t por mês, sobretudo pré-consumo (C16). A comparação com o têxtil por desviar de Guimarães (9,7%, C17) só com "estimativa" |
| **Nota do orador** | "A foto não vê a fibra; a etiqueta sim. O operador confirma." "A qualidade depende de quem recolhe: em 2025, 72,9% reutilizado na Ultriplo, 9,2% no têxtil recolhido pela Vitrus. Por isso medimos toneladas reutilizáveis." Dizer a exatidão medida se existir (D4). |
| **Rodapé** | Público/Lusa, dez 2024; Vitrus, destinos de 2025; avaliação da triagem do Novelo |
| **Registo** | C16, C17, D3, D4, A19, H1 |

### 7. 2028 · 3:55 a 4:20

| | |
| --- | --- |
| **Critério e peso** | Impacto e relevância (30%), 25 s |
| **Título** | A lei põe a câmara na mesa onde se fixa o custo; o Novelo leva o número |
| **Visual** | Captura do relatório RAP: custo por tipo de território (predominantemente urbana, mediamente urbana, predominantemente rural) |
| **Número** | "economicamente eficiente" (artigo 22.º-A, n.º 12) e "As autoridades locais" (n.º 7, d)) |
| **Nota do orador** | O custo eficiente é determinado "entre os intervenientes relevantes", e a lei nomeia as autoridades locais; a entidade gestora não pode recusar o município (artigo 22.º-C, n.º 10). As peças antigas continuam a pesar na câmara durante anos: mais uma razão para medir o custo. Menciona a economia social como parceira. Se houver tempo: a rede não fica só onde é barato (art. 22.º-C, n.º 9, b)); fora das freguesias urbanas o cenário serve 60,2% da população, contra 73,9% nas urbanas (estimativa, separador Cobertura). |
| **Rodapé** | Diretiva (UE) 2025/1892, artigo 22.º-A, n.º 7, 11 e 12; artigo 22.º-C, n.º 9, b) e n.º 10 |
| **Registo** | B6, B8, B10, B17, B18, H4 |

### 8. Pedido · 4:20 a 5:00

| | |
| --- | --- |
| **Critério e peso** | Apresentação e potencial de continuidade (20%), 40 s |
| **Título** | Peço um piloto de três meses em duas freguesias |
| **Visual** | As duas freguesias recomendadas no mapa, três KPIs (toneladas, €/t, taxa de rejeito) e uma linha do tempo: 26 a 28 out feedback · 48 h plano · 3 meses piloto · depois dados medidos |
| **Número** | A frase-âncora: "445,8 toneladas por ano a 102,8 € por tonelada; o tratamento evitado (47 093 €) paga a operação". Piloto: Aldão e Arosa e Castelões, piso de 1,71 t em 3 meses, previsão de 2,43 t |
| **Nota do orador** | Frase-âncora, pedido, replicabilidade ("outro município precisa dos seus dados", ainda não testado) e roadmap pós-26 out (proposta nossa). Parceiros só como "em conversa" se já falámos. Agradece e para. |
| **Rodapé** | Cenário de 60 000 €/ano, estimativa a validar no piloto (registo H3, H10, H13) |
| **Registo** | H3, H10, H13 |

### 9. Slide de apoio: checklist critério e prova

Fora dos cinco minutos. Cola-se no fim do deck e abre-se nas perguntas ou se sobrar tempo.

| | |
| --- | --- |
| **Título** | Os quatro critérios, cada um com a sua prova |
| **Visual** | A tabela abaixo, quatro linhas, um visto por prova mostrada |
| **Nota do orador** | Só para o Q&A: "Se quiserem ver a prova de um critério, abrimos agora." |
| **Rodapé** | Pesos: Hack4Guimarães 2035, FAQ de avaliação, 2026 |

| Critério (peso) | Prova mostrada | Onde |
| --- | --- | --- |
| **Inovação e originalidade (25%)** | A IA conduz o otimizador e o verificador recusa números inventados; do saco ao fio num lote com QR | "E se...?" (passo 6) e lote (passo 8) |
| **Viabilidade técnica (25%)** | Dados reais da Vitrus; custos como pressupostos à vista com intervalo; produção e plano B | Ponto de partida (passo 1) e sensibilidade (passo 5) |
| **Impacto e relevância (30%)** | 445,8 t por ano a 102,8 €/t, com 47 093 € de tratamento evitado (estimativa); quem paga hoje e em 2028 | Cenário A contra B (passo 3) e relatório RAP (passo 10) |
| **Apresentação e potencial de continuidade (20%)** | Pedido do piloto de 3 meses com KPIs; replicabilidade; roadmap pós-26 out | Slide 8 |

## Checklist final do deck

- [ ] Cada número do deck tem linha no [registo](../pesquisa/registo-de-afirmacoes.md) com estado Dado Vitrus, Primária, Secundária ou Cálculo.
- [ ] Nenhum número "Por verificar" aparece (4 de 27, 228 €, 304 €, Humana 2025, Catalunha 75 €). O 5,86% só com a fonte (APA, RARU 2025, indicado pela Vitrus; A10). Nenhum slide diz "0 km novos", "sem viaturas novas" ou "saco no camião do porta a porta" (A21, A22).
- [ ] Frase-âncora com 445,8 t e 102,8 €/t (cenário de 60 000 €/ano, modelo de 22 de outubro) igual em slide, demo e vídeo.
- [ ] Rodapés de fonte em todos os slides.
- [ ] Vídeo de 60 s e PDF RAP guardados fora da rede.
- [ ] Os passos "em construção" só aparecem na demo se ensaiados a 25 de outubro.
- [ ] Cada critério tem uma frase dita e uma prova aberta ([frases](narrativa-do-pitch.md#a-frase-e-a-prova-de-cada-critério)); o slide de apoio 9 está no fim do deck.
- [ ] O texto das Regras foi lido e a repartição do tempo foi revista (ou está registado que ainda não o temos).
- [ ] Três ensaios cronometrados e dentro de 5 minutos.
