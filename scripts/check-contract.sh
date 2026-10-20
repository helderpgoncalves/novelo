#!/usr/bin/env bash
# Verifica que openapi.json e o cliente TypeScript correspondem à API, SEM tocar nos ficheiros do repositório
# (por isso corre em paralelo com o lint, os tipos e os testes do web, que leem apps/web/src/client).
# Se nada do que o determina mudou desde a última verificação bem-sucedida, salta (carimbo em .cache/).
# O carimbo cobre as entradas (código da API, script, lock, config do gerador) E as saídas (openapi.json, cliente),
# por isso editar qualquer uma delas invalida-o: nunca dá verde sem comparar.
set -euo pipefail
cd "$(dirname "$0")/.."

stamp=.cache/contract.sha
current="$(
  {
    find apps/api/src -name '*.py' -not -path '*/__pycache__/*'
    find apps/web/src/client -type f
    echo apps/api/uv.lock
    echo apps/api/pyproject.toml
    echo scripts/export_openapi.py
    echo openapi.json
    echo apps/web/openapi-ts.config.ts
    echo apps/web/node_modules/@hey-api/openapi-ts/package.json
  } | LC_ALL=C sort | xargs shasum | shasum | cut -d' ' -f1
)"
if [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$current" ]; then
  echo "contrato: sem alterações desde a última verificação, nada a regenerar"
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work" apps/web/.gen-check' EXIT
uv run --project apps/api python scripts/export_openapi.py "$work/openapi.json" >/dev/null
if ! diff -q "$work/openapi.json" openapi.json >/dev/null; then
  echo "openapi.json está desatualizado face à API: corre 'just gen' e faz commit." >&2
  diff "$work/openapi.json" openapi.json | head -20 >&2 || true
  exit 1
fi
(cd apps/web && pnpm exec openapi-ts -i "$work/openapi.json" -o .gen-check/client >/dev/null)
if ! diff -r apps/web/.gen-check/client apps/web/src/client >/dev/null; then
  echo "O cliente gerado (apps/web/src/client) está desatualizado: corre 'just gen' e faz commit." >&2
  diff -r apps/web/.gen-check/client apps/web/src/client | head -20 >&2 || true
  exit 1
fi
mkdir -p .cache
echo "$current" >"$stamp"
echo "contrato: openapi.json e cliente em dia"
