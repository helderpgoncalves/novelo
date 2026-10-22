---
name: optimization-model
description: Procura de têxtil, modelo de custos, otimização de localização (MIP) e rotas (VRP com OR-Tools) do Novelo. Usar ao implementar ou alterar o otimizador, KPIs ou cenários.
---

# Modelo e otimização

Fonte das fórmulas: `docs/engenharia/dados-e-modelo.md`. Código em `apps/api/src/novelo/domain/` (funções puras).

- **Procura:** `D_z = P_z · q · 12` (q ≈ 1,596 kg/hab/mês = 43 050,5 t ÷ 0,840 × 5,86% APA / 156 830 hab. / 12: têxtil que ainda vai para o lixo; total ≈ 3 003,3 t; base de 22 out 2026). **Captado:** `C_z = D_z · c_m`.
- **Dados reais:** a captura atual é ≈ 9,1% (301,27 t / 3 304,6 t gerados; estimativa). Cada tonelada desviada evita 105,64 €/t de tratamento em aterro (Vitrus, 22 out). O saco não pode ir no compactador e não há viaturas livres (Vitrus, 22 out): a recolha é feita por uma viatura de têxtil nova, sem compactação, com partida do Estaleiro da Rua das Lameiras (Polvoreira). As 301 t são de terceiros, por isso não há contentor que as reproduza: a calibração antiga do modo `street` saiu e a taxa por modo (`c_m`) é pressuposto escrito, com níveis baixo/médio/alto visíveis no ecrã.
- **Modos:** por omissão só `existing` (local existente, sem contentor novo) e `on_demand` (saco à porta num dia fixo, recolhido pela viatura de têxtil nova; nunca no compactador). `street` fica no enum só como referência explícita (benchmark francês). A Vitrus não quer contentores de têxtil (contaminação).
- **Receita:** a reciclagem custa mais que a fibra virgem; não contar receita de reciclagem. O valor está na reutilização.
- **Custo:** `capex/N + recolhas·c_recolha + km·c_km`; `€/t = custo anual / toneladas`. Custos unitários pedem-se à Vitrus: até chegarem, ficam em `params.yaml` marcados "pressuposto" com fonte.
- **MIP (localização + modo):** maximizar toneladas com orçamento ou minimizar custo para uma meta. Zona servida só com ponto dentro da distância a pé do modo.
- **Recolha a pedido:** custo marginal calculado sobre os circuitos reais (`data/processed/circuits.csv`): se a localidade já tem circuito, km extra ≈ 0.
- **VRP:** hoje a matriz usa distâncias em linha reta (haversine) com fator de desvio 1,3; o OSRM ainda não está integrado (`OSRM_URL` existe mas não é usado). Limite de tempo `SOLVER_TIME_LIMIT_S`, sementes fixas, resultado em cache pela hash dos parâmetros.
- **Testes:** fixture pequeno (3 freguesias, 6 candidatos) com resultado fixo; fórmulas com valores à mão. Mesma entrada ⇒ mesmo cenário.
- **KPIs:** `capex_eur`, `opex_eur_year`, `tonnes_year`, `eur_per_tonne`, `coverage_pct`. Os fluxos usam a repartição 59,4/26,5/14,1 observada; só a reutilização conta como receita.
