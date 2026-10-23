# Novelo: guia para agentes de código

Fonte única de instruções para qualquer ferramenta (Claude Code, GLM via Z.ai, ZCode, Cursor, Codex).
O `CLAUDE.md` importa este ficheiro. **Lê-o inteiro antes de mexer em código.**

## O projeto em 30 segundos

Novelo é a ferramenta de decisão que desenha a rede de recolha de têxteis de Guimarães ao menor custo
(Desafio 5 TexVitrus, Hack4Guimarães 2035). Orçamento e meta entram, saem cenários comparáveis em
€, toneladas e €/t. Funcionalidades: simulador da rede (CP-SAT e VRP), cenários e comparação, "E se...?" em português com verificador de números,
triagem por foto (controlo de qualidade na entrega), lotes com QR e passaporte público, bolsa de fibra, evidência por marca, relatório RAP em PDF e mapa. Domínio completo: `docs/engenharia/features.md`.

- **Equipa:** Hélder Gonçalves e Flávio Fernandes. Hackathon de 5 dias: velocidade e perfeição, sem desperdício.
- **Produção:** https://novelo.helder.si (Coolify numa VPS, `docker-compose.yml`). Repositório público (verificado a 20 out 2026). Dev: `just dev`.
- **Domínios:** produção `novelo.helder.si`; emails e administrador de dev em `heldergoncalves.io`.
- **Ambiente:** `docs/engenharia/ambiente.md` (variáveis), `docs/engenharia/ia.md` (OpenRouter), `docs/engenharia/workflow-ia.md` (agentes).

## Regra zero: usar os dados reais da Vitrus

Os dados recebidos são obrigatórios em tudo o que for número. Estão em `data/raw/` (Excel, nunca editar)
e `data/processed/` (gerado por `just etl`). Análise e limites em `docs/dados/analise-dados-recebidos.md`.

| Facto | Valor | Onde se usa |
| --- | --- | --- |
| Têxtil recolhido em 2025 (4 entidades) | 301,3 t = 0,16 kg/hab/mês, recolhido à parte (fora do RSU) | Ponto de partida |
| Indiferenciado do concelho em 2025 | ≈ 51 250,6 t = 43 050,5 t da Vitrus ÷ 0,840 (a Vitrus recolhe 84,0%; R&C 2025 da Vitrus, p. 8; 22 out 2026) | Base da procura |
| Têxtil por desviar (51 250,6 t × 5,86% da APA, RARU 2025, p. 24) | ≈ 3 003,3 t/ano = 1,596 kg/hab/mês (estimativa) | Procura do modelo; gerado ≈ 3 304,6 t, captura atual ≈ 9,1% (cerca de 9 em cada 10 kg vão para o lixo) |
| Destino do recolhido | 59,4% reutilização, 26,5% reciclagem, 14,1% rejeito | Sankey observado; receita só da reutilização (reciclar custa mais que fibra virgem) |
| Tratamento do indiferenciado (aterro) | 105,64 €/t = 40 €/t de TGR + 65,64 €/t de tarifa da Resinorte (Vitrus, 22 out 2026) | Custo evitado por tonelada desviada do lixo |
| Circuitos e viaturas atuais | 40 circuitos, 29 viaturas, 82 localidades; **nenhuma viatura livre à tarde** (a folha de turnos tem um erro; Vitrus, 22 out 2026) | Contexto; o saco **não pode** ir no compactador do porta a porta nem há volta de têxtil num compactador (contaminação) |
| Depósito | Estaleiro Operacional da Rua das Lameiras, Polvoreira (Vitrus, 22 out 2026) | Origem e fim das rotas |
| Custos horários e por km das viaturas | por receber (o financeiro da Vitrus ainda não os enviou, 22 out 2026) | Pressupostos com "estimativa" |
| Contentores municipais (indiferenciado, orgânico, seletivo) | **chegaram a 20 out 2026** em `data/raw/vitrus-mapa-qgis/`: 2 751 contentores, 2 026 locais, CAOP 2019; ETL `municipal_containers.py` → `data/processed/municipal_*` | Base geográfica: onde o têxtil se perde no lixo; locais candidatos, produtores B2B, freguesias, densidade |
| Contentores de têxteis | **não existem** e a Vitrus não os quer (contaminação estraga a reutilização; 21 out 2026) | Rede proposta sem contentores, servida por **uma viatura nova de têxtil, sem compactação** (o "meio novo de recolha" que a Vitrus indicou): saco fechado à porta num dia fixo por freguesia + locais municipais existentes e escolas, sem contentor novo |

Bases antigas que já não se usam: 0,7 kg/hab/mês, 1 317 t, 22,9% (Plano de Ação Integrado/URBACT, que a Vitrus não conhece) e 43 051 t × 5,4% = 2 324,8 t, 11,5%, 1,235 kg (21 out 2026, substituída a 22 out). Também deixou de valer o "plano B" de viaturas livres à tarde.

Nunca inventar um valor: ou vem dos dados, ou está em `docs/engenharia/dados-e-modelo.md` como pressuposto
com fonte, ou leva a etiqueta "estimativa" no ecrã.

## Comandos (todos via `just`; `just` sem argumentos lista tudo)

| Comando | O que faz |
| --- | --- |
| `just dev` | Stack completa com hot reload (Docker): web :3190, api :8190, postgres :5590 |
| `just check-fast` | Iteração diária: API (Ruff, mypy, pytest em paralelo), web (Biome, tsc, Vitest), marca e contrato, tudo em paralelo; VRP cortado nos testes. Alvo < 90 s |
| `just check` | O mesmo com os limites reais do solver. Corre localmente (não há CI remota por agora). **Tem de passar antes de cada push**. Alvo < 5 min |
| `just e2e` / `just e2e-full` | Playwright contra a stack de dev: fluxos críticos (desktop) / tudo (desktop + mobile). Ver `docs/engenharia/testes.md` |
| `just test-api -k nome` | Só pytest (paralelo, uma BD por worker); `test-shuffle` ordem aleatória, `test-slowest` os mais lentos |
| `just gen` | Regenera `openapi.json` e o cliente TypeScript. Correr sempre que a API mudar |
| `just etl` | Excel e pacote QGIS (contentores municipais, CAOP) de `data/raw/` para `data/processed/` |
| `just seed` | Importa `data/processed/` para a base de dados (idempotente; a API já o faz ao arrancar) |
| `just brand` / `just check-brand` | Regenera os assets da marca de uma só fonte (inclui fundos dither, partilha OG, banners; `just brand-landing` só a landing, `just brand-fonts` os subsets de fontes) / mede o alinhamento do logótipo (precisa de `rsvg-convert`) |
| `just osrm-up` / `just osrm-test` / `just osrm-calibrate` / `just osrm-refresh` | Rotas por estrada (OSRM próprio, OpenStreetMap): sobe o serviço (:5190) / testes de integração reais / desvio e velocidade vs pressupostos / dados novos. `just dev` já o inclui; ver `docs/engenharia/rotas-reais.md` |
| `just eval-copilot` / `just eval-triage` | Avaliações com o modelo real (precisam de `OPENROUTER_API_KEY`) |
| `just fix` | Formata e corrige o que o lint conseguir |
| `just migration "msg"` / `just migrate` | Alembic |

Fora do Docker: `just setup`, depois `just db`, `just api`, `just web`.

## Estrutura

```
apps/api/            FastAPI (Python 3.12, uv). src/novelo/{core,features,domain,adapters,ai}
apps/web/            React + Vite + TanStack Router/Query + Tailwind v4 + shadcn/ui. src/client é GERADO
data/raw|processed/  Excel recebidos | CSV/JSON limpos (gerados)
docs/                projeto/ · engenharia/ · dados/ · marca/ (só Markdown, sem PDFs)
brand/               símbolo, logotipos, fontes, avatares, redes (gerados por `just brand`)
scripts/             etl/, brand/, eval_*.py e export_openapi.py
.claude/             agentes e skills partilhados (também lidos por GLM/ZCode, ver abaixo)
openapi.json         contrato exportado, versionado
```

## Regras de código

**Contrato primeiro.** O FastAPI define o contrato; o web consome só o cliente gerado pelo hey-api.
Fluxo: modelo Pydantic + `response_model` → `just gen` → hooks `xxxOptions()`/`xxxMutation()` no web.
**Nunca** editar `apps/web/src/client/` nem `openapi.json` à mão; **nunca** `fetch` à mão.
O `operationId` é o nome da função Python: nomes claros (`list_zones`, `create_scenario`).

**Python (API).**
- Feature-based: `features/<nome>/{router,service,models,schemas}.py`. Routers finos, sem prefixo (aplica-se no `main.py`);
  services sem FastAPI que levantam `AppError`; `domain/` só funções puras (fórmulas, otimização), 100% testadas com valores calculados à mão.
- I/O externo só em `adapters/` (OpenRouter, email, OSRM), injetado por `Depends` (o OSRM entra no domínio pela porta `RoadRouter` em `Params.road`); nos testes troca-se por falsos.
- Tudo tipado: `mypy --strict` e `ruff` limpos. Pydantic v2 em todos os pedidos e respostas. Erros no formato `{code, message, details}`.
- Config só por `core/config.py` (`.env.example` lista tudo). Segredos nunca no código nem nos logs.
- Rotas que chamam OR-Tools são `def` (threadpool), com limite de tempo (`SOLVER_TIME_LIMIT_S`) e sementes fixas.
- Migrações Alembic para qualquer mudança de modelo; nunca editar uma migração já aplicada.

**TypeScript (web).**
- `strict` + `noUncheckedIndexedAccess`. Biome para lint e formatação. Sem `any`, sem `// @ts-ignore`.
- Rotas file-based em `src/routes/`; dados nos `loader` com `queryClient.ensureQueryData`; estado partilhável na URL (`validateSearch`).
- **Tabelas: sempre `DataTable`** (`src/components/data-table`). Cada coluna declara `cell` e, para ordenar, pesquisar, filtrar e exportar, `value`; mais `type`, `filter` (`true`/`{format}`, `'range'`, `'date'`, `'text'`), `exportValue`, `aggregate`, `pinned`, `sortable`, `searchable`, `hideable`, `defaultHidden`, e `primary`/`badge`/`full` para o cartão em telemóvel. Dá um `id` único, `getRowId`, `rowActions`/`bulkActions`/`views`/`renderExpanded` quando fizerem sentido, e `loading`/`refreshing`/`error` com os estados do pedido. Traz pesquisa, filtros com chips e URL partilhável, vistas guardadas, colunas (ordem, fixar, largura), densidade, seleção, exportação CSV/XLSX/JSON, teclado e paginação sem código extra; nunca uma tabela à mão. Separadores: `PageTabs` (`src/components/page-tabs.tsx`), com o separador ativo na URL.
- **Telemóvel primeiro:** alvos de toque ≥ 40 px, campos a 16 px, `Page`/`Section` para o ritmo vertical, `StickyActions` em formulários longos, diálogos como folha inferior.
- Pastas por funcionalidade em `src/features/<nome>/`; componentes sem lógica de negócio.
- UI com shadcn/ui + tokens da marca (`docs/marca/guia-de-marca.md`). Estados obrigatórios em todo o ecrã de dados: a carregar, vazio, erro, sucesso.
- Números em pt-PT com unidade (`lib/format.ts`). KPIs estimados levam "estimativa". Acessibilidade AA, tudo usável por teclado.

**IA (OpenRouter).** O modelo devolve JSON validado por Pydantic (`adapters/openrouter.py`); **nunca faz contas**:
todos os números vêm do otimizador ou da base de dados e um verificador rejeita números fora do JSON de origem.
Prompts versionados em `apps/api/src/novelo/ai/prompts/`. Sem `OPENROUTER_API_KEY` a API arranca e as features de IA respondem 503.

**Português.** UI, docs e comentários em pt-PT com acentos corretos; identificadores, commits e nomes de ficheiros de código em inglês.
Nomes de ficheiros de docs em português, minúsculas e hífens.

## Git e entrega

- Branch `main` é produção: o Coolify faz deploy a cada push. Neste hackathon o push é direto para `main`, só com `just check` verde (PR pequeno continua a ser bem-vindo para mudanças arriscadas).
- Commits em Conventional Commits, no imperativo, em inglês: `feat(api): add on-demand collection mode`.
- Nunca commitar `.env`, nunca `--force` em `main`, nunca `--no-verify`.
- Definição de pronto: `just check` verde, contrato regenerado, ecrã com os 4 estados, docs atualizados se mudou comportamento, funciona em `just dev`.

## Agentes e skills

Os agentes (`.claude/agents/`) são finos: delegam nas skills. Quem não tem subagentes (GLM, ZCode) segue o mesmo
procedimento lendo diretamente `.claude/skills/<nome>/SKILL.md`. `.agents/skills` é um atalho para a mesma pasta.

| Skill | Usar quando |
| --- | --- |
| `novelo-context` | Antes de qualquer tarefa: problema, números, glossário |
| `add-api-feature` | Nova rota/feature na API, ponta a ponta até ao cliente gerado |
| `add-web-feature` | Novo ecrã ou componente |
| `contract-gen` | Mexeste na API ou o cliente está desatualizado |
| `optimization-model` | Procura, custos, MIP de localização, VRP de rotas |
| `data-etl` | Novos ficheiros de dados (pacote municipal QGIS, INE, CAOP, OSM) |
| `llm-feature` | "E se...?", triagem por foto, verificador, evals |
| `deploy-coolify` | Deploy, domínio, variáveis, diagnóstico em produção |
| `ship` | Fechar uma tarefa: check, commit, push |
| `demo-prep` | Cenários A/B, guião, plano B da demo |
| `write-docs` | Escrever ou rever documentação |

| Agente | Responsável por |
| --- | --- |
| `api-engineer` | `apps/api` (features, schemas, migrações) |
| `web-engineer` | `apps/web` (ecrãs, componentes, mapa, gráficos) |
| `optimization-engineer` | `domain/` e o otimizador |
| `data-engineer` | `scripts/etl/` e `data/` |
| `ai-engineer` | `ai/` e `adapters/openrouter.py` |
| `devops` | Docker, Coolify e diagnóstico de produção |
| `reviewer` | Revisão só de leitura antes de merge |
| `docs-writer` | `docs/` |

## Documentação

Índice em `docs/README.md`. Testes e tempos: `docs/engenharia/testes.md`. Arquitetura: `docs/engenharia/arquitetura.md`. Modelo e pressupostos:
`docs/engenharia/dados-e-modelo.md`. Backlog por dia: `docs/engenharia/backlog.md`. Se a realidade mudar, atualiza o doc no mesmo commit.
