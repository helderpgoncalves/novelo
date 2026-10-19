# Trabalhar com agentes de código

O repositório foi preparado para que o Hélder (Claude Code) e o Flávio (GLM via Z.ai ou ZCode) partilhem exatamente o mesmo contexto e os mesmos procedimentos.

## Uma fonte, várias ferramentas

| Ficheiro | Papel |
| --- | --- |
| [`AGENTS.md`](../../AGENTS.md) | Fonte única de instruções: regras, comandos, estrutura, definição de pronto. Lido por GLM, ZCode, Cursor e Codex |
| [`CLAUDE.md`](../../CLAUDE.md) | Curto: importa o `AGENTS.md` (`@AGENTS.md`) e acrescenta o que é específico do Claude Code |
| `.claude/skills/<nome>/SKILL.md` | Procedimentos reutilizáveis (adicionar feature na API ou no web, ETL, IA, deploy, demo, docs) |
| `.claude/agents/` | Subagentes finos (`api-engineer`, `web-engineer`, `optimization-engineer`, `data-engineer`, `ai-engineer`, `devops`, `reviewer`, `docs-writer`) que delegam nas skills |
| `.claude/settings.json` e `.claude/hooks/` | Permissões, formatação depois de editar e bloqueio de edições a ficheiros gerados |
| `.agents/skills` | Atalho para `.claude/skills`, para ferramentas que procuram aí |

## Claude Code

As skills carregam-se pela descrição e invocam-se com `/nome` (por exemplo `/ship`). Os subagentes trabalham em paralelo depois de o contrato estar fixado: `api-engineer` e `web-engineer` em simultâneo. Preferências pessoais vão para `CLAUDE.local.md` (ignorado pelo Git).

## GLM (Z.ai) e ZCode

Sem subagentes: ler `AGENTS.md` inteiro e, para cada tarefa, o `SKILL.md` correspondente (a tabela de skills está no `AGENTS.md`). Os agentes de `.claude/agents/` descrevem a divisão de responsabilidades, que se pode seguir à mão.

## Regras de ouro para qualquer agente

1. Ler a skill `novelo-context` antes de tocar em números: nunca inventar um valor.
2. Contrato primeiro: mudou a API, corre `just gen`; nunca editar `apps/web/src/client/` nem `openapi.json`.
3. Tabelas sempre com o `DataTable` de `apps/web/src/components/data-table`.
4. `just check` verde antes de cada push. Push direto para `main` é permitido neste hackathon (o Coolify faz deploy a cada push); por agora não há CI remota.
5. Commits em Conventional Commits, em inglês, no imperativo.

## Quando o contexto ficar velho

Se um número, um comando ou um comportamento mudar, atualiza no mesmo commit: `AGENTS.md`, a skill afetada e o doc em `docs/`.
