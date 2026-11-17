# Backlog

O que está feito e o que falta, por frente. Atualiza-se no mesmo commit que muda a realidade. Estado a 17 de novembro de 2026.

## Feito

| Frente | Entregue |
| --- | --- |
| Infra | Monorepo, Docker Compose de desenvolvimento e produção para o Coolify (VPS, `novelo.helder.si`), `justfile`, `.env.example` completo |
| Contrato | OpenAPI exportado, cliente hey-api (SDK, Zod, React Query) e verificação com `just check-contract` |
| Dados | ETL dos Excel da Vitrus, INE (população e TIPAU), CAOP e OSM; seed idempotente no Postgres; alertas de qualidade |
| Rede municipal | Pacote QGIS de 20/10 (2 751 contentores de outras frações, 2 026 locais, CAOP 2019): ETL `municipal_containers.py`, API `/municipal`, ecrã com seis separadores, camadas no mapa, alertas `municipal_*`, exportação e ferramentas do copiloto |
| Autenticação | Magic link (principal), password, Google, confirmação de email, recuperar password, "manter sessão iniciada", entrada por QR com papel `guest` e limites, cartaz do QR, administração de utilizadores e convidados, 4 emails transacionais com pré-visualização |
| Planeamento | Otimizador (CP-SAT e VRP), três modos combináveis, cenários, comparação, pressupostos com origem, tornado e Monte Carlo, robustez, referência francesa, piloto com piso de sinal; simulador redesenhado |
| "E se...?" | `ScenarioDelta`, confirmação, explicação e verificador de números |
| Copiloto | SSE tipado, 52 ferramentas, threads, memória, anexos, `@menções`, artefactos, ações com confirmação e auditoria, página `/chat`, avaliação com 155 casos |
| Rotas por estrada | Desde 23 out 2026, km e traçado das rotas por estrada num OSRM próprio sobre o OpenStreetMap (sem custos), com fallback para estimativa, `source`/`routing` no contrato e calibração do desvio e da velocidade ([Rotas por estrada](rotas-reais.md)). O porta a porta dentro da freguesia continua a ser fórmula |
| Operação | Triagem por foto, lotes, QR, passaporte público, bolsa de fibra, evidência por marca |
| Relatório | PDF RAP com custo por tipo de território (WeasyPrint) e histórico |
| Web | Mapa, todos os ecrãs de dados, Frota refeita (calendário da semana tipo, `.ics`), pt/en, claro/escuro, PWA mobile-first com barra de separadores, páginas de erro, visita guiada, `DataTable` e `PageTabs` completos |
| Marca | Geometria única, `just brand` (SVG, PNG, favicon, ícones PWA, avatares, partilha, email) e `just check-brand` |
| Qualidade | 1 164 testes pytest, 449 Vitest e Playwright em 36 ficheiros (23 out 2026) |

## Falta

| Prioridade | Tarefa | Estado |
| --- | --- | --- |
| Alta | **Resposta ao feedback da Vitrus (nov 2026, [mapa wayfinder #30](https://github.com/helderpgoncalves/novelo/issues/30))**: âmbito decidido e documentado ([funcionalidades 8–13](features.md), [ADR](adr/README.md), [glossário](../../GLOSSARY.md)); a execução segue por esta ordem | Documentação feita; execução por fazer |
| Alta | Taxonomia de triagem para exportar roupa reutilizável: vocabulário fechado (estado fino, tipologia, estação, cor, género, tamanho), proveniência e confiança por atributo, rótulos dourados, eval por eixo (#36) | Por fazer |
| Alta | Lote pesado e etiquetado na viatura: um lote por paragem, QR por unidade física, offline; hardware Zebra ZQ511 + KERN IXC 10K-3M ≈ 1 300–1 600 € s/IVA (**estimativa**) (#34, #33; protótipo #50) | Por fazer |
| Alta | Recolha a pedido do cidadão (#37) e política de paragem no otimizador: escada de frequências por local, corte de 48 h, `collection_plan` com frequência por local (#42) | Por fazer |
| Média | Superfície do cidadão `/cidadao`: conta magic link, os meus sacos, QR de conta, saldo, histórico, «onde e quando entrego» (#38; protótipo #48) | Por fazer |
| Média | Pontos e parcerias: ganho por saco + bónus de conformidade, catálogo (IPSS + parceiros locais), resgate por código pseudónimo, gestor de parcerias; regulamento de pontos e minuta de patrocínio (#39, #47) | Por fazer |
| Média | Conta de local `/local`: assistidos (escolas) com aviso «sacos prontos» e produtor B2B (17 lares + 9 de hotelaria) (#40, #52; protótipo #51) | Por fazer |
| Média | Calibração/retroalimentação: quatro métricas operacionais, taxa de geração, tabela de agregados, painel «Calibração», fotografia no cenário (#53) | Por fazer |
| Média | RGPD da conta de doador: ADR fechado; falta a política de privacidade por finalidades com prazos, o DPA Vitrus↔plataforma, os consentimentos em duas camadas e espelhar na conta de local (#49, [ADR](adr/rgpd-conta-de-doador.md)) | Por fazer |
| Alta | Aplicar as respostas da Vitrus de 22/10: saco fora do compactador e viatura de têxtil nova, sem compactação (sai o "0 km novos" e o plano B das viaturas livres); procura = 51 250,6 t × 5,86% (≈ 3 003,3 t); tratamento evitado 105,64 €/t; depósito na Rua das Lameiras, Polvoreira; recalcular cenários, sensibilidade, cobertura e piloto, e preencher os números da narrativa | Em curso |
| Alta | Aplicar as respostas da Vitrus de 21/10 (base da procura substituída a 22/10): procura = 43 051 t × 5,4% (2 324,8 t por desviar), modos por omissão `existing` e `on_demand` (`street` só referência), sem calibração da rua, sem receita de reciclagem; recalcular cenários de referência, sensibilidade, teto francês e a tabela dos locais reais em [Dados e modelo](dados-e-modelo.md) | Em curso |
| Alta | Custos por hora e por quilómetro das viaturas da Vitrus para trocar os pressupostos por dados | Pedidos ao departamento financeiro a 21/10; ainda por chegar a 22/10 |
| Média | Substituir os códigos de zona provisórios `0308U1` a `0308U5` (a CAOP 2019 já traz os oficiais) | Por validar |
| Média | Confirmar o depósito real da Vitrus (hoje o centro de Guimarães) | Por pedir |
| Alta | Miniatura opcional por peça feita a 23 out 2026 (migração `0018`). Falta a entidade (Vitrus/município) validar base jurídica, texto do aviso, retenção e canal de pedidos de titulares ([lista](privacidade-fotografias.md#o-que-a-entidade-responsável-tem-de-decidir-ou-validar)) | Por validar |
| Média | Medir a exatidão da triagem (`just eval-triage` com 30 ou mais peças com verdade-terreno) | Por fazer |
| Média | Correr `just eval-copilot` com os 11 casos `muni_*` e atualizar a [avaliação](avaliacao-copiloto.md) | Por fazer |
| Média | Passar as restantes variáveis (`MAGIC_LINK_*`, `GUEST_*`, `COPILOT_*`, `EMAIL_TRANSPORT`...) pelo `docker-compose.yml` de produção, se for preciso alterá-las no Coolify | Por decidir |
| Média | Cenários A e B fixos, cinco perguntas "E se...?" de reserva, lote de demonstração | Por fazer |
| Média | Decidir se o `detour_factor` (agora só na estimativa de reserva, na volta porta a porta e na sensibilidade) sobe de 1,3 para ~1,4 a 1,5 (calibração OSRM de 23 out: mediana 1,37 a 1,48; [Rotas por estrada](rotas-reais.md)); mexe nos valores de referência e nos testes calculados à mão | Por decidir |
| Média | Confirmar com a Vitrus a viatura (dimensões e peso do perfil `novelo-van`, hoje 2,8 × 2,1 × 6 m e 3,5 t, pressuposto) e, se houver GPS, calibrar a velocidade de recolha (30 km/h) contra a de condução do OSRM (~40 km/h) | Por pedir |
| Baixa | Rotas com trânsito e horários (centro histórico, cargas e descargas), que o OSRM não modela | Adiado |
| Baixa | Limites de pedidos partilhados entre processos (hoje em memória, por processo) | Adiado |
| Baixa | Eventos de progresso do otimizador no stream do copiloto; virtualização de linhas no `DataTable` | Adiado |
| Baixa | Integração contínua remota (por agora só `just check` local) | Adiado |
| Baixa | Agente semanal de operações (execução com uma semana simulada) | Adiado |
| Baixa | Migração dos lotes e passaportes do seed de demonstração para o modelo por local | Quando o lote novo existir |
| Baixa | Canais de exportação/comercialização dos lotes de escoamento (tamanho mínimo, janela de fecho) | Por decidir com a Vitrus |
| Baixa | Contas institucionais de doador (escolas, coletividades) com resgate coletivo | Só se a Vitrus priorizar |
| Baixa | «Recolha fixa» recorrente para produtores B2B | Quando o piloto medir volume |
| Baixa | Grandes produtores (hospital, universidade, fardamento) no canal B2B | Só se a Vitrus priorizar |
| Baixa | Sazonalidade da procura no modelo | Com 1 ano de dados observados |
| Baixa | Confirmar a lei de menores de 2026 quando publicada (aprovada 8 jul 2026; o âmbito publicado é redes sociais) | A aguardar publicação |
| Baixa | Verificação parental, se a Vitrus quiser contas com menos de 13 anos | Fase 2 |

## Pitch e entrega

| Tarefa | Estado |
| --- | --- |
| Slides com a identidade Novelo | Por fazer |
| Vídeo de 60 s da demo (plano B) e relatório RAP pré-gerado | Por fazer |
| 3 ensaios cronometrados, com perguntas do júri | Por fazer |
| Checklist de entrega (Demo e entrega) | Por fazer |
| Atualizar o pitch e a demo com as novas capacidades (viatura, cidadão, pontos) | Por fazer |

Se o tempo apertar, segue-se a [ordem de corte das features](features.md#ordem-de-corte). A comparação de cenários, o "E se...?" e o relatório RAP nunca se cortam.
