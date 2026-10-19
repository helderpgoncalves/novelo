---
name: novelo-context
description: Contexto do projeto Novelo (problema, números reais da Vitrus, glossário, decisões). Ler antes de qualquer tarefa de produto, dados, modelo ou UI para não inventar valores.
---

# Contexto do Novelo

## O problema
Guimarães: 156 830 habitantes (soma das freguesias, INE), 48 freguesias dispersas. Têxtil ≈ 5,4% do indiferenciado. Recolha seletiva obrigatória desde 2025; RAP têxtil (produtor-pagador) até 17 abr 2028 (Diretiva 2025/1892). Pergunta da Vitrus: como garantir têxtil reutilizável e reciclável com o menor investimento e custo de operação?

## Números reais (dados da Vitrus, 2025): usar sempre estes
- Recolhido: **301,27 t** (H Sarah Trading 118,6 · Ultriplo 134,1 · Nova Etapa 42,9 · Vitrus 5,6) = **0,161 kg/hab/mês**.
- Potencial: 0,7 kg/hab/mês × 156 830 × 12 = **1 317 t**. Captura atual ≈ **22,9%**; por captar ≈ **1 016 t**.
- Destino: reutilização **59,4%** (178,99 t), reciclagem **26,5%** (79,93 t), rejeito **14,1%** (42,34 t).
- Rejeito por entidade: Ultriplo 14,5% · Sarah 13,0% · Nova Etapa 10,0% · Vitrus 56,9% (amostra de 5,6 t, baseada em percentagens).
- Qualidade: Sarah e Ultriplo têm kg exatos; Nova Etapa e Vitrus usam percentagens de relatórios aplicadas ao total (marcar como estimativa).
- Circuitos: 40 (19 PAP, 6 Moloks, 5 contentores, restantes serviços), 29 viaturas, 9 circuitos sem viatura, 2 viaturas nunca atribuídas (reserva), 82 localidades (71 geocodificadas).
- RSU nacional: 517 kg/hab/ano; têxteis 4,55% (+ 9,1% têxteis sanitários, que NÃO entram na recolha de têxteis).
- Contentores têxteis (localizações): chegam a 20 out 2026.

## Glossário
RAP: responsabilidade alargada do produtor. PAP: porta a porta. Moloks: contentores enterrados/semienterrados. PAYT: pay-as-you-throw. RU/RSU: resíduos (sólidos) urbanos. Vitrus: empresa municipal de resíduos. TIPAU: tipologia de áreas urbanas (INE). Modo de recolha: `existing` (local existente), `street` (contentor de rua), `on_demand` (a pedido).

## Decisões fixas
Web React+Vite SPA (sem SSR), tabelas sempre com `DataTable`; um só domínio `novelo.bitsapiens.io` com `/api` por nginx; Postgres; LLM via OpenRouter; contrato OpenAPI→hey-api; otimização OR-Tools (MIP + VRP); marca em `docs/marca/guia-de-marca.md`.

## Nunca cortar
Comparação de cenários, "E se...?", relatório RAP. Ordem de corte: copiloto, evidência por marca, animação do Sankey, bolsa de fibra.
