# Backlog

Ordenado por dia. Cada frente pode ter um agente do Claude Code a trabalhar contra o contrato do dia 1, com um dono humano que revê e faz merge. A coluna Quem fica para a equipa preencher.

| Dia | Frente | Tarefa | Quem | Estado |
| --- | --- | --- | --- | --- |
| 1 | Produto | Reunião com o mentor: dados, custos unitários, quem opera os contentores têxteis hoje |  | Por fazer |
| 1 | Contrato | Todos os endpoints em Pydantic (incluindo `/whatif`, `/lots`, `/market`, `/flows`, `/brands`, `/reports/rap`), respostas mock e cliente gerado. A partir daqui as frentes trabalham em paralelo |  | Por fazer |
| 1 | Dados | INE (BGRI 2021), CAOP, extrato OSM e tipologia TIPAU; scripts para `data/processed` |  | Por fazer |
| 1 | Front | Esqueleto TanStack Start (Router, Query, Tailwind, Biome) com mapa de Guimarães e freguesias |  | Por fazer |
| 1 | Infra | VPS, DNS e Coolify prontos; CI no GitHub Actions com deploy por webhook |  | Por fazer |
| 2 | Otimizador | Procura por zona, modelo de custos e MIP de localização e modo com dados reais |  | Por fazer |
| 2 | Triagem | `POST /triage` com Claude: estado, composição e marca a partir de duas fotos; 20 etiquetas de teste |  | Por fazer |
| 2 | Lotes | Modelo de lotes e eventos, QR, `GET /lots/{code}` (passaporte) |  | Por fazer |
| 2 | Front | Painéis de orçamento e meta, camada de procura, ecrã de triagem no telemóvel |  | Por fazer |
| 3 | Otimizador | Rotas (VRP) com matriz OSRM ou plano B em linha reta; `POST /scenarios` completo |  | Por fazer |
| 3 | E se | `POST /whatif`: ScenarioDelta, confirmação, verificador de números, 20 perguntas de teste |  | Por fazer |
| 3 | Bolsa e fluxos | `GET /market`, reservas, `GET /flows` e `GET /brands` |  | Por fazer |
| 3 | Front | Pontos e rotas no mapa, página pública do lote, bolsa de fibra |  | Por fazer |
| 4 | Relatório | `POST /reports/rap`: modelo HTML com a identidade Novelo e PDF |  | Por fazer |
| 4 | Front | Ecrã de comparação, caixa "E se...?", Sankey a crescer em direto |  | Por fazer |
| 4 | Produto | Fixar cenários A e B, frase-âncora e 5 perguntas "E se...?" de reserva para o júri |  | Por fazer |
| 4 | Infra | Deploy final e teste fora da rede do evento; QR impressos para a demo |  | Por fazer |
| 4 | Pitch | Slides com a identidade Novelo |  | Por fazer |
| 5 | Copiloto | Uma execução com uma semana de dados simulados (só se o resto estiver fechado) |  | Por fazer |
| 5 | Pitch | Vídeo de 60 s da demo (plano B) e relatório RAP pré-gerado de reserva |  | Por fazer |
| 5 | Pitch | 3 ensaios cronometrados, com perguntas do júri |  | Por fazer |
| 5 | Entrega | Checklist de entrega completa |  | Por fazer |

Se o tempo apertar, segue-se a [ordem de corte das features](02-features.md#ordem-de-corte). A comparação de cenários, o "E se...?" e o relatório RAP nunca se cortam.
