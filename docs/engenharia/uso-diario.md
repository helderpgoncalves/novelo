# Novelo para usar todos os dias: auditoria

Auditoria só de leitura, a 20 de outubro de 2026, ao código em `main` (com alterações locais de outros agentes por commitar). Objetivo: um software entregável para uso diário, com foco em **performance**, **facilidade de trabalho** e **funcionalidades à mão**. Nada foi executado (sem testes, sem stack, sem build): os tamanhos de pacotes vêm de um `apps/web/dist/` já existente (mistura de builds, por isso valem como ordem de grandeza; a confirmar com um `vite build` limpo). As linhas citadas são as do código atual.

Escala usada: impacto 1 a 5 (5 = muda a experiência diária), esforço S (menos de meio dia), M (1 a 2 dias), L (mais de 2 dias).

## 1. Resumo: as dez descobertas que mais pesam

| # | Descoberta | Onde | Impacto |
| --- | --- | --- | --- |
| 1 | **O otimizador bloqueia o event loop.** `create_scenario` é `async def` e `run_scenario` chama `compute()` (CP-SAT até 20 s mais VRP) de forma síncrona. Com 1 worker uvicorn (`entrypoint.sh`), enquanto um utilizador simula **todos** os outros pedidos, o SSE do Copiloto e o healthcheck ficam parados. Contraria a regra do `AGENTS.md` ("rotas OR-Tools são `def`"). Há 7 pontos de chamada. | `planning/service.py:350`, `planning/router.py:51`, `copilot/tools.py:846,935`, `copilot/actions.py:357,378`, `planning/whatif_service.py:237`, `planning/benchmark_service.py:110` | 5 |
| 2 | **`GET /reports` descarrega o PDF de todos os relatórios** para listar (`select(Report)` inclui `pdf: LargeBinary`). Cresce linearmente com o uso. | `reports/service.py:47`, `reports/models.py:20` | 4 |
| 3 | **`GET /scenarios` e a home carregam o JSON `result` completo** (alocações, rotas com `path`) de até 200 cenários só para mostrar KPIs que já estão desnormalizados em colunas. | `planning/service.py:379`, `textile/overview.py:197` | 4 |
| 4 | **O Copiloto vai em todas as páginas.** `Topbar` importa `CopilotLauncher`, que importa `ChatView`, `HistorySheet` e `useChat` de forma estática: o pacote do chat (reducer, composer de 793 linhas, markdown) entra no `app-frame` em cada ecrã autenticado. | `components/layout/topbar.tsx:8`, `copilot/copilot-launcher.tsx:16-19,192` | 4 |
| 5 | **A home autenticada arrasta o echarts (~688 KB, ~228 KB gzip)** por `Cascade` estático; abrir um cenário arrasta echarts (Sankey) **e** maplibre (~1,1 MB, ~298 KB gzip) porque `FlowsSankey` e `ScenarioMap` são imports estáticos da rota, mesmo no separador "Resumo". | `home/home-page.tsx:26`, `routes/_app/scenarios.$scenarioId.tsx:19,27` | 4 |
| 6 | **Nenhuma `DataTable` declara `views`** (41 tabelas) e os KPIs das páginas não são clicáveis: "lotes por reservar", "alertas abertos", "circuitos sem viatura" exigem montar o filtro à mão de cada vez. | `routes/_app/lots.index.tsx:87`, `data-quality.tsx` | 4 |
| 7 | **Lista de alertas de qualidade feita à mão** (cartões, "ver mais"): filtros de estado e tipo em `useState` (não vão para o URL, perdem-se ao recarregar), sem pesquisa, sem exportação, sem resolução em lote. É o ecrã mais usado pelo operador. | `features/quality/alerts-panel.tsx:29-30,57-110` | 4 |
| 8 | **Não existe forma de corrigir dados na app**: a API de rede (`circuits`, `fleet`, `localities`, `containers`) é só `GET`; os alertas só mudam de estado. Validar localizações, ligar viatura a circuito ou corrigir um nome obriga a editar Excel e correr `just etl`. | `network/router.py:21-51`, `datasets/router.py:27` | 5 |
| 9 | **Faltam navegação rápida e ajuda**: só ⌘K (Copiloto) e `/` na tabela; sem "Ir para…", sem pesquisa global, sem recentes, sem folha `?`. Nos menus 20 ecrãs em 6 secções; no telemóvel 4 separadores mais "Mais". | `copilot-launcher.tsx:62-70`, `lib/nav.ts`, `layout/tab-bar.tsx:17-22` | 4 |
| 10 | **O relatório RAP só se gera em `/reports`** (não do cenário nem da comparação), a seleção não vive no URL e o PDF abre com `window.open` depois de um `await`, o que o Safari e o iOS bloqueiam como pop-up. | `routes/_app/reports.tsx:57-63`, `scenarios/scenario-actions.tsx` | 4 |

Também a anotar: `docs/engenharia/testes.md:23` tem a palavra `TEMPOS` por preencher; a API de emails (`/users/emails/*`, 10 operações) está pronta e sem ecrã no web; `zod` gerado pelo hey-api (151 KB de fonte) não é importado por ninguém.

## 2. Fluxos diários por papel

Contagem de cliques a partir de uma sessão aberta no desktop, sem contar a leitura.

### 2.1 Operador

| Fluxo | Hoje | Atritos |
| --- | --- | --- |
| **Alertas de qualidade** | Menu Dados, Qualidade (2) → filtro estado "Abertos" já ativo → abrir cartão → "Resolver" (4 a 5 cliques por alerta) | Filtros em `useState` (`alerts-panel.tsx:29-30`): ao recarregar ou partilhar perdem-se; só a origem vive no URL (`routes/_app/data-quality.tsx:17-21`). Sem pesquisa, sem exportação, sem seleção em lote ("resolver todos os do tipo X"). Paginação "ver mais" de 8 em 8 (`PAGE = 8`). Estatísticas do topo não são filtros. Sem aviso quando chega um alerta novo (só o contador na página). |
| **Validar localizações** | Localidades (1 clique) e depois só leitura | Sem edição, sem marcar "validada", sem anexar correção. O mapa mostra os contentores municipais mas as localizações dos de têxteis continuam por receber (`backlog.md`). Falta "estado de validação" por ponto e a bandeira "dados em validação" (secção 6). |
| **Circuitos, viaturas, calendário** | Frota (1) com separador "Calendário" por omissão; `.ics` exportável | Bom: separadores no URL (`fleet-search`). Falta: arrastar circuito para viatura/turno (hoje só leitura), filtro por viatura/dia partilhável nos cartões do calendário, imprimir a semana. `calendar-views.tsx` tem 742 linhas e três `<table>` à mão (linhas 63, 335, 543), fora do padrão `DataTable`. |
| **Lotes e passaportes** | Operação, Lotes (2); abrir lote (3); estado (4); QR e passaporte público | Ao abrir o lote falta o atalho "imprimir etiqueta/QR" (só `qr` no URL). Estatísticas "Abertos/Por reservar" não filtram a tabela. A lista de lotes não pagina no servidor (`lots/service.py:172` carrega todos os lotes com `selectinload(Lot.items)`). |
| **Triagem por foto** | Triagem (1) → escolher/abrir lote → foto da peça → foto da etiqueta → analisar → rever → confirmar (7 a 8 passos por peça) | Dois ficheiros e dois passos por peça; repetir 50 vezes por lote é lento. Falta modo "câmara contínua" (confirmar e abrir logo a próxima), repetir última freguesia/lote, e fila offline com envio posterior. `triage-flow.tsx` mantém só `added` em memória: um recarregamento a meio perde o contexto (lote e freguesia não vão para o URL). |

### 2.2 Decisor

| Fluxo | Hoje | Atritos |
| --- | --- | --- |
| **Criar cenário** | Simulador (1) → objetivo, orçamento ou meta → "Simular" (⌘+Enter existe, `scenario-form.tsx:279`) → resultado | Bom: o URL guarda `goal`, `budget`, `target`, `name`, `from`, `r` (`simulator.tsx` `validateSearch`). Falta: pré-visualização do custo antes de correr, histórico de execuções do formulário, estado "a calcular" com tempo estimado (o `run-status` mostra segundos mas não o limite de 20 s + VRP). |
| **Comparar A/B** | Cenários (1) → selecionar 2 linhas → "Comparar" (4), ou Cenário → "Comparar" (3) | Bom: `a` e `b` no URL. Falta: comparar mais de 2, "marcar como referência" (baseline fixo), e diferenças por freguesia ordenáveis/exportáveis. O seletor lista todos os cenários sem pesquisa (`scenarios.compare.tsx` `Picker`). |
| **"E se...?"** | Cenário → separador "E se..." (3) → escrever → confirmar "Entendi" → aplicar | Bom. Falta: perguntas de reserva sugeridas (já há `demo-prep`, mas não no ecrã), histórico de perguntas por cenário visível na lista, e partilha do resultado por URL. |
| **Relatório RAP** | Relatórios (1) → escolher até 3 cenários → gerar → PDF | Seleção local (`reports.tsx` `selected`, por omissão os 2 primeiros), sem URL; sem acesso a partir do cenário ou da comparação; o PDF abre em `window.open` pós-`await` (linha 62), bloqueável. Sem pré-visualização nem estado "a gerar" com tempo (WeasyPrint corre em threadpool, mas o pedido é síncrono até 90 s no nginx). |
| **Copiloto** | ⌘K (painel) ou `/chat` | Bom: painel, threads, `@menções`. Falta: aparecer o painel com contexto do ecrã atual (cenário aberto, freguesia), perguntas sugeridas por rota, e resposta concluída com notificação quando o painel está fechado (há `useUnreadThreadIds`, mas só um ponto no botão). |

### 2.3 Administrador

| Fluxo | Hoje | Atritos |
| --- | --- | --- |
| **Utilizadores, convites, aprovações** | Admin, Utilizadores (2) com separadores | Bom: badge de pendentes no menu (`app-sidebar.tsx`) e ações em lote. O `refetchInterval` de 60 s (`use-pending-approvals.ts:13`) é o único "notificador". Falta: notificação que leve direto ao pedido, aprovar a partir da notificação. |
| **Auditoria** | Utilizadores, separador Auditoria | `audit-panel.tsx` usa paginação por `offset`/`limit` no servidor; pesquisa e filtros de utilizador/ação por URL a confirmar. Sem exportação para o servidor (só a página atual). |
| **IA e custos** | Admin, IA (2) com separadores e janela 7/30/90 dias | Bom (`admin.ai.tsx` tem `tab` e `days` no URL). Falta alerta de orçamento (limite diário atingido) como notificação. |
| **Emails** | **Sem ecrã.** 10 operações em `email_log/router.py` (resumo, lista, DNS, supressões, teste, reenvio) | O admin só vê falhas por logs. Prioridade: separador "Emails" em `/users` com `DataTable`, estado DNS e botão "enviar teste". |

### 2.4 Convidado e QR (demo)

O convidado entra por QR com papel `guest` (só leitura, limites por hora, `core/guest.py`). Atritos: o convidado vê o mesmo menu de 20 entradas (as de administração estão filtradas por `adminOnly`, o resto não); o `OnboardingTour` tem versão curta (`onboarding-tour.tsx:109`), mas não há **modo apresentação** (ecrã limpo, cenários A/B fixos, plano B offline). Os convidados não podem gerar cenários nem PDFs (`NotGuestDep`, `AiGuard`), o que corta justamente os momentos mais fortes da demo; falta um cenário A/B fixo e pré-calculado, só de leitura, aberto por omissão.

## 3. Funcionalidades escondidas ou subutilizadas

**API sem ecrã (18 operações)**, calculado cruzando `openapi.json` com os hooks do cliente usados em `apps/web/src` (excluindo `client/`):

- Emails (10): `list_emails`, `get_email`, `get_email_summary`, `get_email_dns_health`, `refresh_email_status`, `send_test_email`, `list_email_suppressions`, `create_email_suppression`, `delete_email_suppression`, `resend_user_email`.
- Convites e registo: `create_invitation_link`, `resend_registration_email`.
- Copiloto: `get_copilot_event_schema`, `get_copilot_thread_timeline` (cronologia da conversa, pronta e sem UI), `regenerate_copilot_response` (usado por `fetch` à mão em `copilot/sse.ts:88`, aceitável por ser SSE).
- Municipal: `list_municipal_containers` (os contentores individuais; o ecrã só mostra locais e mapa).
- Webhook `receive_resend_webhook` e `google_callback` são de servidor, não contam.

**Só acessíveis pelo Copiloto** (ferramentas sem ecrã equivalente): `get_data_gaps` (o que falta para decidir), `explain_scenario_difference` (explicação textual da comparação), `explain_assumption`, `get_user_stats`, `get_ai_usage`, `analyze_attachment` (tabelas carregadas), `memory`/`session_search`. O melhor candidato a sair do Copiloto é `get_data_gaps`: é precisamente a lista "o que fazer a seguir" que falta na home do operador.

**Telas sem entrada visível no menu**: `/chat/shared/$token` (partilha, correto), `/lots/$code` (via lista), `/scenarios/compare` (só por botão na lista/cenário; sem entrada no menu, o que é aceitável mas sem atalho `g c`). `/pilot` e `/assumptions` ficam em "Planeamento" mas não são citados no `StarterChecklist` nem no tour (passos: welcome, simulator, scenarios, copilot, map, data, report, users, help, finish).

**O que a plataforma sabe e não mostra**:
- Alertas de qualidade abertos não aparecem na home nem no menu (só em Dados, Qualidade); falta um selo no item de menu como o das aprovações.
- `Report.summary` e a versão dos parâmetros por relatório não são mostrados no histórico.
- A versão dos pressupostos (`parameter_set_version`) que gerou cada cenário não é comparada com a atual: falta "este cenário foi calculado com pressupostos antigos" (v. `Scenario.parameter_set_version`).
- O custo do Copiloto por utilizador existe em `ai_admin`, mas o utilizador não vê o seu consumo.
- `data/processed/municipal_alerts.csv` (alertas municipais) mistura-se com os de têxteis só através de `origin`; a distinção devia ser um separador, não um filtro.

## 4. Performance web

### 4.1 Pacotes (medidos em `apps/web/dist/assets`, sem build novo)

| Pacote | Tamanho | Gzip | Quem o carrega |
| --- | --- | --- | --- |
| `index-*.js` (entrada) | 399 KB | 125 KB | Todas as rotas (React, router, query, zod, cliente) |
| `base-map-*.js` (maplibre) | 1,11 MB | 298 KB | Mapa, cobertura, cenário (qualquer separador), frota (separador Mapa) |
| `echarts-*.js` | 688 KB | 228 KB | Home autenticada, cenário (Sankey), frota (carga), municipal, IA admin, Copiloto (lazy) |
| `app-frame-*.js` | 70 KB | 22 KB | Todas as rotas autenticadas (inclui o Copiloto: ver 4.2) |
| `reducer-*.js`, `use-chat-*.js` | 83 KB, 63 KB | 25 KB, ~20 KB | Chat (arrastados pelo `app-frame`) |
| `fleet`, `users`, `data-table` | 87, 72, 87 KB | 23, 19, 25 KB | Por rota (bem) |
| CSS `index` | 171 KB | n/d | Todas |

Boas decisões já tomadas, a manter: `autoCodeSplitting` do TanStack Router, landing e home em pacotes separados (`routes/index.tsx:20-23`), `manualChunks` do echarts, service worker só com sessão (`lib/pwa.ts`), precache mínimo sem echarts/maplibre/landing (`vite.config.ts` `globIgnores`), cache imutável para `/assets/` e `/landing/*.hash`, gzip no nginx, `defaultPreload: 'intent'` com `ensureQueryData` nos loaders (a pré-carga ao passar o rato também aquece os dados).

### 4.2 Problemas e correções

| # | Problema | Ficheiro:linha | Impacto estimado | Correção |
| --- | --- | --- | --- | --- |
| W1 | **Copiloto no `app-frame`.** Imports estáticos de `ChatView`, `HistorySheet`, `useChat`, `ChatHeader`. O painel só abre com ⌘K, mas o código vai em todas as páginas. | `copilot/copilot-launcher.tsx:11-19`, `layout/topbar.tsx:8` | -50 a -90 KB gzip no primeiro ecrã autenticado; primeira pintura mais rápida em 4G | Partir `CopilotLauncher` em botão (leve) + `CopilotPanel` com `lazy()`; carregar no primeiro ⌘K/clique e fazer `import()` em `requestIdleCallback` depois do `load` (como o SW). Manter `useChat`/`useIsGenerating` fora do botão (ler de `store.ts` sem importar o reducer). |
| W2 | **Home com echarts estático** (`Cascade`). A primeira página depois do login paga 228 KB gzip. | `home/home-page.tsx:26,130`; `home/cascade.tsx:1-13` | -228 KB gzip no arranque da home; LCP melhor | `const Cascade = lazy(() => import('./cascade'))` com `Suspense` e esqueleto da altura do gráfico; ou renderizar o Sankey em SVG (é de 3 colunas). |
| W3 | **Cenário: maplibre e echarts no separador Resumo.** `ScenarioMap` e `FlowsSankey` são imports estáticos da rota. | `routes/_app/scenarios.$scenarioId.tsx:19,27,126,159` | -300 a -500 KB gzip ao abrir um cenário | `lazy()` de `ScenarioMap` e `FlowsSankey`; `PageTabs` já só monta o separador ativo (confirmar). Pré-carregar o chunk do mapa quando o rato passa em "Rede". |
| W4 | **O loader do cenário bloqueia a primeira pintura** com 3 pedidos (`scenario`, `flows`, `zones`). `flows` só serve o Sankey do Resumo. | `routes/_app/scenarios.$scenarioId.tsx:36-43` | -1 pedido em série na pintura; `zones` (com geometria) já está em cache nas outras rotas | Tirar `flows` do loader, usar `useQuery` dentro do Sankey com esqueleto; `ensureQueryData` só do cenário. |
| W5 | **Home faz 5 pedidos paralelos que bloqueiam o desenho**, depois de `beforeLoad` com sessão. | `routes/index.tsx:41-48` | O pior pedido (`overview`, 10+ consultas SQL, ver A5) manda no LCP | Devolver o `overview` ao loader e passar `observed flows`, `waste` e `zones` a `prefetchQuery` sem `await`, com secções em `Suspense`. |
| W6 | **`staleTime` de 60 s igual para tudo.** Dados de referência (zonas com geometria, pressupostos, baseline, circuitos) mudam raramente e são pedidos de novo a cada minuto. | `lib/query-client.ts:14` | Menos pedidos e menos bytes (as zonas levam `geometry`) | `staleTime: 10 * 60_000` e `gcTime` maior em `listZonesOptions`, `getPlanningParametersOptions`, `getTextileBaselineOptions`, `listCircuitsOptions`, `listLocalitiesOptions`, `getFleetOptions`; invalidar em `update_planning_parameters`. Combinar com ETag no servidor (A4). |
| W7 | **Tabelas com 2 751 locais** usam `useInfiniteQuery` + `useAllPages` (carrega todas as páginas) e filtra no cliente; a paginação do `DataTable` é de 10 em 10 sem virtualização. | `features/municipal/sites-tab.tsx:61-68`; `components/data-table/data-table.tsx:140` | Com 3 000 linhas, `useTableState` normaliza texto de todas as linhas em cada mudança (`use-table-state.ts:151`) | Já está em "Adiado" no backlog; promover só o caso municipal: filtragem no servidor (a API já aceita filtros) ou virtualização com `@tanstack/react-virtual` quando `rows.length > 500`. |
| W8 | **Gerador `zod` inútil.** O plugin gera 151 KB de `zod.gen.ts` que nada importa; atrasa `just gen` e `check-contract`. | `apps/web/openapi-ts.config.ts:11` | -1 a -2 s por geração/verificação; menos ruído | Retirar `'zod'` do config (o Zod do runtime continua para formulários e `validateSearch`). Confirmar com `grep -r "client/zod" src` (hoje zero). |
| W9 | **Mapa: sem pré-carga.** O worker e o estilo do maplibre só arrancam quando o mapa monta. | `features/map/base-map.tsx:1-11` | ~300 KB e 1 a 2 s no primeiro mapa | `<link rel="prefetch">` do chunk em `requestIdleCallback` depois do login (como W1) e `onMouseEnter` no item de menu "Mapa"/"Cobertura". |
| W10 | **`useMemo` sem `memo` nas linhas.** 76 `useMemo` e nenhum `React.memo` no web; as células de `DataTable` recalculam ao teclar na pesquisa. | `components/data-table/*` | Pouco visível com 40 a 80 linhas; visível no municipal | Só depois de medir (React Profiler); a prioridade é W7. |
| W11 | **Imagens da landing** pesam 8,3 MB em `dist/landing` mas são servidas só a visitantes, com AVIF/WebP e cache imutável. | `nginx.conf` blocos `/landing/` | Nenhum para o uso diário | Nada a fazer. |
| W12 | **Fontes** (772 KB em `dist/fonts`) são subsets; confirmar `font-display: swap` e `preload` só das duas usadas na app autenticada (Inter normal e Newsreader). | `src/styles.css`, `index.html` | Pequeno | Auditar `@font-face`. |

### 4.3 Service worker e offline

`registerType: 'prompt'` e precache mínimo (`vite.config.ts:92-117`) estão certos. O offline útil falta: a API nunca é cacheada (`navigateFallbackDenylist: /api/`), por isso, sem rede, a app abre mas não mostra nada. Para o operador no terreno, ver P10 (fila de triagem offline) e P8 (modo apresentação com cenário A/B em `localStorage`/Cache API).

## 5. Performance da API

Estado a 20 de outubro de 2026: A1, A3, A4 feitos; A5, A6, A7, A11 feitos em parte (ver a coluna Problema); A2, A8, A9, A10, A12, A13 por fazer. Detalhe em [Arquitetura, Desempenho da API](arquitetura.md#desempenho-da-api). Medido num cenário real (60 000 €/ano): o cenário completo pesa 29 KB e a lista passa a 326 bytes sem ler o `result`; um solver que dorme 1 s atrasava o loop 1,00 s antes e já não o atrasa; `GET /planning/zones` fazia 10 consultas e 57 KB, e o 304 faz só a leitura de versão (3 consultas com a sessão, 13 ms contra 303 ms).

| # | Problema | Ficheiro:linha | Impacto | Correção |
| --- | --- | --- | --- | --- |
| A1 | **FEITO.** **Solver bloqueia o event loop** (descoberta 1). `compute()` é síncrono dentro de `async def run_scenario`. `SolverGuard` limita a concorrência (`solver_max_concurrency=2`), mas não tira o trabalho do loop. `sensitivity_service.py:108,124` e `pilot_service.py:218` já usam `asyncio.to_thread`: está feito a meio. | `planning/service.py:350`; chamadores listados em 1 | Pedido de 20 s a 30 s congela API inteira (login, SSE, healthcheck do Coolify pode reiniciar o contentor) | `result, status = await asyncio.to_thread(compute, zones, params, request, baseline.total_t)` na linha 350. Um teste que corre dois pedidos em paralelo e mede que `/health` responde enquanto o solver corre. Vale também para `copilot/tools_data.py:280`. |
| A2 | **Sem cache de cenários determinísticos.** `random_seed` fixo e `num_workers=1` (`domain/network.py:246-247`): a mesma entrada dá o mesmo cenário, mas cada pedido volta a pagar 20 s + VRP e grava uma linha nova. | `planning/service.py:345-376` | Demo e ensaios: o mesmo A/B repetido custa 20 s e polui a lista | Chave `sha256(zonas relevantes + params + request + versão do modelo)`; coluna `input_hash` indexada em `scenarios` (migração `0012`); se existir, devolve o existente (ou cria nova linha apontando `parent_id`). Medir: taxa de acertos e p95 de `POST /scenarios`. |
| A3 | **FEITO.** **`GET /reports` lê o PDF** (descoberta 2). | `reports/service.py:47` | Crescimento ilimitado em memória e rede | `select(Report).options(defer(Report.pdf))`; `get_pdf` carrega só o campo. Ou mover os PDF para ficheiro/objeto. |
| A4 | **FEITO** (zonas, pressupostos, base têxtil, rede; `core/http_cache.py`). **Dados quase estáticos sem `ETag`/`Cache-Control`.** O módulo municipal já tem a infraestrutura (`municipal/http.py` com `Cache`, `StaticCache`, `stamp`, gzip em cache); `textile`, `planning/zones`, `planning/parameters`, `network/*` e `datasets/quality` não a usam. `GET /planning/zones` devolve geometria de todas as freguesias e é pedido por 6 rotas. | `planning/router.py:44`, `textile/router.py:26-45`, `network/router.py:21-51` | Cada navegação refaz 4 a 10 consultas e reenvia KBs de geometria | Generalizar `Cache` para `core/http_cache.py` e aplicar com ETag derivado de `max(updated_at)` das tabelas (ou da versão do seed + `ParameterSet.version`). O nginx já faz gzip das respostas JSON. |
| A5 | **FEITO em parte:** a home já não abre o `result` (coluna `modes`); a cache de processo com TTL ficou por fazer. **`/textile/overview` (home) corre 10+ consultas e carrega `Scenario.result` inteiro** para até 200 cenários, 2 vezes por visita. | `textile/overview.py:150-232`, `:197` | Home lenta com 50+ cenários | `select(Scenario).options(load_only(...colunas de KPI...))` mais uma coluna `modes_json` pequena (ou calcular `modes` a partir de `jsonb_path_query` no SQL); colocar o resultado em cache de processo com TTL de 30 s e chave pela última escrita em `scenarios`. |
| A6 | **FEITO em parte:** `defer` e índice `ix_scenarios_created_at` (migração `0012`); `limit`/`cursor` ficaram por fazer (mudariam o contrato). **`list_scenarios` sem paginação e a carregar `result`** (descoberta 3). | `planning/service.py:378-380` | Dezenas de MB a 200 cenários | `defer(Scenario.result)`, ordenar por `created_at` com índice (`ix_scenarios_created_at`, não existe hoje) e parâmetros `limit`/`cursor`. |
| A7 | **FEITO em parte:** contagem e peso em SQL e `GET /brands` com `load_only`; paginar ficou por fazer (mudaria o contrato); `market` continua a precisar das composições. **`list_lots` carrega todos os lotes e itens** e calcula agregados em Python. | `lots/service.py:172-190` | Lento a partir de 500 lotes | Agregados em SQL (`func.count`, `func.sum`) por `lot_id`; paginar; o índice `ix_lots_state_dominant_fibre` já existe. |
| A8 | **`load_zone_rows` repete 4 consultas** em cada chamada e o Copiloto chama `list_zones` várias vezes por conversa (`copilot/tools.py:792`, `actions.py:181`, `tools_data.py:156`). | `planning/service.py:75-125` | Pequeno por chamada; multiplica nas conversas | Cache em processo com invalidação por `ParameterSet.version` e `Container`/`Circuit` `updated_at` (TTL curto). |
| A9 | **Um único worker uvicorn.** Escolha consciente (limites em memória), mas junta-se a A1. | `apps/api/entrypoint.sh` | Sem isolamento entre solver e SSE | Primeiro A1; depois `WEB_CONCURRENCY=2` só quando o limitador passar a Redis/Postgres (backlog "Adiado"). Alternativa: executor de processos dedicado para o solver (`ProcessPoolExecutor(max_workers=SOLVER_MAX_CONCURRENCY)`), que também isola memória do OR-Tools. |
| A10 | **Pool de ligações.** `pool_size=10` com `max_overflow` por omissão (10) e SSE longo (300 s) que pode manter uma sessão aberta. | `core/database.py:13` | Esgotamento com alguns Copilotos em simultâneo | Confirmar que o handler SSE fecha a sessão antes de `yield` ao stream (ou usa sessões por ferramenta); expor `db_pool_in_use` em `/ready`. |
| A11 | **FEITO só para `scenarios.created_at`;** `data_alerts(status, kind)` não se criou: nenhuma consulta filtra por esses campos (o filtro é no cliente). **Sem índice em `scenarios.created_at`** nem em `data_alerts(status, kind)` (filtros do ecrã de qualidade). | `planning/models.py`, `datasets/models.py` | Irrelevante hoje, relevante a partir de milhares de linhas | Migração `0012` com `ix_scenarios_created_at` e `ix_data_alerts_status_kind`. |
| A12 | **Compressão só no nginx** (`gzip_comp_level 5`); em dev e fora do nginx não há. Sem brotli (imagem oficial). | `nginx.conf` | Pequeno | Aceitável. Para brotli, imagem `nginx` com módulo ou Cloudflare em frente (a Cloudflare já é usada). |
| A13 | **SSE do Copiloto.** Bem configurado no nginx (`proxy_buffering off`, `gzip off`, 300 s). Riscos: depende do loop não estar bloqueado (A1) e não há `heartbeat` documentado para ligações atrás de Cloudflare (100 s de inatividade). | `nginx.conf` bloco `copilot/stream`; `copilot/router.py:140-160` | Cortes silenciosos em respostas longas com ferramentas | Enviar comentário SSE `: ping` a cada 15 s; o web já tem `stream-manager` com retoma, confirmar. |

## 6. Desenvolvimento e manutenção

### 6.1 Tempos e verificação

- Alvos documentados: `check-fast` abaixo de 90 s, `check` abaixo de 5 min (`AGENTS.md`, `justfile`). **A secção "Tempos medidos" de `docs/engenharia/testes.md:21-23` está por preencher (`TEMPOS`).** Medir uma vez (`time just check-fast`, `time just check`) e escrever a tabela; sem isso a meta é uma promessa.
- O VRP é cortado a 250 ms no `check-fast` e o CP-SAT não; o `check` completo fica ligado ao tempo real do solver (20 s + 2 s×modos por cenário). Com A2 (cache) e dois ou três cenários partilhados entre testes (`session`-scoped), o `check` desce vários minutos.
- Dois jobs a competir pelo mesmo Postgres de dev (`:5590`) e a máquina "sobrecarregada": `parallel.sh` devia aceitar `JOBS=N` para limitar e imprimir o pico de memória.
- `just dev` exige Docker; para iterar só na UI com a API já a correr, falta `just web-only` (Vite com `API_PROXY_TARGET` apontado para produção ou staging). Também falta `just logs-prod`/`just prod-health` para diagnóstico (o `deploy-coolify` skill descreve-o mas não há alvo).
- `just ui` instala e depois corrige o pacote errado do CLI (`sed` e `pnpm remove cn`): frágil, mas documentado.

### 6.2 Ficheiros gigantes (> 600 linhas) a dividir

| Ficheiro | Linhas | Divisão proposta |
| --- | --- | --- |
| `api/features/copilot/tools.py` | 1 219 | Um módulo por grupo (`tools_planning`, `tools_lots`, `tools_admin`); já existem `tools_data.py` (670) e `tools_ui.py` (554). O dicionário de rótulos `status.*` (linhas 291-344) vai para `tools_status.py`. |
| `api/ai/eval_copilot.py` | 909 | Separar harness, casos e relatório. |
| `api/features/copilot/agent.py` | 905 | Ciclo do agente, montagem do prompt e política de ferramentas. |
| `web/components/data-table/data-table.tsx` | 895 | Extrair barra de ferramentas, estado de teclado (`:325`), mobile em cartões e rodapé (alguns já existem: `toolbar`, `pagination`, `views-menu`). |
| `api/adapters/openrouter.py` | 817 | Cliente HTTP, validação JSON e contabilização de custos. |
| `web/features/copilot/composer.tsx` | 793 | Anexos, `@menções`, comandos `/` e área de texto. |
| `api/features/copilot/actions.py` | 793 | Uma função por ação num registo, mais o ciclo propor/confirmar/anular. |
| `web/features/copilot/artifacts/chart-options.ts` | 771 | Um ficheiro por tipo de gráfico. |
| `api/features/auth/emails.py` | 750 | Modelos HTML por email; texto em `.html`/`.txt` carregados do disco. |
| `web/features/fleet/calendar-views.tsx` | 742 | Três vistas, três ficheiros (e `DataTable` onde fizer sentido). |
| `api/features/copilot/router.py` | 725 | Rotas de threads, memória, ações e streaming em routers separados. |
| `web/features/copilot/thread-list.tsx` (647), `simulator/scenario-form.tsx` (644), `fleet/schedule.ts` (595) | | Dividir por responsabilidade quando se mexer. |

### 6.3 Duplicação e padrões fora da casa

- **Tabelas**: 41 usos de `DataTable`, mas ainda há `<table>` à mão em `fleet/calendar-views.tsx` (3), `fleet/mini-week.tsx`, `fleet/occupancy-heatmap.tsx` e a lista de alertas (cartões). Os de calendário são legítimos (grelha); o resto pode migrar.
- **Diálogos e folhas**: seis diálogos de administração em `features/users/*-dialog.tsx` (aprovar, rejeitar, desativar, apagar, papel, impersonar) com estrutura quase igual; extrair `ConfirmActionDialog` com `title`, `description`, `confirmLabel`, `tone`, `requireText` (já há `confirm-check.tsx`). Há também `Sheet` próprio em `fleet/detail-sheet.tsx`, `municipal/site-sheet.tsx` e `copilot/history-sheet.tsx` com o mesmo cabeçalho.
- **KPIs**: `StatStrip`/`StatCell` bem usados em todos os ecrãs; falta a variante clicável (`onSelect`) que aplique um filtro (ver P3).
- **Tokens**: o cartão `AccountCard` usa `shadow-none ring-1 ring-foreground/10` à mão (`routes/_app/account.tsx`); o mesmo ringue repete-se em `reports.tsx`, `scenarios.$scenarioId.tsx` (Collapsible) e outros. Um `Card`/`Panel` único com variante evita desvios (`components/panel.tsx` existe).
- **Cor literal** `text-[#14211d]` no badge de pendentes (`app-sidebar.tsx`); usar o token da marca.
- **Tipos**: `AlertOrigin` e `originOf` vivem em `alerts-panel.tsx`; tipos de filtro por separador repetidos em `fleet-search`, `data-quality`, `circuits`; um helper `tabSearch(['a','b'] as const)` evita repetir `z.enum(...).optional().catch(undefined)` (8 rotas).

### 6.4 Testes em zonas críticas

Sem executar nada: lê-se no backlog 536 pytest, 157 Vitest e 162 Playwright. Lacunas prováveis a verificar: (a) teste de que o `/health` responde com o solver a correr (A1); (b) `list_reports` sem carregar o PDF (A3); (c) idempotência do `input_hash` (A2); (d) rotas web sem Vitest (`lots.$code`, `reports`, `triage-flow`); (e) migrações (`0011_email_deliveries`) com `upgrade`/`downgrade` num teste.

### 6.5 Documentação desatualizada

- `docs/engenharia/testes.md:21-23`: `TEMPOS` por preencher.
- `docs/engenharia/backlog.md` diz "46 ferramentas" no Copiloto e 536/157/162 testes: reconfirmar depois de cada marco (a lista `tools.py` tem mais de 50 entradas em `_STATUS`).
- `docs/engenharia/emails.md` descreve os emails; falta a secção do ecrã de administração quando existir.
- Este documento deve entrar no índice `docs/README.md`.

### 6.6 Observabilidade

Existe: logs JSON com `request_id` (`core/logging.py`), `x-request-id` na resposta, o web guarda o id do último pedido falhado e mostra-o no ecrã de erro (`lib/api-config.ts:42`, `features/errors/server-error-screen.tsx:11`), `/health` e `/ready` (BD, IA, email).

Falta:
1. **Erros do browser sem relatório**: não há `window.onerror`, `unhandledrejection` nem `ErrorBoundary` que envie nada (`grep` zero). Um `POST /api/v1/client-errors` (público, com limite e sem dados pessoais) mais `navigator.sendBeacon` ligado a `RouteError` e a `main.tsx` fecha o ciclo.
2. **Métricas** (**feito** para o log: `route`, `duration_ms`, `status` e, em debug, `queries` no registo de cada pedido; falta um `/metrics` e `user_role`): sem contagem por rota/tempo/erros. Um endpoint `/metrics` Prometheus ou, mais barato, linhas de log com `duration_ms`, `route` (modelo, não URL) e `user_role` já ajudam a medir p95. O `RequestLoggingMiddleware` regista `scope["path"]` com ids em bruto, o que impede agregar; usar `scope["route"].path`.
3. **Custo e duração do solver** em log estruturado (`solver_ms`, `vrp_ms`, `status`, `zones`) para dimensionar `SOLVER_TIME_LIMIT_S`.
4. **Alertas**: Coolify faz healthcheck a `/health`, que não deteta A1 (responde só se o loop estiver livre; é bom, mas o contentor reinicia durante o solver). Separar `liveness` do solver (A1) é a correção.

## 7. Propostas de "software de todos os dias"

Ordenadas por valor sobre esforço. "Depende" refere itens desta lista ou da secção 8.

| # | Proposta | Impacto | Esforço | Risco | Depende | Onde entra | Como medir |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | **Paleta "Ir para…" e atalhos estilo Linear.** ⌘K continua a ser o Copiloto; **⌘P** (ou `g` seguido de tecla: `g h` home, `g s` simulador, `g c` cenários, `g l` lotes, `g q` qualidade, `g m` mapa, `g f` frota) abre uma paleta com a lista de `NAV` (já é uma fonte única, `lib/nav.ts`), cenários recentes e ações ("Novo cenário", "Abrir lote", "Gerar RAP"). Folha de ajuda `?` com todos os atalhos (a do Copiloto, `empty-chat.tsx:26`, e a da tabela, `/`, passam a viver aí). | 5 | M | Baixo (⌘P no Chrome imprime: `preventDefault`; oferecer `g`+tecla como alternativa) | W1 (para não pesar) | Novo `features/command/command-palette.tsx` com `cmdk` (já existe `components/ui`? senão `command.tsx` do shadcn), montado em `app-frame.tsx`; atalhos num `useHotkeys` único em `lib/hotkeys.ts` (hoje há 4 `keydown` dispersos: `copilot-launcher.tsx:62`, `scenario-form.tsx:279`, `data-table.tsx:325`, `onboarding-tour.tsx:220`). | Ações por sessão iniciadas pela paleta; tempo até ao primeiro clique em "Simulador" após login; contagem de `?`. |
| P2 | **Pesquisa global** na paleta: cenários (etiqueta), freguesias (nome/código), lotes (código), marcas, utilizadores (admin), localidades, alertas. | 5 | M | Baixo | P1 | API: `GET /api/v1/search?q=` em `features/search/{router,service,schemas}.py` com `ILIKE`/`unaccent` e limite por tipo (5); índices GIN ou `pg_trgm` onde fizer falta. O Copiloto já tem `search_data` e `search_copilot_mentions` (`@menções`): reaproveitar a lógica em vez de duplicar. Resultado com `type`, `title`, `to`, `params`. | Latência p95 < 150 ms; percentagem de pesquisas com clique no primeiro resultado. |
| P3 | **Vistas guardadas e KPIs clicáveis.** `views` declaradas em cada `DataTable` (ex.: Lotes: "A recolher", "Por reservar"; Qualidade: "Abertos de têxteis"; Circuitos: "Sem viatura"; Utilizadores: "Pendentes"); `StatCell` com `onSelect` que aplica a vista. | 4 | S | Baixo | nenhuma | `components/stat-strip.tsx` (prop `onSelect`/`href`), `routes/_app/lots.index.tsx`, `circuits.tsx`, `data-quality.tsx`, `features/users/*`. A infraestrutura de vistas já existe (`use-table-state.ts:56,90`, `views-menu.tsx`). | Cliques até à lista filtrada (de 4 para 1); percentagem de visitas a lotes/alertas com vista aplicada. |
| P4 | **Qualidade de dados como fila de trabalho**: migrar `alerts-panel` para `DataTable` (colunas tipo, entidade, estado, data; filtros, pesquisa, exportação; `renderExpanded` para sugestão e resolução; `bulkActions` "Resolver", "Não corrigir"); contador de abertos no menu. | 5 | M | Baixo | P3 | `features/quality/alerts-panel.tsx` (reescrita), `alert-card.tsx` passa a `renderExpanded`; `lib/nav.ts` badge `open-alerts`; API: `GET /datasets/quality/summary` leve para o badge. Reaproveitar `suggest_alert_resolution`. | Tempo para zerar alertas; alertas abertos > 7 dias; cliques por alerta (de 4 para 1 em lote). |
| P5 | **Editar e validar dados na app** (localidades, circuito-viatura, ponto de contentor): formulário com `PATCH`, estado `validated_by`/`validated_at`, histórico na `audit`. Importação de CSV/Excel com pré-visualização e erros por linha. | 5 | L | Médio (fonte de verdade passa a ser a BD, não o Excel; decidir com a Vitrus; `data/raw` continua imutável) | Decisão de produto; A11 | API: `PATCH /network/localities/{id}`, `/network/circuits/{code}/vehicle`, `POST /network/containers/import` em `network/router.py` + `network/service.py`; migração `0012`; `audit.service` já regista ações. Web: edição inline no `DataTable` (colunas `editable`) e folha lateral. Import: `features/data-import/` com `analyze_table` (já existe no Copiloto, `copilot/tools.py:1174`). | Pontos validados / totais; tempo médio entre alerta e correção. |
| P6 | **Centro de notificações**: sino no `Topbar` com aprovações pendentes, falhas de email, alertas de dados novos, cenário concluído, resposta do Copiloto, limite de IA atingido. Hoje é um `refetchInterval` de 60 s só para aprovações. | 4 | M | Baixo | nenhuma | API: `GET /api/v1/notifications` (derivadas, sem tabela nova: contagem de pendentes, `EmailDelivery` com falha, `DataAlert` abertos novos, `AiUsage` acima do limite) e `PATCH` para "lido" (tabela `notification_reads`); SSE opcional. Web: `features/notifications/` + `components/layout/topbar.tsx`; reutilizar `use-pending-approvals.ts`. | % de aprovações em menos de 1 h; nº de falhas de email visíveis ao admin em < 5 min. |
| P7 | **Recentes e favoritos**: últimos 8 cenários/lotes/vistas visitados e fixar itens na paleta e no menu. | 3 | S | Baixo | P1 | `localStorage` por utilizador (com `try/catch`) em `lib/recents.ts`; escrita nos loaders de `scenarios.$scenarioId.tsx` e `lots.$code.tsx`; mostrar na paleta e na home. Fase 2: tabela `user_pins` para sincronizar entre dispositivos. | Cliques médios para reabrir um cenário; adoção (% utilizadores com ≥ 1 favorito). |
| P8 | **Modo apresentação / demo**: botão (ou `?demo=1`) que esconde ruído (onboarding, banners, tour), fixa os cenários A e B, abre o comparador com A/B, mostra o relatório pré-gerado, tem plano B local (dados em `Cache API`) e relógio de 2 minutos. O convidado QR abre diretamente neste modo. | 5 (para a entrega) | M | Baixo | A2 (cenários fixos reproduzíveis) | Web: `features/demo/` (guião em passos, como `onboarding/steps.ts`), flag no `session-hint` e CSS que oculta `StarterChecklist`/`OnboardingTour` (`app-frame.tsx:74-75`); API: `POST /planning/demo/seed` que cria/reaproveita A e B pelo `input_hash`; `demo-prep` skill já descreve perguntas de reserva. | Ensaio de 2 min sem passos manuais; zero pedidos ao solver durante a demo. |
| P9 | **Relatório e impressão em todos os ecrãs**: botão "Gerar RAP" no cenário e na comparação (pré-seleciona os cenários); PDF por `<a download>` com URL devolvido (corrige o pop-up); folha `@media print` para cenário, comparação, frota e lote (etiqueta QR). | 4 | S a M | Baixo | nenhuma | `scenarios/scenario-actions.tsx`, `scenarios/compare-view.tsx`, `routes/_app/reports.tsx:57-63` (trocar `window.open` por link/`Dialog` com "Descarregar"), `styles.css` (`@media print`). | % de relatórios gerados a partir do cenário; zero queixas de pop-up bloqueado. |
| P10 | **Triagem de campo**: modo contínuo (confirmar e abrir logo a próxima câmara), repetir lote e freguesia, fila offline com reenvio (IndexedDB), compressão de imagem no cliente (`lib/image.ts` já existe). | 4 | M | Médio (offline e uploads) | nenhuma | `features/triage/triage-flow.tsx` (`added`, `lotCode`, `parish` para URL/estado persistido), `photo-input.tsx`, SW com `BackgroundSync` simples; API `POST /triage` já tem limite (`triage_limiter`). | Peças por hora por operador; % de peças enviadas offline com sucesso. |
| P11 | **Exportações em todos os ecrãs**: `DataTable` já exporta CSV/XLSX/JSON; faltam gráficos (PNG/CSV), mapas (GeoJSON do que se vê), calendário (`.ics` já existe) e o Sankey (CSV dos fluxos). | 3 | S | Baixo | nenhuma | `features/home/*`, `scenarios/*`, `components/data-table/export.ts` como modelo. | Nº de exportações por semana por ecrã. |
| P12 | **Onboarding por papel e ajuda contextual**: o tour já existe (`steps.ts` com `BY_ROLE`); acrescentar uma checklist de operador com 5 tarefas reais (resolver 3 alertas, abrir um lote, triar 3 peças) e ícone "?" por ecrã com 2 linhas e ligação à doc. | 3 | S a M | Baixo | P1 (`?`) | `onboarding/steps.ts`, `starter-checklist.tsx`, novo `components/help-hint.tsx` com texto vindo de `messages/`. | % de novos utilizadores que concluem a checklist; tempo até ao primeiro lote. |
| P13 | **Histórico/versões e comentários de cenários**: `parent_id` já liga as versões; mostrar árvore "versões" no cenário, diferença para o pai, e comentários por cenário com menção. | 3 | M | Baixo | A6 | `planning/models.py` (`scenario_comments`), `planning/router.py` (`GET/POST /scenarios/{id}/comments`), `features/scenarios/version-tree.tsx`. | Cenários com ≥ 1 comentário; decisões registadas por mês. |
| P14 | **Bandeira "dados em validação"**: etiqueta no cabeçalho de qualquer KPI baseado em pressupostos por validar (custos unitários, 0,7 kg/hab/mês, depósito) e a lista "o que falta" vinda de `get_data_gaps`. | 4 | S | Baixo | nenhuma | `ParamMeta.source` já distingue `ASSUMPTION`; `components/stat-strip.tsx` (`tag` existe com "estimativa"); novo endpoint `GET /planning/data-gaps` reutilizando `copilot/tools_data.py`. | Nº de KPIs com etiqueta; resposta da Vitrus às perguntas pendentes. |
| P15 | **Ecrã de administração de emails** (API pronta): estado do domínio, últimos envios, supressões, teste. | 3 | S | Baixo | nenhuma | `features/users/` novo separador "Emails" com `DataTable` sobre `list_emails`; `getEmailSummaryOptions`; `useEmailHealth` no menu. | Falhas de email detetadas pelo admin em < 5 min. |

## 8. Top 15 ações por ordem de execução

Cada passo diz o que cada agente faz. A coluna "Paralelo" indica quais podem correr em simultâneo sem colidir por pasta.

| # | Ação | Agente | Ficheiros / pastas | Paralelo com |
| --- | --- | --- | --- | --- |
| 1 | **Tirar o solver do event loop** (A1) e teste de `/health` durante a simulação. | `api-engineer` (com `optimization-engineer` para `copilot/tools_data.py:280` e `domain/`) | `apps/api/src/novelo/features/planning/service.py`, `copilot/tools_data.py`, `apps/api/tests/api/` | 2, 3, 4, 5 |
| 2 | **Corrigir cargas gigantes**: `defer(Report.pdf)`, `defer(Scenario.result)` em listagens e overview (A3, A5, A6); índices (A11), migração `0012`. | `api-engineer` | `features/reports/`, `features/planning/service.py` (só linhas 378-380; coordenar com 1), `features/textile/overview.py`, `apps/api/alembic/versions/` | 3, 4, 5 |
| 3 | **Pacotes**: Copiloto lazy (W1), Cascade lazy (W2), mapa e Sankey lazy no cenário (W3), loader sem `flows` (W4), `staleTime` de referência (W6), retirar `zod` do gerador (W8). | `web-engineer` | `apps/web/src/components/layout/topbar.tsx`, `features/copilot/copilot-launcher.tsx`, `features/home/home-page.tsx`, `routes/_app/scenarios.$scenarioId.tsx`, `lib/query-client.ts`, `openapi-ts.config.ts` | 1, 2, 4, 5 |
| 4 | **Medir e documentar**: correr uma vez `just check-fast`/`just check` e preencher `testes.md:23`; `vite build` com `nice` para uma pasta temporária e registar o tamanho antes/depois do passo 3. | `devops` | `docs/engenharia/testes.md`, `justfile` (`web-only`, `prod-health`), `scripts/parallel.sh` | 1, 2, 3 |
| 5 | **Cache HTTP genérico** (A4): `core/http_cache.py` a partir de `municipal/http.py`, `ETag` e `Cache-Control` em zonas, parâmetros, baseline, circuitos, frota. | `api-engineer` | `apps/api/src/novelo/core/`, `features/{textile,planning,network}/router.py` | 3, 4 (depois de 1 e 2) |
| 6 | **Cache de cenários determinísticos** por `input_hash` (A2) e cenários A/B de demo reproduzíveis. | `optimization-engineer` + `api-engineer` | `features/planning/service.py`, `models.py`, migração; `domain/network.py` só leitura | 7, 8 (depois de 1) |
| 7 | **Vistas e KPIs clicáveis** (P3) e **fila de qualidade em `DataTable`** (P4), com badge de alertas no menu. | `web-engineer` (+ `api-engineer` para `GET /datasets/quality/summary`) | `components/stat-strip.tsx`, `routes/_app/{lots.index,circuits,data-quality}.tsx`, `features/quality/`, `lib/nav.ts`; API `features/datasets/` | 6, 8, 9 |
| 8 | **Paleta "Ir para…", `?` e hotkeys centralizados** (P1) e **recentes** (P7). | `web-engineer` | `features/command/` (novo), `lib/hotkeys.ts` (novo), `components/layout/app-frame.tsx` | 6, 7, 9, 10 |
| 9 | **Pesquisa global** (P2). | `api-engineer` | `features/search/` (novo), `main.py` (registo do router) | 7, 8, 10 |
| 10 | **Centro de notificações** (P6) e **ecrã de emails** (P15). | `api-engineer` + `web-engineer` | `features/notifications/` (novo, API e web), `features/users/` separador Emails, `components/layout/topbar.tsx` | 8, 9 |
| 11 | **RAP e impressão** (P9) e **bandeira "dados em validação"** (P14). | `web-engineer` + `data-engineer` (lista de lacunas) | `scenarios/scenario-actions.tsx`, `routes/_app/reports.tsx`, `styles.css`; `features/planning/` endpoint de lacunas | 12, 13 |
| 12 | **Modo apresentação / demo** (P8) com plano B local. | `web-engineer` + `ai-engineer` (perguntas "E se...?" de reserva) | `features/demo/` (novo), `features/whatif/`, `apps/api/src/novelo/ai/prompts/` | 11, 13 |
| 13 | **Erros do browser e métricas** (6.6): `POST /client-errors`, `duration_ms` por rota, log do solver. | `devops` + `api-engineer` | `core/logging.py`, `main.py`, `apps/web/src/main.tsx`, `components/route-error.tsx` | 11, 12 |
| 14 | **Triagem de campo** (P10) e **edição/validação de dados** (P5). Esta última exige decisão de produto com a Vitrus. | `web-engineer`, `api-engineer`, `data-engineer` | `features/triage/`, `features/network/`, `scripts/etl/` | 15 |
| 15 | **Dividir ficheiros grandes e consolidar padrões** (6.2, 6.3): `ConfirmActionDialog`, `tools.py`, `data-table.tsx`, `calendar-views.tsx`. Fazer ficheiro a ficheiro, depois dos marcos, para não gerar conflitos. | `web-engineer`, `api-engineer`, `reviewer` | conforme 6.2 | 14 |

**Sequência segura de colisões**: os passos 1, 2 e 6 tocam todos em `features/planning/service.py`: 1 primeiro (uma linha), 2 a seguir (listagens), 6 por último. Os passos 3, 7, 8, 11 e 12 tocam em `apps/web` mas em pastas diferentes (`components/layout/topbar.tsx` é partilhado entre 3 e 10: 3 antes de 10). O passo 5 espera pelos 1 e 2. O passo 13 é independente.

## 9. Já está bem (não mexer)

- Contrato primeiro e cliente gerado; estados a carregar, vazio e erro presentes nos ecrãs lidos (`states.tsx`, `skeletons.tsx`, `route-error.tsx`).
- `DataTable` completo: 41 usos, URL ativo por omissão (`urlSync ?? showControls`, `data-table.tsx:176`), vistas guardadas (só falta declará-las), exportação CSV/XLSX/JSON com `xlsx` em `import()` (`export.ts:186`).
- `PageTabs` com separador no URL em circuitos, localidades, frota, qualidade, cenário e IA.
- Estado partilhável nas rotas de planeamento (`simulator`, `scenarios/compare`, `coverage`).
- PWA com atualização por escolha, cache imutável de `/assets/`, SW só com sessão.
- Logs com `request_id`, limitadores por papel (`core/guest.py`), `SolverGuard` com concorrência máxima, PDF em threadpool (`reports/builder.py:178`), sementes fixas e `num_workers=1` no CP-SAT.
- Municipal com `ETag`/`Cache-Control`/gzip em cache: é o modelo para os outros módulos.
