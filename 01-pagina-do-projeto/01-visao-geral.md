# Novelo

![Novelo: recolha seletiva de têxteis, desenhada ao menor custo](img/banner.png)

*Hack4Guimarães 2035 · 19 de outubro de 2026 · Hélder Gonçalves e Flávio Fernandes*

**Recolha seletiva de têxteis, desenhada ao menor custo.** Proposta para o Desafio 5 (TexVitrus) do Hack4Guimarães 2035.

## O problema

Em Guimarães, 5,4% do lixo indiferenciado é têxtil, acima da média europeia (4,7%) e nacional (cerca de 4%). São entre 1.300 e 2.650 toneladas por ano que vão para aterro ou incineração sem serem separadas (estimativa nossa a partir dos dados do município).

- **A obrigação já existe.** A recolha seletiva de têxteis é exigida desde 1 de janeiro de 2025, e o município fixou a meta de aumentar a recolha seletiva em 30%.
- **A conta muda em 2028.** A Diretiva (UE) 2025/1892 obriga cada Estado-Membro a ter, até 17 de abril de 2028, um regime em que os produtores pagam a recolha, triagem, preparação para reutilização e reciclagem.
- **O território torna-o caro.** Guimarães tem 156 277 habitantes em 55 freguesias com ocupação dispersa. O porta a porta pode não compensar, e colocar contentores ao acaso também não.
- **Ninguém tem os dados.** A triagem é manual, as microempresas têxteis deitam retalhos no lixo urbano sem registo, e só 4 dos 27 operadores licenciados na zona reciclam ou valorizam têxteis.

A pergunta da Vitrus Ambiente é simples: como garantir têxtil reutilizável e reciclável com o menor investimento e o menor custo de operação?

## A solução

O Novelo acompanha o têxtil **do saco ao fio**: planeia a rede de recolha ao menor custo, deixa o decisor testar ideias em português, segue cada lote até à indústria e entrega à câmara o dossiê de que vai precisar em 2028.

| Feature | O que faz | O que ninguém tem |
| --- | --- | --- |
| **Simulador da rede** | Estima o têxtil por zona e escolhe onde pôr pontos, que modo usar e que rotas fazer | Cenários com investimento, custo anual, toneladas e €/t lado a lado |
| **"E se...?"** | O decisor pergunta em português ("e se passarmos Serzedelo a recolha a pedido?") e o otimizador responde com um cenário novo | A IA conduz um modelo matemático; todos os números são verificados, nenhum é inventado |
| **Triagem e lote com passaporte** | Uma foto da peça e da etiqueta dá estado, composição e marca; a peça entra num lote com QR | Rastreabilidade de cada saco, alinhada com o futuro Passaporte Digital do Produto |
| **Bolsa de fibra** | Lotes agregados por fibra ("algodão 100%, 320 kg") visíveis para os recicladores do Vale do Ave | Liga a recolha municipal à indústria têxtil local |
| **Fluxo do saco ao fio** | Um Sankey mostra as toneladas de cada freguesia até ao destino final | Onde se perde valor, num relance |
| **Relatório RAP num clique** | PDF com custo por tonelada por tipo de território, toneladas por fibra e marcas mais encontradas | A resposta a "quem paga isto?" com dados do próprio concelho |

**Três modos de recolha, combinados por zona.** A poupança está em não usar o mesmo modo em todo o lado:

1. **Pontos em locais existentes** (juntas, escolas, supermercados, ecocentros): investimento quase nulo.
2. **Contentores de rua**: só onde a densidade justifica.
3. **Recolha a pedido**: nas zonas dispersas, aproveitando rotas que já lá passam.

## Como funciona

![Dos dados abertos a cenários com preço; o terreno corrige o modelo](img/diagrama-como-funciona.png)

Cada entrega triada no terreno devolve dados reais de quantidade e qualidade, e o modelo fica mais certo a cada ciclo.

## Impacto e porquê agora

O Novelo transforma uma obrigação legal num plano com preço. É útil já para a câmara e, a partir de 2028, para quem vai pagar a recolha.

| Para quem | O que resolve |
| --- | --- |
| **Vitrus Ambiente / Câmara de Guimarães** | Cumprir a meta de recolha seletiva sem investir às cegas; menos têxtil no indiferenciado, que tem custo de tratamento e enrola nas máquinas |
| **Futuras entidades gestoras da RAP têxtil** | Saber quanto custa recolher por tonelada em cada tipo de território, para negociar com os municípios |
| **Indústria e operadores do Vale do Ave** | Fluxos de material triado por tipo de fibra, num território onde só 4 de 27 operadores licenciados fazem valorização |
| **Outros municípios** | O mesmo modelo, com os dados abertos de cada concelho: todos têm a mesma obrigação |

**Porquê agora:** a recolha seletiva já é obrigatória, Guimarães é Capital Verde Europeia em 2026 e tem um plano de ação para a circularidade têxtil que pede exatamente rotas, tipos de contentor e frequências.

## Depois do hackathon

1. **Piloto com a Vitrus (3 meses):** uma ou duas freguesias, um modo de recolha de cada tipo, balança nos pontos, medir toneladas e custo real contra o previsto.
2. **Copiloto de operações:** um agente que todas as semanas recalibra o modelo com os lotes reais, volta a otimizar e propõe alterações, sempre com aprovação humana.
3. **Escala:** levar o modelo a outros municípios e às entidades gestoras da RAP, com os dados abertos de cada concelho.

Em aberto: custos unitários reais da Vitrus e quem opera hoje os contentores têxteis. São as primeiras perguntas ao mentor.

## Fontes

- [Plano de Ação Integrado para a Circularidade Têxtil de Guimarães](https://urbact.eu/sites/default/files/2026-01/Guimaraes_IAP_PT.pdf), Município de Guimarães / URBACT, nov. 2025
- [Diretiva 2025/1892 que altera a Diretiva-Quadro dos Resíduos](https://www.vda.pt/pt/publicacoes/insights/diretiva-20251892-que-altera-a-diretiva-quadro-dos-residuos-diretiva-200898ce/28063/), VdA, out. 2025
- [Resumo oficial do ato final, Diretiva (UE) 2025/1892](https://oeil.europarl.europa.eu/oeil/en/procedure-document-summary/pdf?id=1845495), Parlamento Europeu
- [EU Parliament mandates EPR for textiles](https://www.ami.international/insights/eu-parliament-mandates-extended-producer-responsibility-epr-for-textiles), AMI, set. 2025
- Desafio 5 TexVitrus, slide oficial do Hack4Guimarães 2035
