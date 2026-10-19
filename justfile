# Comandos únicos do projeto. `just` sem argumentos lista tudo.
set shell := ["bash", "-cu"]

# WeasyPrint (PDF do relatório RAP) precisa das bibliotecas Pango; no macOS vêm do Homebrew (`brew install pango`).
export DYLD_FALLBACK_LIBRARY_PATH := env_var_or_default("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")

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

db-wait:
    docker compose -f docker-compose.dev.yml up -d --wait db

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

# Converte os Excel de data/raw em data/processed
etl:
    uv run scripts/etl/build_processed.py

# --- Qualidade: o mesmo que a CI corre ----------------------------------------
check: check-api check-web check-contract

check-api: db-wait
    cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q

check-web:
    pnpm lint && pnpm typecheck && pnpm test

# Falha se o contrato ou o cliente gerado estiverem desatualizados
check-contract: gen
    git diff --exit-code -- openapi.json apps/web/src/client

fix:
    cd apps/api && uv run ruff check --fix . && uv run ruff format .
    pnpm --filter web lint:fix

test:
    cd apps/api && uv run pytest -q
    pnpm test

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
