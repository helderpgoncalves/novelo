---
name: novelo-context
description: Contexto do projeto Novelo (problema, números reais da Vitrus, glossário, decisões). Ler antes de qualquer tarefa de produto, dados, modelo ou UI para não inventar valores.
---

# Contexto do Novelo

## O problema
Guimarães: 156 830 habitantes (soma das freguesias, INE), 48 freguesias dispersas. Têxtil = 5,4% do RSU (APA, valor indicado pela Vitrus). Recolha seletiva obrigatória desde 2025; RAP têxtil (produtor-pagador) até 17 abr 2028 (Diretiva 2025/1892). Pergunta da Vitrus: como garantir têxtil reutilizável e reciclável com o menor investimento e custo de operação?

## Números reais (dados da Vitrus, 2025): usar sempre estes
- Recolhido: **301,27 t** (H Sarah Trading 118,6 · Ultriplo 134,1 · Nova Etapa 42,9 · Vitrus 5,6) = **0,160 kg/hab/mês** (1,92 kg/hab/ano). Recolhido à parte, fora do RSU.
- RSU recolhido pela Vitrus em 2025: **43 051 t** (Vitrus, 21 out 2026). Têxtil no RSU: **5,4%** (APA, indicado pela Vitrus).
- Têxtil que ainda vai para o lixo (por desviar): 43 051 × 0,054 = **2 324,8 t/ano** = **1,235 kg/hab/mês** (14,82 kg/hab/ano). Estimativa. É a procura do modelo.
- Têxtil gerado: 2 324,8 + 301,3 = **2 626,0 t/ano**; captura atual **11,5%** (301,27 / 2 626,02). Estimativa.
- Base antiga (0,7 kg/hab/mês, 1 317 t, 22,9%, Plano de Ação Integrado/URBACT) **já não se usa**: a Vitrus não conhece esse plano.
- Destino: reutilização **59,4%** (178,99 t), reciclagem **26,5%** (79,93 t), rejeito **14,1%** (42,34 t).
- Rejeito por entidade: Ultriplo 14,5% · Sarah 13,0% · Nova Etapa 10,0% · Vitrus 56,9% (amostra de 5,6 t, baseada em percentagens).
- Qualidade: Sarah e Ultriplo têm kg exatos; Nova Etapa e Vitrus usam percentagens de relatórios aplicadas ao total (marcar como estimativa).
- Circuitos: 40 (19 PAP, 6 Moloks, 5 contentores, restantes serviços), 29 viaturas, 9 circuitos sem viatura, 2 viaturas nunca atribuídas (reserva), 82 localidades (71 geocodificadas).
- RSU nacional: 517 kg/hab/ano; têxteis 4,55% (+ 9,1% têxteis sanitários, que NÃO entram na recolha de têxteis).
- **Não há contentores de têxtil** e a Vitrus não os quer (21 out 2026): o têxtil de contentor vem contaminado e perde a reutilização. A rede proposta é **sem contentores**: local existente sem contentor novo (`existing`) + recolha a pedido nos circuitos (`on_demand`).
- O inventário **municipal** de 20 out (indiferenciado, orgânico, seletivo: 2 751 contentores, 2 026 locais, CAOP 2019) é a base geográfica: onde o têxtil se perde no lixo e onde a viatura já passa (`docs/dados/analise-contentores-municipais.md`).
- Reciclagem é mais cara que fibra virgem (Vitrus): o valor está na **reutilização** (têxtil limpo e seco). Custos unitários: pedidos ao financeiro da Vitrus; até lá, pressupostos.

## Glossário
RAP: responsabilidade alargada do produtor. PAP: porta a porta. Moloks: contentores enterrados/semienterrados. PAYT: pay-as-you-throw. RU/RSU: resíduos (sólidos) urbanos. Vitrus: empresa municipal de resíduos. TIPAU: tipologia de áreas urbanas (INE). Modo de recolha: `existing` (local existente, sem contentor novo), `on_demand` (a pedido, nos circuitos), `street` (contentor de rua: só referência, ex.: benchmark francês; nunca por omissão).

## Decisões fixas
Web React+Vite SPA (sem SSR), tabelas sempre com `DataTable`; um só domínio `novelo.helder.si` com `/api` por nginx; Postgres; LLM via OpenRouter; contrato OpenAPI→hey-api; otimização OR-Tools (MIP + VRP); marca em `docs/marca/guia-de-marca.md`.

## Nunca cortar
Comparação de cenários, "E se...?", relatório RAP. Ordem de corte: copiloto, evidência por marca, animação do Sankey, bolsa de fibra (desceu na prioridade: a reciclagem custa mais que a fibra virgem). A triagem por foto é controlo de qualidade na entrega.
