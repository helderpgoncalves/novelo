# Features que nos distinguem

Cinco features, uma história: **do saco ao fio**. Planear a rede, decidir em linguagem natural, seguir cada saco até à indústria e entregar à câmara o dossiê de 2028. Cada feature usa a anterior, e todas cabem numa demo de dois minutos.

![Do saco ao fio: cada passo alimenta o seguinte](../img/diagrama-do-saco-ao-fio.png)

A linha tracejada à esquerda é o copiloto (feature 6): o que os lotes mostram no terreno volta a calibrar o plano.

## 1. "E se...?" sobre o otimizador

O decisor pergunta em português e recebe um cenário novo, calculado pelo otimizador, com a diferença explicada em números. A IA conduz o modelo matemático; nunca faz contas.

> **Pergunta:** "E se tirarmos os contentores de rua de Serzedelo e passarmos a recolha a pedido?"
>
> **Novelo:** "Entendi: em Serzedelo, retirar contentores de rua e usar recolha a pedido. Resultado: investimento −X €, custo anual −Y €, toneladas captadas −Z t, €/t passa de A para B. Fonte: cenário B2, gerado às 14:32."

**Como funciona, passo a passo:**

1. O modelo (via OpenRouter, ver [IA](ia.md)) recebe a pergunta, o cenário atual e as listas fechadas de freguesias, modos e parâmetros.
2. Devolve **só** uma alteração estruturada, `ScenarioDelta`, validada por Pydantic. Exemplo: `{"zones": ["Serzedelo"], "remove_modes": ["street"], "add_modes": ["on_demand"]}`.
3. O ecrã mostra "Entendi: ..." antes de correr, para o decisor confirmar ou corrigir.
4. O OR-Tools corre o cenário novo e devolve os KPIs em JSON.
5. O modelo escreve a explicação a partir desse JSON.
6. **Verificação automática:** todos os números da resposta têm de existir no JSON. Se algum não existir, a resposta é rejeitada e gerada de novo; à segunda falha, mostra-se só a tabela.

**Regras:**

- Pergunta ambígua ("e se pouparmos?") → o Novelo pergunta de volta em vez de adivinhar.
- Freguesia ou modo fora das listas → recusa explícita, com sugestões próximas.
- Cada resposta guarda pergunta, alteração, cenário e versão do prompt: tudo auditável.
- Um conjunto de perguntas de teste com alteração esperada protege cada mudança de prompt (`tests/api/test_whatif.py`).

## 2. Lote com passaporte e bolsa de fibra

Cada peça triada entra num lote; cada lote tem um QR e uma página pública; os lotes juntam-se por fibra numa bolsa que os recicladores do Vale do Ave consultam. A recolha deixa de acabar no camião e passa a acabar na fábrica.

**O lote**

| Campo | Origem |
| --- | --- |
| Código e QR | Gerado ao abrir o lote no ponto de recolha |
| Freguesia e ponto | Ponto onde a peça foi entregue |
| Composição (ex.: 100% algodão) | Lida da etiqueta na triagem |
| Estado (reutilizável, reciclável, rejeito) | Triagem por foto, confirmável pelo operador |
| Peso | Estimado por tipo de peça no MVP; balança no ponto no piloto |
| Histórico | Recolhido, triado, reservado, entregue, com data |

**O passaporte.** Ler o QR abre a página pública do lote: origem, composição, peso e histórico. Os campos seguem o que o Plano de Guimarães descreve para a primeira fase do Passaporte Digital do Produto dos têxteis (composição, reciclabilidade, rastreabilidade), prevista até 2027, para o Novelo encaixar quando a regra chegar.

**A bolsa de fibra.** Uma vista agregada para quem recicla: "algodão 100%, reciclável, 320 kg em 4 lotes, Azurém e Creixomil". O reciclador registado manifesta interesse e o lote fica reservado. Sem preços nem pagamentos no MVP: o valor está em tornar visível material que hoje vai para aterro.

**Porque importa:** o plano municipal aponta a falta de têxtil limpo e homogéneo como uma das razões para não haver mercado de matérias-primas secundárias. Lotes por fibra são exatamente isso.

## 3. Relatório RAP num clique

Um botão gera o PDF que a câmara vai precisar para negociar com as entidades gestoras da responsabilidade alargada do produtor, que cada Estado-Membro tem de criar até 17 de abril de 2028. Responde a "quem paga isto?" com números do próprio concelho.

| Secção do relatório | Conteúdo |
| --- | --- |
| Resumo | Toneladas captáveis, custo anual e €/t do cenário escolhido |
| Custo por tipo de território | €/t em áreas predominantemente urbanas, medianamente urbanas e predominantemente rurais (tipologia TIPAU do INE) |
| Material recolhido | Toneladas por fibra e por destino (reutilização, reciclagem, rejeito), a partir dos lotes |
| Cenários | Os cenários comparados, com investimento e custo de operação |
| Evidência por marca | As marcas mais encontradas e a sua composição (ver feature 5) |
| Método e fontes | Fórmulas, pressupostos e fontes de cada número, com a etiqueta "estimativa" onde se aplica |

Gerado a partir de um modelo HTML com a identidade Novelo e convertido para PDF no servidor (WeasyPrint). O ecrã "Relatório RAP" guarda o histórico e descarrega cada PDF. Cada relatório fica guardado com data e versão dos parâmetros, para se poder reproduzir.

## 4. Fluxo do saco ao fio

Um diagrama de fluxo (Sankey) com quatro colunas: **freguesia → modo de recolha → resultado da triagem → destino**. A espessura de cada fio é a quantidade em toneladas.

- Mostra num relance onde se perde valor: um modo com muito rejeito, uma freguesia que capta pouco.
- Liga-se a um cenário (fluxo previsto) ou aos lotes reais (fluxo observado), e os dois comparam-se lado a lado.
- **Na demo:** cada peça triada em palco engrossa um fio em direto. É o momento em que o júri vê o sistema inteiro a funcionar.

## 5. Quem polui, paga: evidência por marca

Na triagem, a foto da etiqueta dá também a marca, quando está visível. O Novelo agrega **quilos por marca e por composição** ao longo do tempo.

- A nova diretiva permite que os Estados-Membros cobrem taxas de RAP mais altas a quem vende moda rápida (ecomodulação). Com isto, o município passa a ter dados próprios para essa discussão, em vez de médias europeias.
- Só se guardam marca, composição e peso. As fotografias são apagadas depois de processadas e nunca há dados de quem entregou a peça.
- No relatório RAP, esta evidência aparece agregada e com o tamanho da amostra, para não tirar conclusões de poucos lotes.

## 6. Copiloto de operações (se houver tempo)

Um agente que corre todas as segundas-feiras e fecha o ciclo entre o plano e o terreno:

1. Lê os lotes da semana e compara toneladas reais com as previstas por ponto.
2. Recalibra as taxas de captura por modo (ver [Dados e modelo](dados-e-modelo.md)).
3. Volta a correr o otimizador e propõe alterações com a poupança esperada ("mover o ponto da Junta X para o supermercado Y: +0,4 t/mês").
4. Escreve um resumo para a Vitrus. **Nada é aplicado sem aprovação humana.**

No hackathon mostra-se uma execução, com dados simulados de uma semana. No pitch entra como o próximo passo natural.

## Estado de implementação

| Funcionalidade | Estado |
| --- | --- |
| Simulador, cenários e comparação, pressupostos com origem | Feito |
| "E se...?" com verificador de números | Feito (precisa de `OPENROUTER_API_KEY`) |
| Triagem por foto, lotes, QR, passaporte público, bolsa de fibra | Feito |
| Evidência por marca, relatório RAP em PDF com custo por TIPAU | Feito |
| Mapa da rede, circuitos, frota, localidades, qualidade dos dados | Feito |
| Camada dos contentores existentes no mapa | Falta: dados a chegar a 20 de outubro de 2026 |
| Copiloto de operações | Não iniciado (fica para depois) |

## O que fica de fora, de propósito

- **Sensores nos contentores:** custam por unidade e o desafio pede o menor investimento.
- **Blockchain no passaporte:** um registo com histórico na base de dados chega para rastrear lotes; não acrescenta nada que o júri valorize.
- **App do cidadão completa:** a recolha a pedido pode começar com um formulário simples; a app vem depois do piloto.

## Ordem de corte

Se o tempo apertar, corta-se por esta ordem: copiloto (6), evidência por marca (5), animação do Sankey (fica estático), bolsa de fibra (fica só o passaporte do lote). **Nunca se cortam:** a comparação de cenários, o "E se...?" e o relatório RAP.

**Fontes:** [Plano de Ação Integrado para a Circularidade Têxtil de Guimarães](https://urbact.eu/sites/default/files/2026-01/Guimaraes_IAP_PT.pdf) (passaporte digital, mercado de matérias-primas secundárias) · [Diretiva 2025/1892, VdA](https://www.vda.pt/pt/publicacoes/insights/diretiva-20251892-que-altera-a-diretiva-quadro-dos-residuos-diretiva-200898ce/28063/) (prazo da RAP) · [EU Parliament mandates EPR for textiles, AMI](https://www.ami.international/insights/eu-parliament-mandates-extended-producer-responsibility-epr-for-textiles) (taxas mais altas para moda rápida)
