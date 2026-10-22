# Backlog

O que está feito e o que falta, por frente. Atualiza-se no mesmo commit que muda a realidade. Estado a 20 de outubro de 2026.

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
| Operação | Triagem por foto, lotes, QR, passaporte público, bolsa de fibra, evidência por marca |
| Relatório | PDF RAP com custo por tipo de território (WeasyPrint) e histórico |
| Web | Mapa, todos os ecrãs de dados, Frota refeita (calendário da semana tipo, `.ics`), pt/en, claro/escuro, PWA mobile-first com barra de separadores, páginas de erro, visita guiada, `DataTable` e `PageTabs` completos |
| Marca | Geometria única, `just brand` (SVG, PNG, favicon, ícones PWA, avatares, partilha, email) e `just check-brand` |
| Qualidade | 1 054 testes pytest, 432 Vitest e Playwright em 36 ficheiros (22 out 2026) |

## Falta

| Prioridade | Tarefa | Estado |
| --- | --- | --- |
| Alta | Aplicar as respostas da Vitrus de 22/10: saco fora do compactador e viatura de têxtil nova, sem compactação (sai o "0 km novos" e o plano B das viaturas livres); procura = 51 250,6 t × 5,86% (≈ 3 003,3 t); tratamento evitado 105,64 €/t; depósito na Rua das Lameiras, Polvoreira; recalcular cenários, sensibilidade, cobertura e piloto, e preencher os números da narrativa | Em curso |
| Alta | Aplicar as respostas da Vitrus de 21/10 (base da procura substituída a 22/10): procura = 43 051 t × 5,4% (2 324,8 t por desviar), modos por omissão `existing` e `on_demand` (`street` só referência), sem calibração da rua, sem receita de reciclagem; recalcular cenários de referência, sensibilidade, teto francês e a tabela dos locais reais em [Dados e modelo](dados-e-modelo.md) | Em curso |
| Alta | Custos por hora e por quilómetro das viaturas da Vitrus para trocar os pressupostos por dados | Pedidos ao departamento financeiro a 21/10; ainda por chegar a 22/10 |
| Média | Substituir os códigos de zona provisórios `0308U1` a `0308U5` (a CAOP 2019 já traz os oficiais) | Por validar |
| Média | Confirmar o depósito real da Vitrus (hoje o centro de Guimarães) | Por pedir |
| Média | Medir a exatidão da triagem (`just eval-triage` com 30 ou mais peças com verdade-terreno) | Por fazer |
| Média | Correr `just eval-copilot` com os 11 casos `muni_*` e atualizar a [avaliação](avaliacao-copiloto.md) | Por fazer |
| Média | Passar as restantes variáveis (`MAGIC_LINK_*`, `GUEST_*`, `COPILOT_*`, `EMAIL_TRANSPORT`...) pelo `docker-compose.yml` de produção, se for preciso alterá-las no Coolify | Por decidir |
| Média | Cenários A e B fixos, cinco perguntas "E se...?" de reserva, lote de demonstração | Por fazer |
| Baixa | Cliente OSRM para distâncias por estrada (hoje linha reta x 1,3; `OSRM_URL` não é usada) | Adiado |
| Baixa | Limites de pedidos partilhados entre processos (hoje em memória, por processo) | Adiado |
| Baixa | Eventos de progresso do otimizador no stream do copiloto; virtualização de linhas no `DataTable` | Adiado |
| Baixa | Integração contínua remota (por agora só `just check` local) | Adiado |
| Baixa | Agente semanal de operações (execução com uma semana simulada) | Adiado |

## Pitch e entrega

| Tarefa | Estado |
| --- | --- |
| Slides com a identidade Novelo | Por fazer |
| Vídeo de 60 s da demo (plano B) e relatório RAP pré-gerado | Por fazer |
| 3 ensaios cronometrados, com perguntas do júri | Por fazer |
| Checklist de entrega ([Demo e entrega](demo-e-entrega.md)) | Por fazer |

Se o tempo apertar, segue-se a [ordem de corte das features](features.md#ordem-de-corte). A comparação de cenários, o "E se...?" e o relatório RAP nunca se cortam.
