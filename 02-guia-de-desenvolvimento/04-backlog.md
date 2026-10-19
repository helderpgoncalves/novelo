# Backlog

Ordenado por dia. A coluna Quem fica para a equipa preencher no arranque.

| Dia | Frente | Tarefa | Quem | Estado |
| --- | --- | --- | --- | --- |
| 1 | Produto | Reunião com o mentor: dados, custos unitários, quem opera os contentores têxteis hoje |  | Por fazer |
| 1 | Dados | Descarregar INE (BGRI 2021), CAOP e extrato OSM; scripts para `data/processed` |  | Por fazer |
| 1 | Front | Esqueleto TanStack Start (Router, Query, Tailwind, Biome) com mapa de Guimarães e freguesias |  | Por fazer |
| 1 | Back | Esqueleto FastAPI com uv, Ruff e mypy; `GET /zones` e `/health`; `just gen` a gerar o cliente com hey-api |  | Por fazer |
| 1 | Infra | VPS, DNS e Coolify prontos; CI no GitHub Actions com deploy por webhook (ver [Deploy](02-deploy-coolify.md)) |  | Por fazer |
| 2 | Dados | Procura por zona (`demand.py`) e locais candidatos do OSM |  | Por fazer |
| 2 | Back | Modelo de custos (`costs.py`) com `params.yaml` |  | Por fazer |
| 2 | Back | Otimização de localização e modo (MIP) a correr com dados reais |  | Por fazer |
| 2 | Front | Camada de procura no mapa e painéis de orçamento e meta |  | Por fazer |
| 3 | Back | Rotas (VRP) com matriz OSRM ou plano B em linha reta |  | Por fazer |
| 3 | Back | `POST /scenarios` completo com KPIs |  | Por fazer |
| 3 | Triagem | `POST /triage`: foto da peça e da etiqueta, estado e composição |  | Por fazer |
| 3 | Front | Pontos e rotas do cenário no mapa |  | Por fazer |
| 4 | Front | Ecrã de comparação A vs B |  | Por fazer |
| 4 | Front | Ecrã de triagem no telemóvel |  | Por fazer |
| 4 | Produto | Fixar os 2 cenários da demo e os números da frase-âncora |  | Por fazer |
| 4 | Infra | Deploy na VPS com Coolify a partir da CI e teste fora da rede do evento |  | Por fazer |
| 4 | Pitch | Slides com a identidade Novelo |  | Por fazer |
| 5 | Pitch | Gravar vídeo de 60 s da demo (plano B) |  | Por fazer |
| 5 | Pitch | 3 ensaios cronometrados, com perguntas do júri |  | Por fazer |
| 5 | Entrega | Checklist de entrega completa |  | Por fazer |

Se o dia 3 derrapar, corta-se primeiro a triagem, depois as rotas (fica só localização e custos). A comparação de cenários nunca se corta.
