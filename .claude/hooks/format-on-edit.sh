#!/usr/bin/env bash
# Formata o ficheiro editado: ruff (Python) ou biome (TypeScript). Silencioso e nunca bloqueia.
f=$(jq -r '.tool_input.file_path // empty')
[ -z "$f" ] || [ ! -f "$f" ] && exit 0
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
case "$f" in
  */apps/api/alembic/versions/*) ;;
  */apps/api/*.py) (cd "$root/apps/api" && uv run --quiet ruff format "$f" && uv run --quiet ruff check --fix --quiet "$f") >/dev/null 2>&1 ;;
  */apps/web/src/client/*|*/routeTree.gen.ts) ;;
  */apps/web/*.ts|*/apps/web/*.tsx|*/apps/web/*.json) (cd "$root/apps/web" && pnpm exec biome check --write --no-errors-on-unmatched "$f") >/dev/null 2>&1 ;;
esac
exit 0
