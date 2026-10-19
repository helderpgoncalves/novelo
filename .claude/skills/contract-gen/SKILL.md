---
name: contract-gen
description: Regenerar o contrato OpenAPI e o cliente TypeScript (hey-api) e diagnosticar quando front e back deixam de bater certo. Usar sempre que a API muda.
---

# Contrato OpenAPI → cliente gerado

`just gen` faz: (1) `scripts/export_openapi.py` escreve `openapi.json` a partir de `create_app().openapi()` sem arrancar o servidor; (2) `pnpm gen` (hey-api, `apps/web/openapi-ts.config.ts`) gera `apps/web/src/client/` com tipos, SDK, esquemas Zod e hooks do TanStack Query.

- Ambos os resultados são **versionados** e `just check-contract` falha se estiverem desatualizados.
- Nomes limpos: `operationId` = nome da função Python. Renomear a função muda o hook gerado: corrigir os usos no web.
- `TypeScript` tem de ficar em `~6.0` (o hey-api não funciona com o compilador nativo 7).
- O `baseUrl` vem de `src/lib/api-config.ts` (vazio = mesmo domínio; em dev o Vite faz proxy de `/api`).
- Se `pnpm typecheck` falhar depois de gerar, o erro é real: a API mudou e o web tem de acompanhar.
- Nunca editar o gerado; para mudar o resultado, muda o schema Pydantic ou `openapi-ts.config.ts`.
