@AGENTS.md

## Claude Code

- Skills em `.claude/skills/` carregam-se sozinhas pela descrição; podes invocá-las com `/nome` (ex.: `/ship`).
- Subagentes em `.claude/agents/`: delega trabalho independente (ex.: `web-engineer` e `api-engineer` em paralelo depois de fixado o contrato).
- Hooks em `.claude/settings.json`: formatam Python/TypeScript depois de editar e bloqueiam edições a ficheiros gerados.
- Preferências pessoais vão para `CLAUDE.local.md` (ignorado pelo Git).
- Antes de acabar uma tarefa corre `just check`; não declares "feito" sem ele verde. Não há CI remota por agora.
- Commits sem linhas de atribuição; push direto para `main` (ver `AGENTS.md`).
