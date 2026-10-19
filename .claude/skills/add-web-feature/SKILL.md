---
name: add-web-feature
description: Procedimento para criar um ecrã, rota ou componente no web do Novelo (React, TanStack Router/Query, shadcn/ui, Tailwind v4, hooks hey-api). Usar em qualquer trabalho de UI.
---

# Novo ecrã ou componente

1. **Confirma o contrato:** o endpoint existe e `just gen` está feito. Os hooks vêm de `@/client/@tanstack/react-query.gen` (`xxxOptions`, `xxxMutation`, `xxxQueryKey`).
2. **Rota** em `src/routes/` (file-based; o `routeTree.gen.ts` regenera-se sozinho). Dados no `loader`: `queryClient.ensureQueryData(xxxOptions())`; no componente `useSuspenseQuery`. Filtros e estado partilhável em `validateSearch` (URL).
3. **Feature** em `src/features/<nome>/`: componentes de apresentação + hooks; lógica de negócio nunca no componente.
4. **UI:** shadcn/ui (`pnpm dlx shadcn@latest add <componente>` dentro de `apps/web`) e tokens da marca (`linho`, `tinta`, `floresta`, `pedra`, `areia`, `linha`). Títulos em Newsreader, texto em Inter, etiquetas Inter 600 maiúsculas.
5. **Tabelas: sempre `DataTable`** (`@/components/data-table`). Define `Column<T>[]` com `id`, `header`, `cell` e, para ordenar, pesquisar e filtrar, `value`; acrescenta `filter` (ou `filter: { format }` para traduzir valores), `sortable`/`searchable`/`hideable`/`defaultHidden` quando precisares, e `primary`, `badge`, `full`, `desktopOnly` para o cartão em telemóvel. Dá um `id` único à tabela (guarda colunas e linhas por página) e `controls="never"` em tabelas pequenas. Nunca uma tabela feita à mão. Estrutura da página com `Page`/`Section`.
6. **Estados obrigatórios:** a carregar (skeleton, não spinner solto), vazio (com próxima ação), erro (mensagem + tentar de novo), sucesso. Mutations com `onSuccess` a invalidar/atualizar a cache.
7. **Formatação:** `lib/format.ts` (pt-PT, sempre com unidade). Estimativas levam "estimativa".
8. **Acessibilidade e telemóvel:** foco visível, contraste AA, labels, alvos de toque ≥ 40 px, campos a 16 px (sem zoom no iOS), `aria-label` em gráficos, equivalente em tabela para cada camada do mapa.
9. **Teste:** Vitest para lógica/formatação; componente crítico com Testing Library.
10. `just check` verde; verificar no browser com `just dev` (desktop e telemóvel, que é onde a triagem corre).

Proibido: `fetch` à mão, editar `src/client/`, `any`, cores fora dos tokens, dados inventados.
