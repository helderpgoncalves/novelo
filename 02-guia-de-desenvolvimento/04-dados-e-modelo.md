# Dados e modelo

O modelo tem três passos: quanto têxtil há em cada zona, quanto custa cada forma de o recolher, e que combinação dá o menor custo para a meta escolhida. Cada número que entra tem fonte ou está marcado como pressuposto.

## Fontes de dados

| Dado | Fonte | Uso |
| --- | --- | --- |
| População por subsecção | INE, Censos 2021 (BGRI) | Procura por zona |
| Limites de freguesia | CAOP, Direção-Geral do Território | Agregar e mostrar no mapa |
| Estradas e locais candidatos (escolas, supermercados, juntas) | OpenStreetMap, extrato de Portugal | Rotas e pontos de recolha em locais existentes |
| Contentores atuais e caracterização do lixo | Vitrus Ambiente (disponibilizados no desafio) | Rede de partida e calibração por zona |
| Têxtil no indiferenciado: 5,4%; 0,7 kg/hab/mês | Plano de Ação para a Circularidade Têxtil de Guimarães | Valor base da procura |
| Custos unitários (recolha, km, contentor) | Vitrus Ambiente (a pedir no dia 1) | Modelo de custos |

## 1. Procura por zona

Têxtil gerado na zona *z* por ano, a partir da população e do valor por habitante do plano municipal:

```latex
D_z = P_z \cdot q \cdot 12 \qquad q = 0{,}7\ \text{kg por habitante por mês}
```

Com os 156 277 habitantes do concelho, isto dá cerca de 1.300 t/ano. Onde a caracterização da Vitrus mostrar mais têxtil (rotas com microconfeções), *q* sobe nessa zona.

Têxtil captado depende do modo de recolha *m* que serve a zona:

```latex
C_z = D_z \cdot c_m
```

A taxa de captura *c* por modo não tem fonte local. Na demo usamos três níveis (baixo, médio, alto), visíveis no ecrã, até termos dados do piloto.

## 2. Modelo de custos

```latex
\text{custo anual} = \frac{\text{investimento}}{N} + \text{recolhas} \cdot c_{\text{recolha}} + \text{km} \cdot c_{\text{km}}
```

```latex
\text{EUR/t} = \frac{\text{custo anual}}{\sum_z C_z}
```

*N* = anos de vida do equipamento. Pontos em locais existentes têm investimento perto de zero; contentores de rua têm investimento e recolha; recolha a pedido não tem investimento mas tem km.

## 3. Otimização

1. **Localização e modo (MIP, OR-Tools):** escolher que pontos candidatos abrir e que modo serve cada zona, para **maximizar toneladas captadas com o orçamento dado** ou **minimizar custo para uma meta de captura**. Uma zona só conta como servida se tiver um ponto dentro da distância a pé definida para esse modo.
2. **Rotas (VRP, OR-Tools):** com os pontos abertos, calcular rotas por veículo com capacidade e frequência de recolha, usando a matriz de distâncias do OSRM.
3. **KPIs:** investimento, custo anual, toneladas, €/t, % de população coberta.

## 4. Lotes, fluxos e calibração

Os lotes são o lado real do modelo: o que foi mesmo recolhido, triado e entregue.

| Entidade | Campos principais |
| --- | --- |
| Peça triada | estado, composição, marca (se visível), peso estimado, ponto, data |
| Lote | código, ponto, freguesia, fibra dominante, estado, peso total, histórico |
| Evento do lote | tipo (recolhido, triado, reservado, entregue), data, quem |
| Reserva | lote, reciclador, data |

**Peso no MVP:** cada peça recebe o peso médio do seu tipo (camisola, calças, lençol...), que é um pressuposto marcado como tal. No piloto passa a vir de uma balança no ponto.

**Fluxos (Sankey):** soma de toneladas por freguesia → modo → estado → destino, a partir do cenário (previsto) ou dos lotes (observado).

**Calibração das taxas de captura** pelo copiloto: cada semana, a taxa de cada modo aproxima-se do que foi observado, com um peso que cresce com as semanas de dados.

```latex
c_m^{\text{nova}} = \frac{k \cdot c_m^{\text{pressuposto}} + s \cdot c_m^{\text{observada}}}{k + s}
```

*s* = semanas com dados; *k* = peso dado ao pressuposto (ex.: 4 semanas). Ao fim de um mês, observado e pressuposto pesam o mesmo.

**Tipologia de território** para o relatório RAP: Tipologia de Áreas Urbanas do INE (predominantemente urbanas, medianamente urbanas, predominantemente rurais), cruzada com as freguesias.

## Pressupostos

| Parâmetro | Valor | Estado |
| --- | --- | --- |
| Têxtil por habitante (*q*) | 0,7 kg/hab/mês | Fonte: plano municipal |
| Habitantes | 156 277 | Fonte: plano municipal |
| Taxa de captura por modo (*c*) | baixo / médio / alto | Pressuposto, a calibrar no piloto |
| Distância máxima a pé por modo | a definir | Pressuposto, validar com o mentor |
| Custo por recolha e por km | a pedir | Vitrus, dia 1 |
| Custo de um contentor de rua | a pedir | Vitrus, dia 1 |
| Vida útil do equipamento (*N*) | a pedir | Vitrus, dia 1 |

Regra: nenhum valor entra no `params.yaml` sem uma linha nesta tabela.
