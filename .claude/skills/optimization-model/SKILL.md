---
name: optimization-model
description: Procura de têxtil, modelo de custos, otimização de localização (MIP) e rotas (VRP com OR-Tools) do Novelo. Usar ao implementar ou alterar o otimizador, KPIs ou cenários.
---

# Modelo e otimização

Fonte das fórmulas: `docs/engenharia/dados-e-modelo.md`. Código em `apps/api/src/novelo/domain/` (funções puras).

- **Procura:** `D_z = P_z · q · 12` (q = 0,7 kg/hab/mês). **Captado:** `C_z = D_z · c_m`.
- **Calibração com dados reais:** a captura atual é 22,9% (301,27 t / 1 317,4 t). A taxa por modo (`c_m`) nunca excede o que os dados suportam sem pressuposto escrito; níveis baixo/médio/alto visíveis no ecrã.
- **Custo:** `capex/N + recolhas·c_recolha + km·c_km`; `€/t = custo anual / toneladas`. Custos unitários pedem-se à Vitrus: até chegarem, ficam em `params.yaml` marcados "pressuposto" com fonte.
- **MIP (localização + modo):** maximizar toneladas com orçamento ou minimizar custo para uma meta. Zona servida só com ponto dentro da distância a pé do modo.
- **Recolha a pedido:** custo marginal calculado sobre os circuitos reais (`data/processed/circuits.csv`): se a localidade já tem circuito, km extra ≈ 0.
- **VRP:** hoje a matriz usa distâncias em linha reta (haversine) com fator de desvio 1,3; o OSRM ainda não está integrado (`OSRM_URL` existe mas não é usado). Limite de tempo `SOLVER_TIME_LIMIT_S`, sementes fixas, resultado em cache pela hash dos parâmetros.
- **Testes:** fixture pequeno (3 freguesias, 6 candidatos) com resultado fixo; fórmulas com valores à mão. Mesma entrada ⇒ mesmo cenário.
- **KPIs:** `capex_eur`, `opex_eur_year`, `tonnes_year`, `eur_per_tonne`, `coverage_pct`. Receita de reutilização/reciclagem usa a repartição 59,4/26,5/14,1 observada.
