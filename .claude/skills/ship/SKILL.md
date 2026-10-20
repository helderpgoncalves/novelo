---
name: ship
description: Fechar uma tarefa no Novelo com qualidade: just check, revisão rápida, commit convencional e push. Usar quando uma alteração está pronta a seguir para a main (e para o Coolify).
---

# Fechar e entregar

1. `git status` e `git diff`: só entra o que pertence à tarefa; nenhum `.env`, nenhum ficheiro gerado à mão.
2. Mexeste na API? `just gen` e inclui `openapi.json` + `apps/web/src/client`.
3. `just check` **verde** (lint, tipos, testes, contrato). Se falhar, corrige a causa; nunca `--no-verify`.
4. Docs: se mudou comportamento, números ou comandos, atualiza o doc no mesmo commit.
5. Commit Conventional Commits em inglês, imperativo, escopo `api|web|data|docs|infra|ai`: `feat(web): add scenario comparison screen`. Corpo só se o porquê não for óbvio. Sem linhas de atribuição.
6. `git push origin main` (push direto é a regra neste hackathon; não há CI remota). O push à `main` dispara o deploy no Coolify: confirma `https://novelo.helder.si/api/v1/health` depois.
7. Relata o que ficou feito e o que não ficou, sem rodeios.
