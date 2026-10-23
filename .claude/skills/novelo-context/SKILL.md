---
name: novelo-context
description: Contexto do projeto Novelo (problema, números reais da Vitrus, glossário, decisões). Ler antes de qualquer tarefa de produto, dados, modelo ou UI para não inventar valores.
---

# Contexto do Novelo

## O problema
Guimarães: 156 830 habitantes (soma das freguesias, INE), 48 freguesias dispersas. Têxtil = 5,86% do indiferenciado (APA, RARU 2025, p. 24; base indicada pela Vitrus a 22 out 2026). Recolha seletiva obrigatória desde 2025; RAP têxtil (produtor-pagador) até 17 abr 2028 (Diretiva 2025/1892). Pergunta da Vitrus: como garantir têxtil reutilizável e reciclável com o menor investimento e custo de operação?

## Números reais (dados da Vitrus, 2025): usar sempre estes
- Recolhido: **301,27 t** (H Sarah Trading 118,6 · Ultriplo 134,1 · Nova Etapa 42,9 · Vitrus 5,6) = **0,160 kg/hab/mês** (1,92 kg/hab/ano). Recolhido à parte, fora do RSU.
- Indiferenciado recolhido pela Vitrus em 2025: **43 050,5 t**, que são **84,0%** do indiferenciado do concelho (Vitrus, Relatório e Contas 2025, p. 8). Concelho todo: 43 050,5 ÷ 0,840 ≈ **51 250,6 t**. Têxtil no indiferenciado: **5,86%** (APA, RARU 2025, p. 24). Base indicada pela Vitrus a 22 out 2026.
- Têxtil que ainda vai para o lixo (por desviar): 51 250,6 × 0,0586 ≈ **3 003,3 t/ano** = **1,596 kg/hab/mês** (19,15 kg/hab/ano). Estimativa. É a procura do modelo.
- Têxtil gerado: 3 003,3 + 301,3 ≈ **3 304,6 t/ano**; captura atual **≈ 9,1%** (301,27 / 3 304,55): cerca de 9 em cada 10 kg vão para o lixo. Estimativa.
- Tratamento do indiferenciado em aterro: **105,64 €/t** = 40 €/t de taxa de gestão de resíduos (TGR) + 65,64 €/t de tarifa da Resinorte (Vitrus, 22 out 2026). Cada tonelada desviada do lixo poupa isto: é custo evitado, não receita.
- Bases antigas **que já não se usam**: 0,7 kg/hab/mês, 1 317 t, 22,9% (Plano de Ação Integrado/URBACT, que a Vitrus não conhece); 43 051 t × 5,4% = 2 324,8 t, 1,235 kg/hab/mês, 11,5% (21 out, substituída a 22 out).
- Destino: reutilização **59,4%** (178,99 t), reciclagem **26,5%** (79,93 t), rejeito **14,1%** (42,34 t).
- Rejeito por entidade: Ultriplo 14,5% · Sarah 13,0% · Nova Etapa 10,0% · Vitrus 56,9% (amostra de 5,6 t, baseada em percentagens).
- Qualidade: Sarah e Ultriplo têm kg exatos; Nova Etapa e Vitrus usam percentagens de relatórios aplicadas ao total (marcar como estimativa).
- Circuitos: 40 (19 PAP, 6 Moloks, 5 contentores, restantes serviços), 29 viaturas, 82 localidades (71 geocodificadas). A folha de turnos tem um erro: as viaturas **estão ocupadas à tarde** e os circuitos PAP "sem viatura" também têm viatura (Vitrus, 22 out 2026). **Não há viaturas livres**: o antigo "plano B" das 15 viaturas paradas à tarde é falso.
- **O saco de têxtil não pode ir no compactador do porta a porta** (vai para a caixa de compactação e estraga-se; cabine, gancho ou caixa lateral também não servem) e **um compactador não pode fazer uma volta só de têxtil** (contaminação). A saída indicada pela Vitrus é a "aquisição de um meio novo de recolha" (22 out 2026).
- Depósito: **Estaleiro Operacional da Rua das Lameiras, Polvoreira** (Vitrus, 22 out 2026).
- Custos horários e por km das viaturas: o financeiro da Vitrus ainda não os enviou (22 out 2026). Sazonalidade: os kg mensais só se partilham com o município.
- **Rotas por estrada (23 out 2026):** os km e o traçado das rotas vêm de um OSRM próprio sobre o OpenStreetMap (perfil de furgoneta de 2,8×2,1×6 m e 3,5 t, pressuposto), sem custos; só há estimativa (linha reta × desvio 1,3) como fallback, e a volta porta a porta dentro da freguesia é sempre fórmula. Calibração: desvio mediano 1,37 a 1,48, condução ~40 km/h contra os 30 km/h de recolha do modelo (`docs/engenharia/rotas-reais.md`). Nunca dizer «linha reta × 1,3» como método das rotas.
- RSU nacional: 517 kg/hab/ano; têxteis 4,55% (+ 9,1% têxteis sanitários, que NÃO entram na recolha de têxteis).
- **Não há contentores de têxtil** e a Vitrus não os quer (21 out 2026): o têxtil de contentor vem contaminado e perde a reutilização. A rede proposta é **sem contentores** e servida por **uma viatura de têxtil nova, sem compactação**: recolhe o saco fechado à porta num dia fixo por freguesia e para nos locais municipais existentes e nas escolas, sem contentor novo. O custo de tratamento evitado (105,64 €/t) cobre parte do custo de operação.
- O inventário **municipal** de 20 out (indiferenciado, orgânico, seletivo: 2 751 contentores, 2 026 locais, CAOP 2019) é a base geográfica: onde o têxtil se perde no lixo e onde há locais para paragem (`docs/dados/analise-contentores-municipais.md`).
- Reciclagem é mais cara que fibra virgem (Vitrus): o valor está na **reutilização** (têxtil limpo e seco). Custos unitários: pedidos ao financeiro da Vitrus; até lá, pressupostos.

## Glossário
RAP: responsabilidade alargada do produtor. PAP: porta a porta. Moloks: contentores enterrados/semienterrados. PAYT: pay-as-you-throw. RU/RSU: resíduos (sólidos) urbanos. Vitrus: empresa municipal de resíduos. TIPAU: tipologia de áreas urbanas (INE). Modo de recolha: `existing` (local existente, sem contentor novo), `on_demand` (saco à porta; desde 22 out pela viatura de têxtil nova, não pelo compactador), `street` (contentor de rua: só referência, ex.: benchmark francês; nunca por omissão).

## Decisões fixas
Web React+Vite SPA (sem SSR), tabelas sempre com `DataTable`; um só domínio `novelo.helder.si` com `/api` por nginx; Postgres; LLM via OpenRouter; contrato OpenAPI→hey-api; otimização OR-Tools (MIP + VRP); marca em `docs/marca/guia-de-marca.md`.

## Nunca cortar
Comparação de cenários, "E se...?", relatório RAP. Ordem de corte: copiloto, evidência por marca, animação do Sankey, bolsa de fibra (desceu na prioridade: a reciclagem custa mais que a fibra virgem). A triagem por foto é controlo de qualidade na entrega.
