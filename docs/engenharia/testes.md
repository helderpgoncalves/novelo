# Testes e verificação

Não há CI remota: tudo corre localmente com `just`. O objetivo é iterar depressa sem enfraquecer nenhuma verificação.

## Alvos

| Comando | Quando | O que corre (tudo em paralelo) |
| --- | --- | --- |
| `just check-fast` | Durante o trabalho | `api-lint` (ruff, format, mypy) · `api-test` (pytest, xdist, VRP cortado) · `web-lint` (biome) · `web-types` (tsc incremental) · `web-test` (vitest) · `brand` · `contract` |
| `just check` | Antes de cada push | Os mesmos jobs, com os limites reais do solver (`NOVELO_TEST_SOLVER=full`) |
| `just check-api` / `just check-web` | Só uma metade | `api-lint` + `api-test` / `web-lint` + `web-types` + `web-test` |
| `just test-api -k nome -m "not slow"` | Um teste ou um grupo | pytest paralelo com argumentos livres |
| `just test-shuffle` | Caçar testes dependentes | pytest em ordem aleatória (`pytest-randomly`); repetir com `--randomly-seed=N` |
| `just test-slowest` | Medir | Serial, com os 25 testes mais lentos |
| `just osrm-test` | Ao mexer nas rotas por estrada | Testes de integração contra o OSRM a sério (sobe-o se preciso); fora do `just check`, que usa um OSRM falso (`test_osrm_adapter.py`, `test_routing.py`, `test_road_routes.py`) |
| `just e2e` | Antes de mexer em fluxos de UI | Playwright, só desktop, ficheiros críticos (auth, home, planning, coverage, municipal, data-table, errors, operations, hero-layout) |
| `just e2e-full` | Antes de uma demo | Playwright completo (desktop + mobile, inclui o copiloto com o modelo real) |

`scripts/parallel.sh` corre os jobs em simultâneo, escreve cada saída num ficheiro, mostra `ok`/`FALHOU` à medida que acabam e,
no fim, imprime a saída completa dos que falharam (ou as últimas linhas dos que passaram). Sai com 1 se algum falhar.

`e2e/hero-layout.spec.ts` garante o hero da landing: em 13 viewports (320×640 a 2560×1300), claro e escuro, sem movimento, mede
as caixas de todos os textos e controlos visíveis do hero (eyebrow, prazo, título, subtítulo, botões, linhas do painel dos
números, nós e ponta do fio, barra do topo) e falha se dois se tocarem ou se algum sair do ecrã. Só precisa do web:
`E2E_BASE_URL=http://localhost:3190 pnpm exec playwright test e2e/hero-layout.spec.ts --project=desktop` (em `apps/web`).

## Tempos medidos

TEMPOS

## O que torna a API rápida

- **Uma base de dados por processo.** `tests/conftest.py` constrói uma vez um *template* (`novelo_test_tpl_<hash>`: `create_all` + seed
  dos dados reais) e clona-o com `CREATE DATABASE ... TEMPLATE` para cada worker (`novelo_test_<corrida>_<worker>`), apagada no fim. O
  hash do template cobre o DDL dos modelos, o código do seed e os ficheiros de `data/processed`, por isso só se reconstrói quando
  algo disso muda (~10 s); no resto das corridas o arranque são ~100 ms. Duas corridas em simultâneo não se pisam. Bases de
  corridas mortas há mais de 6 h são limpas sozinhas.
- **Isolamento por teste** mantém-se: transação com SAVEPOINT, desfeita no fim (fixture `session`). Nada é recriado por teste.
- **Argon2 barato só nos testes** (`time_cost=1`, `memory_cost=8`): o custo real (~50 ms por hash) vezes centenas de registos e logins.
- **VRP cortado a 250 ms nos testes** (`NOVELO_TEST_VRP_MS`). O VRP (guided local search) gasta sempre o tempo todo: 2 s por modo e por
  cenário, e quase todos os testes do copiloto criam um cenário. É o grosso dos 6 min iniciais. `just check` usa
  `NOVELO_TEST_SOLVER=full` e mantém os limites de produção. O CP-SAT (`solve`) já termina cedo (gap de 0,1%) e não é cortado.
- **Limitadores de pedidos** reiniciados em todos os testes (`RateLimiter.reset_all`), para o resultado não depender de quantos
  testes o mesmo worker já correu.
- **Marcadores** (atribuídos por ficheiro em `conftest.py`, sem tocar nos testes): `solver`, `llm` (sempre modelo falso, nunca rede) e
  `slow`. Servem para selecionar (`-m "not solver"`); `just check` corre-os todos.
- **ruff e mypy** usam cache (`.ruff_cache`, `.mypy_cache`): menos de 1 s com a cache quente. Não compensa daemon.

## O que torna o web rápido

- **tsc incremental** (`tsBuildInfoFile` em `node_modules/.cache`): ~20 s a frio, ~5 s a seguir.
- **Paraglide só recompila se as mensagens mudaram** (`apps/web/scripts/i18n.mjs`, carimbo em `src/paraglide/.stamp`): de ~7 s para ~0,2 s.
  `pnpm i18n --force` obriga a recompilar. `just check*` corre-o uma vez antes dos jobs, para `tsc` e `vitest` não competirem.
- **vitest** com `pool: 'threads'`; `just web-test-changed` corre só o que mudou desde o último commit.
- **biome** demora ~0,5 s, não precisa de cache.

## Contrato sem regenerar para nada

`scripts/check-contract.sh` exporta o OpenAPI para um ficheiro temporário, gera o cliente para `apps/web/.gen-check` e compara com
`openapi.json` e `apps/web/src/client`, **sem escrever no repositório** (por isso pode correr ao lado do `tsc` e do `vitest`).
Se nada mudou desde a última verificação bem-sucedida, salta. O carimbo (`.cache/contract.sha`) é o hash do código da API,
do lock, do script, da configuração do gerador, da versão do hey-api **e** das saídas (`openapi.json`, cliente): editar qualquer
um deles invalida-o, e só se grava depois de a comparação passar. `just gen` continua a ser o único comando que escreve.

## Base de dados

`just db-wait` testa a porta 5590 e só chama o Docker se a BD de dev não responde. Os testes usam o mesmo Postgres de dev
(bases `novelo_test_*`, separadas da `novelo`). `TEST_DATABASE_URL` muda o nome de base.

## Playwright

- `globalSetup` faz **um** login do admin por execução e guarda só o cookie de acesso (15 min) em
  `apps/web/node_modules/.cache/e2e-admin-session.json`; `login(page)` reutiliza-o (e volta ao formulário se não houver ficheiro,
  tiver mais de 10 min ou o cookie for recusado). Os logins de outros utilizadores continuam pelo formulário. O cookie de renovação
  nunca é partilhado: rodaria entre workers. `E2E_FRESH_LOGIN=1` desliga a reutilização.
- `workers` por omissão 4 (`E2E_WORKERS`); `E2E_FULLY_PARALLEL=1` paraleliza também dentro de cada ficheiro (alguns ficheiros
  dependem da ordem dos testes, por isso não é o padrão).
- `webServer` com `reuseExistingServer`: usa a stack de `just dev`; se não está a correr, arranca a API e o Vite (a BD tem de estar de pé:
  `just db-wait`, que `just e2e` já chama). Com `E2E_BASE_URL` definido não arranca nada.
- Projetos `desktop` e `mobile`: `just e2e-full --project=mobile`.

## Depurar um teste lento

1. `just test-slowest` (serial) ou `just test-api --durations=30`. `setup`/`teardown` altos são fixtures; `call` é o teste.
2. `cd apps/api && uv run python -m cProfile -o /tmp/p.out -m pytest -n 0 tests/x.py::teste` e depois `pstats` ordenado por `cumulative`.
   Se o tempo está em `RoutingModel.SolveWithParameters` é o VRP; se está em `new_bool_var`/`solve` é o CP-SAT.
3. Um teste que precisa de um cenário já é caro: reutilize um com `scenario(...)` em vez de criar vários.
4. Para ver se o paralelismo esconde dependências: `just test-shuffle`. Se falha só em paralelo ou só com `--randomly-seed=N`, o teste
   depende de estado global (cache, limitador, ficheiro) ou de outro teste.

## Testes frágeis encontrados

FRAGEIS
