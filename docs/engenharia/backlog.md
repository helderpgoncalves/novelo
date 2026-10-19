# Backlog

O que está feito e o que falta, por frente. Atualiza-se no mesmo commit que muda a realidade.

## Feito (2026-10-19)

| Frente | Entregue |
| --- | --- |
| Infra | Monorepo, Docker Compose de desenvolvimento e produção para o Coolify, `justfile`, `.env.example` completo |
| Contrato | OpenAPI exportado, cliente hey-api (SDK, Zod, React Query) e verificação com `just check-contract` |
| Dados | ETL dos Excel da Vitrus, INE (população e TIPAU), CAOP e OSM; seed idempotente no Postgres; alertas de qualidade |
| Autenticação | Login, registo, Google, confirmação de email, recuperar password, "manter sessão iniciada", administração de utilizadores |
| Planeamento | Otimizador (CP-SAT e VRP), três modos combináveis, cenários, comparação, pressupostos com origem |
| "E se...?" | `ScenarioDelta`, confirmação, explicação e verificador de números |
| Operação | Triagem por foto, lotes, QR, passaporte público, bolsa de fibra, evidência por marca |
| Relatório | PDF RAP com custo por tipo de território (WeasyPrint) e histórico |
| Web | Mapa, todos os ecrãs de dados, pt/en, claro/escuro, PWA mobile-first, `DataTable` com pesquisa, filtros, colunas e paginação |
| Qualidade | 76 testes pytest, Vitest e 27 testes Playwright |

## Falta

| Prioridade | Tarefa | Estado |
| --- | --- | --- |
| Alta | Localizações dos contentores (chegam a **2026-10-20**): colocar em `data/raw`, correr `just etl`, popular `containers` e mostrar a camada no mapa e como pontos de partida do simulador | Por fazer |
| Alta | Custos unitários (recolha, quilómetro, contentor) da Vitrus para trocar os pressupostos por dados | Por pedir |
| Média | Substituir os códigos de zona provisórios `0308U1` a `0308U5` | Por validar |
| Média | Confirmar o depósito real da Vitrus (hoje o centro de Guimarães) | Por pedir |
| Média | Verificar as imagens de produção com `just build` e um deploy de ensaio no Coolify | Por fazer |
| Média | Cenários A e B fixos, cinco perguntas "E se...?" de reserva, lote de demonstração | Por fazer |
| Baixa | Integração contínua remota (por agora só `just check` local) | Adiado |
| Baixa | Copiloto de operações (execução com uma semana simulada) | Adiado |

## Pitch e entrega

| Tarefa | Estado |
| --- | --- |
| Slides com a identidade Novelo | Por fazer |
| Vídeo de 60 s da demo (plano B) e relatório RAP pré-gerado | Por fazer |
| 3 ensaios cronometrados, com perguntas do júri | Por fazer |
| Checklist de entrega ([Demo e entrega](demo-e-entrega.md)) | Por fazer |

Se o tempo apertar, segue-se a [ordem de corte das features](features.md#ordem-de-corte). A comparação de cenários, o "E se...?" e o relatório RAP nunca se cortam.
