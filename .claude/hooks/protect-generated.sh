#!/usr/bin/env bash
# Bloqueia edições à mão a ficheiros gerados e a segredos. Código de saída 2 devolve o motivo ao agente.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */apps/web/src/client/*|*/openapi.json|*/routeTree.gen.ts)
    echo "Ficheiro gerado: não editar à mão. Muda o schema Pydantic e corre 'just gen'." >&2; exit 2 ;;
  */data/raw/*)
    echo "data/raw é só leitura. Muda o ETL em scripts/etl e corre 'just etl'." >&2; exit 2 ;;
  */.env|*/.env.local|*/.env.production)
    echo "Não editar ficheiros .env pelo agente: usa .env.example e diz ao utilizador o que definir." >&2; exit 2 ;;
esac
exit 0
