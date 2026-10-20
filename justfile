# Comandos únicos do projeto. `just` sem argumentos lista tudo.
set shell := ["bash", "-cu"]

# WeasyPrint (PDF do relatório RAP) precisa das bibliotecas Pango; no macOS vêm do Homebrew (`brew install pango`).
export DYLD_FALLBACK_LIBRARY_PATH := env_var_or_default("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")

BRAND_RUN := "cd scripts/brand && uv run --no-project --with fonttools --with brotli --with uharfbuzz --with numpy --with pillow --with pytest python"

default:
    @just --list

# --- Ambiente ---------------------------------------------------------------
# Instala dependências locais (fora do Docker) e cria o .env
setup:
    [ -f .env ] || cp .env.example .env
    cd apps/api && uv sync
    pnpm install

# Stack completa com hot reload (Docker): web :3190, api :8190, postgres :5590
dev:
    docker compose -f docker-compose.dev.yml up --build

# Para a stack de dev (add `-v` ao fim apaga a base de dados)
down *ARGS:
    docker compose -f docker-compose.dev.yml down {{ARGS}}

# Só a API e o web fora do Docker (precisa de `just db`)
api:
    cd apps/api && uv run uvicorn novelo.main:app --reload --port 8190

web:
    pnpm dev

db:
    docker compose -f docker-compose.dev.yml up -d db

# Espera pela BD de dev (:5590). Se já responde, não toca no Docker (~10 ms); senão sobe-a e espera pelo healthcheck.
db-wait:
    @(exec 3<>/dev/tcp/127.0.0.1/5590) 2>/dev/null || docker compose -f docker-compose.dev.yml up -d --wait db

# Logs de um serviço (ex.: just logs api para ver o link de recuperar password em dev)
logs SERVICE="api":
    docker compose -f docker-compose.dev.yml logs -f --tail 100 {{SERVICE}}

# Adiciona componentes shadcn/ui. O CLI instala por engano o pacote npm `cn`: isto corrige-o logo a seguir.
ui +COMPONENTS:
    cd apps/web && pnpm dlx shadcn@latest add {{COMPONENTS}} -y --overwrite
    grep -rl "from [\"']cn[\"']" apps/web/src | xargs -r sed -i '' "s#from [\"']cn[\"']#from '@/lib/utils'#"
    pnpm --filter web remove cn || true
    pnpm --filter web exec biome check --write src/components/ui

# --- Contrato e dados ---------------------------------------------------------
# Regenera openapi.json e o cliente TypeScript (hey-api). Correr sempre que a API mudar.
gen:
    uv run --project apps/api python scripts/export_openapi.py
    pnpm gen

# Avalia a triagem por foto (data/eval/triage/truth.csv + imagens) e compara modelos: just eval-triage --models a,b
eval-triage *ARGS:
    uv run --project apps/api python scripts/eval_triage.py {{ARGS}}

# Avalia o copiloto ponta a ponta com o modelo real (78 casos pt/en): just eval-copilot [--only id] [--fresh] [--no-fail]
eval-copilot *ARGS:
    uv run --project apps/api python scripts/eval_copilot.py {{ARGS}}

# Converte os Excel e o pacote QGIS (contentores municipais + CAOP) de data/raw em data/processed
etl:
    uv run scripts/etl/build_processed.py
    uv run scripts/etl/municipal_containers.py

# --- Qualidade: tudo o que tem de passar antes de cada push (sem CI remota) ----------------------------------------
# Os dois alvos correm API (lint+tipos / testes), web (biome / tsc / vitest), marca e contrato EM PARALELO.
# check-fast: iteração diária (VRP cortado a 250 ms nos testes). check: o que se corre antes do push (limites reais).
# Tempos e como depurar testes lentos: docs/engenharia/testes.md

# Rápido: tudo em paralelo, solver cortado nos testes (alvo < 90 s)
check-fast: db-wait web-i18n
    NOVELO_TEST_SOLVER=fast scripts/parallel.sh {{CHECK_JOBS}}

# Completo, antes de cada push: tudo em paralelo, limites reais do solver (alvo < 5 min)
check: db-wait web-i18n
    NOVELO_TEST_SOLVER=full scripts/parallel.sh {{CHECK_JOBS}}

CHECK_JOBS := '"api-lint=just api-lint" "api-test=just test-api" "web-lint=just web-lint" "web-types=just web-types" "web-test=just web-test" "brand=just check-brand" "contract=just check-contract"'

# Só a API (lint + tipos + testes); o solver segue NOVELO_TEST_SOLVER (fast por omissão)
check-api: db-wait
    scripts/parallel.sh "api-lint=just api-lint" "api-test=just test-api"

# Só o web (biome + tsc + vitest em paralelo)
check-web: web-i18n
    scripts/parallel.sh "web-lint=just web-lint" "web-types=just web-types" "web-test=just web-test"

api-lint:
    cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy

# pytest em paralelo (xdist, uma BD por worker clonada de um template). Ex.: just test-api -k planning -m "not slow"
test-api *ARGS: db-wait
    cd apps/api && uv run pytest -q -n auto --dist worksteal {{ARGS}}

# Ordem aleatória (pytest-randomly) para caçar testes dependentes; repete uma falha com --randomly-seed=N
test-shuffle *ARGS: db-wait
    cd apps/api && uv run pytest -q -n auto -o addopts="" {{ARGS}}

# Os 25 testes mais lentos (serial, para medir de forma limpa)
test-slowest: db-wait
    cd apps/api && uv run pytest -q -n 0 --durations=25 -p no:cacheprovider

# Compila as mensagens do Paraglide só se mudaram (carimbo)
web-i18n:
    pnpm --filter web i18n

web-lint:
    pnpm --filter web exec biome check .

# tsc incremental (tsBuildInfo em node_modules/.cache): 20 s a frio, ~5 s a seguir
web-types:
    pnpm --filter web exec tsc --noEmit

web-test:
    pnpm --filter web exec vitest run

# Só os ficheiros web afetados desde o último commit
web-test-changed: web-i18n
    pnpm --filter web exec vitest run --changed

# Ponta a ponta, fluxos críticos (smoke, desktop). Reaproveita a stack de `just dev`; senão arranca API e Vite.
e2e *ARGS: db-wait
    cd apps/web && E2E_SUITE=smoke pnpm exec playwright test --project=desktop {{ARGS}}

# Ponta a ponta completo (desktop + mobile, inclui o copiloto com o modelo real)
e2e-full *ARGS: db-wait
    cd apps/web && pnpm exec playwright test {{ARGS}}

# Marca: regenera TODOS os assets (SVG, PNG, favicon, ícones PWA, avatares, partilha, email) de uma só fonte
brand:
    {{BRAND_RUN}} build_assets.py
    {{BRAND_RUN}} hero_derivatives.py
    {{BRAND_RUN}} login_panel.py

# Só as fotografias da landing: Guimarães em meio-tom (hero_derivatives.py), AVIF/WebP com hash do conteúdo, manifest e tipos gerados
brand-landing:
    {{BRAND_RUN}} hero_derivatives.py

brand-hero: brand-landing

# Capa do Hack4Guimarães 2035 para o rodapé da landing (descarrega da Taikai; precisa de avifenc e cwebp)
brand-hackathon:
    {{BRAND_RUN}} hackathon_cover.py

# Só o painel do ecrã de entrada (fotografia da Penha em meio-tom; precisa de rsvg-convert)
brand-login:
    {{BRAND_RUN}} login_panel.py

# Subsets WOFF2 das fontes da landing (descarrega os TTF de google/fonts; precisa de rede)
brand-fonts:
    {{BRAND_RUN}} fonts_landing.py

# Regenera as capturas do manifesto PWA (precisa da stack `just dev` a correr)
brand-shots:
    cd apps/web && BRAND_SHOTS=1 pnpm exec playwright test e2e/brand-assets.spec.ts

# Alinhamento do logótipo medido em píxeis (tolerância 0,5 px a 512 px); precisa de rsvg-convert
check-brand:
    {{BRAND_RUN}} -m pytest -q test_brand.py

# Falha se o contrato/cliente estiverem desatualizados (compara sem escrever; salta se nada mudou: scripts/check-contract.sh)
check-contract:
    scripts/check-contract.sh

fix:
    cd apps/api && uv run ruff check --fix . && uv run ruff format .
    pnpm --filter web lint:fix

test: db-wait web-i18n
    scripts/parallel.sh "api-test=just test-api" "web-test=just web-test"

# Nova migração a partir dos modelos: just migration "descrição"
migration MSG:
    cd apps/api && uv run alembic revision --autogenerate -m "{{MSG}}"

migrate:
    cd apps/api && uv run alembic upgrade head

# Importa data/processed para a base de dados (idempotente; corre sozinho no arranque da API)
seed:
    cd apps/api && uv run python -m novelo.cli seed

# --- Produção local -------------------------------------------------------------
# Constrói as imagens de produção (o que o Coolify vai construir)
build:
    docker compose -f docker-compose.yml build
