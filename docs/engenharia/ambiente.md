# Ambiente e variáveis

Tudo se configura por variáveis de ambiente lidas em `apps/api/src/novelo/core/config.py`. O `.env.example` na raiz lista todas e tem comentários; `just setup` copia-o para `.env` (que nunca vai para o Git). Em produção os valores vivem no Coolify.

| Grupo | Variáveis | Notas |
| --- | --- | --- |
| Geral | `APP_ENV`, `LOG_LEVEL`, `DOMAIN` | `APP_ENV=production` desliga `/api/docs` e `/api/openapi.json` |
| Portas (dev) | `WEB_PORT=3190`, `API_PORT=8190`, `DB_PORT=5590` | `OSRM_PORT` existe no `.env.example` mas não é usada |
| Base de dados | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Em produção a password é gerada pelo Coolify |
| Sessão | `SECRET_KEY`, `APP_URL`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `SESSION_TOKEN_HOURS` | `APP_URL` entra nos links dos emails e no retorno do Google |
| Contas | `ALLOW_REGISTRATION`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PASSWORD_RESET_EXPIRE_MINUTES`, `EMAIL_VERIFY_EXPIRE_HOURS`, `RATE_LIMIT_ENABLED` | O administrador é criado no arranque se não existir |
| Entrada sem password | `MAGIC_LINK_EXPIRE_MINUTES`, `QUICK_JOIN_ENABLED`, `QUICK_JOIN_CODE`, `QUICK_JOIN_CONSENT_VERSION` | Ver «Magic link e entrada por QR» abaixo |
| Administração de utilizadores | `INVITATION_EXPIRE_DAYS` (7), `INVITATIONS_PER_HOUR` (30 por admin), `IMPERSONATION_MINUTES` (30, fixo) | Convites por email e impersonação; ver «Administração de utilizadores» em [Arquitetura](arquitetura.md). O compose repassa-os |
| Convidados | `GUEST_AI_REQUESTS_PER_HOUR`, `GUEST_SOLVER_RUNS_PER_HOUR`, `GUEST_AI_BUDGET_USD`, `GUEST_SIGNUPS_PER_HOUR`, `GUEST_AI_GLOBAL_BUDGET_USD` | Limites por convidado e tetos globais do evento (role `guest`) |
| IP e proxies | `TRUSTED_PROXY_HOPS`, `TRUST_CLOUDFLARE_HEADER`, `FORWARDED_ALLOW_IPS`, `WEB_CONCURRENCY` | Ver «IP real do cliente e limites» abaixo |
| Rotas caras | `SOLVER_RUNS_PER_MINUTE` (6), `SOLVER_MAX_CONCURRENCY` (2), `PDF_MAX_CONCURRENCY` (2), `LOGIN_ACCOUNT_MAX_FAILURES` (10), `COPILOT_ATTACHMENTS_PER_USER` (100), `COPILOT_ATTACHMENTS_MAX_MB` (50) | Limites por utilizador/conta e concorrência global, por processo |
| Anti-bots | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENABLED`, `TURNSTILE_REQUIRED`, `TURNSTILE_TIMEOUT_S` | Ver «Cloudflare Turnstile» abaixo |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ver abaixo |
| Email | `RESEND_API_KEY`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_SUPPORT` | Ver abaixo |
| IA | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_MODEL_TEXT`, `LLM_MODEL_VISION`, `LLM_MODEL_FALLBACK`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_REASONING_EFFORT`, `LLM_MONTHLY_BUDGET_USD`, `LLM_MAX_CONCURRENCY`, `LLM_TIMEOUT_S`, `LLM_CHAT_TIMEOUT_S`, `LLM_MAX_RETRIES`, `LLM_RETRY_BACKOFF_S`, `LLM_AUX_PROVIDER_SORT`, `WEB_SEARCH_*`, `WEB_FETCH_*`, `GUEST_WEB_SEARCH_ENABLED`, `SERVER_TOOLS_*`, `OPENROUTER_ZDR_ENFORCED` | Só dão o valor inicial: depois, a base de dados manda (painel `/admin/ai`). Ver [IA](ia.md) |
| Copiloto | `COPILOT_CONTEXT_CAP_TOKENS`, `COPILOT_MEMORY_CHAR_LIMIT`, `COPILOT_USER_CHAR_LIMIT`, `COPILOT_DEFAULT_PERSONA`, `COPILOT_MAX_RETENTION_DAYS`, `COPILOT_REVIEW_EVERY_TURNS` | Limites do sistema; o resto cada utilizador gere nas suas definições. Ver [Copiloto](copiloto.md) |
| Otimização | `SOLVER_TIME_LIMIT_S`, `OSRM_URL` | `OSRM_URL` está reservada: a API lê-a, mas ainda não há cliente OSRM (as distâncias são em linha reta com fator de desvio 1,3) e o compose não tem serviço OSRM |
| Web | `VITE_API_URL`, `VITE_MAP_STYLE_LIGHT`, `VITE_MAP_STYLE_DARK` | Vazio = mesmo domínio; mapa CARTO por omissão |

## Resend (email)

1. Criar uma chave em [resend.com/api-keys](https://resend.com/api-keys) e pô-la em `RESEND_API_KEY`.
2. Verificar o domínio do `EMAIL_FROM` (por omissão `Novelo <novelo@heldergoncalves.io>`) no Resend.
3. Sem chave, **em desenvolvimento** os emails (magic link, confirmar email, recuperar password, boas-vindas de convidado) não saem: aparecem no log da API (`just logs api`) e, em desenvolvimento, em `GET /api/v1/dev/emails` (caixa de saída de desenvolvimento, fora do OpenAPI e nunca montada em produção). **Em produção** o log nunca recebe o corpo nem os links de um email (seriam credenciais): sem `RESEND_API_KEY` (ou com `EMAIL_TRANSPORT=log`) o envio responde 503 `feature_disabled` e o arranque regista um aviso.
4. `EMAIL_TRANSPORT` escolhe o modo: `auto` (por omissão: Resend se houver chave), `log` (nunca envia; é o que o `docker-compose.dev.yml` assume, para os testes ponta a ponta não enviarem emails a sério) ou `resend` (força o envio real, útil em `.env.local` para testar o Resend em dev).
5. `EMAIL_SUPPORT` (por omissão `novelo@heldergoncalves.io`) é o contacto de ajuda no rodapé; confirmar que a caixa existe. Os links e o logótipo dos emails usam `APP_URL` (derivado de `DOMAIN`); os logótipos são `apps/web/public/email/novelo-logotipo.png` (fundo claro) e `novelo-logotipo-negativo.png` (modo escuro), servidos em `https://<DOMAIN>/email/` e gerados por `just brand`. As imagens de partilha (`apps/web/public/og/`, `og-image.png`) e os fundos dither da landing (`apps/web/public/landing/`) também saem de `just brand` (ver [linguagem dither](../marca/linguagem-dither.md)).

### Testar emails

- Pré-visualizar: `cd apps/api && uv run python -m novelo.cli preview-emails --out /tmp/emails` gera os 8 emails em pt-PT e en (HTML e texto). Para ver o logótipo sem deploy: `--base-url http://localhost:3190` com `just dev` a correr.
- Visual: layout neutro e institucional (`features/auth/email_layout.py`): cabeçalho claro com o logótipo sobre fundo cinza muito claro, cartão branco de 580 px com borda fina, títulos em sans-serif semibold, texto de 15 px com entrelinha 1,6, botão de 46 px e um único acento (verde da marca, só no botão e nas ligações). Modo escuro por `prefers-color-scheme` (com o logótipo trocado) e botão VML para o Outlook. Todos os emails seguem a mesma estrutura: eyebrow, título, parágrafos curtos, botão, quadro de dados, ligação alternativa, nota de segurança e rodapé; assuntos no formato `Ação · Novelo`; saudação só com o primeiro nome; durações normalizadas (60 minutos = 1 hora, 48 horas = 2 dias).
- Automático: `tests/unit/test_emails.py` (HTML bem formado, alt em imagens, links https, sem placeholders, escape do nome, assunto uniforme até 70 caracteres, texto simples só com pontuação ASCII, saudação com primeiro nome, papel com maiúscula).
- Com Resend: pôr `RESEND_API_KEY` e `EMAIL_FROM` com domínio verificado, arrancar a API e usar "Esqueci a password" com um endereço real; o email chega com HTML e versão texto. Para clientes reais (Gmail, Outlook, Apple Mail) enviar os HTML da pré-visualização pelo painel do Resend ou por um serviço como Mail-Tester.

## Cloudflare Turnstile

Protege as rotas públicas de escrita contra bots. No painel da Cloudflare (Turnstile) criar um widget **Managed** com os hostnames `novelo.helder.si` e `localhost`; a chave pública vai para `TURNSTILE_SITE_KEY` (o web lê-a em `GET /auth/config`) e o secret para `TURNSTILE_SECRET_KEY` (só no Coolify, nunca no web).

| Variável | Por omissão | Para que serve |
| --- | --- | --- |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | vazio | Chaves do widget. **Em dev, vazias = chaves de teste da Cloudflare** (`1x00000000000000000000AA` passa sempre; um secret `2x…AA` falha sempre) |
| `TURNSTILE_ENABLED` | `auto` | `auto`: ativo se houver secret (em dev, sempre, com as chaves de teste); `true` liga; `false` desliga (útil em E2E locais) |
| `TURNSTILE_REQUIRED` | `false` | `true` = fail-closed: liga sempre a verificação e, sem secret, as rotas protegidas respondem 503 `captcha_unavailable` em vez de passarem. **Recomendado em produção depois de pôr as chaves** |
| `TURNSTILE_TIMEOUT_S` | `5` | Limite do pedido à Cloudflare |

Decisão: por omissão (`auto`) a produção sem secret arranca na mesma (não bloqueia o júri se a chave faltar), mas regista um aviso no arranque e `GET /auth/config` devolve `turnstile_enabled=false`; com `TURNSTILE_REQUIRED=true` falha fechado. O compose de dev não define estas variáveis (usa as chaves de teste); para os E2E sem widget pôr `TURNSTILE_ENABLED=false` em `.env.local`.

Contrato: o token vai no cabeçalho `X-Turnstile-Token`, de uso único (pedir um token novo a cada tentativa, `turnstile.reset()` depois de uma falha). Erros: 400 `captcha_required`, 403 `captcha_failed`, 503 `captcha_unavailable` (Cloudflare em baixo, ou obrigatório sem secret). A API confirma também o `action` do widget (se a Cloudflare o devolver) e, com chaves reais, o hostname de `APP_URL`.

### Onde há captcha e porquê

O Turnstile só fica onde faz sentido de segurança, sem fricção desnecessária. Quem já prova algo (um token secreto de uso único ou uma sessão) não leva captcha, mas mantém sempre o limitador.

| Rota | Captcha | Porquê |
| --- | --- | --- |
| `POST /auth/login` | sim (`login`) | Força bruta de credenciais |
| `POST /auth/register` | sim (`register`) | Criação de contas em massa |
| `POST /auth/magic-link` | sim (`magic_link`) | Envia email a terceiros |
| `POST /auth/forgot-password` | sim (`forgot_password`) | Envia email a terceiros |
| `POST /auth/quick-join` | sim (`quick_join`) | Entrada pública por QR; cria conta e envia email |
| `POST /auth/reset-password` | não | O token do email, de uso único, já é o segredo; mantém o limitador |
| `POST /auth/invitations/accept` | não | O token do convite, de uso único, já é o segredo; mantém o limitador por IP |
| `POST /auth/resend-verification` | não | Exige sessão iniciada; mantém o limitador e o bloqueio em impersonação |
| `POST /auth/magic-link/verify`, `POST /auth/verify-email` | não | Token secreto de uso único com limitador |

## Google OAuth

1. Em [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials), criar um cliente "Web application".
2. URIs de redirecionamento: `http://localhost:3190/api/v1/auth/google/callback` (dev) e `https://novelo.helder.si/api/v1/auth/google/callback` (produção).
3. Preencher `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Sem eles o botão do Google não aparece (o web pergunta a `GET /api/v1/auth/config`).

## OpenRouter

Criar uma chave em [openrouter.ai/keys](https://openrouter.ai/keys) e pô-la em `OPENROUTER_API_KEY`. Sem chave, as funcionalidades de IA respondem 503.

Os modelos por omissão são `openai/gpt-6-luna` para texto e para visão (US$ 0,10 por milhão de tokens de entrada, US$ 0,50 por milhão de saída, contexto de 1,05 M, aceita imagem). Estas variáveis só são o **valor inicial**: o modelo de cada funcionalidade, a reserva, os limites e o orçamento mensal mudam-se no painel de administração (`/admin/ai`), sem novo deploy, e ficam na base de dados.

| Variável | Por omissão | Para que serve |
| --- | --- | --- |
| `LLM_MODEL_TEXT` / `LLM_MODEL_VISION` | `openai/gpt-6-luna` | Modelo global de texto e de visão (a triagem usa o de visão) |
| `LLM_MODEL_FALLBACK` | vazio | Modelo de reserva se o principal falhar |
| `LLM_MAX_OUTPUT_TOKENS` | `0` (limite próprio de cada tarefa) | Teto global de tokens de saída |
| `LLM_REASONING_EFFORT` | `low` | `low`, `medium` ou `high`: mais esforço custa mais e demora mais |
| `LLM_MONTHLY_BUDGET_USD` | `0` (sem limite) | Acima deste valor, a IA responde 503 `ai_budget_exceeded` |
| `LLM_MAX_CONCURRENCY` | `4` | Chamadas simultâneas ao fornecedor |
| `LLM_TIMEOUT_S` / `LLM_CHAT_TIMEOUT_S` | `30` / `90` | Limite por chamada e limite total de uma conversa com ferramentas |
| `LLM_MAX_RETRIES` / `LLM_RETRY_BACKOFF_S` | `2` / `0.5` | Repetições de falhas transitórias, com espera exponencial |
| `LLM_AUX_PROVIDER_SORT` | `latency` | Tarefas auxiliares (`copilot_aux`): o OpenRouter prefere o fornecedor mais rápido (`latency`, `throughput`, `price`; vazio = padrão) |

### Pesquisa na web do copiloto

O copiloto pode consultar fontes públicas (server tools do OpenRouter, em beta) para contexto externo ao Novelo: legislação, benchmarks de outras cidades, preços, notícias, definições. Cada pesquisa tem custo próprio no OpenRouter (Exa cerca de US$ 0,007 por pedido; Parallel e Perplexity menos ou parecido) e conta no orçamento de IA. Todas as variáveis estão no `docker-compose.yml` e têm valor por omissão: sem fazer nada fica ligada para utilizadores, desligada para convidados. Funcionamento, privacidade e limites em [IA](ia.md#pesquisa-na-web).

| Variável | Por omissão | Para que serve |
| --- | --- | --- |
| `WEB_SEARCH_ENABLED` | `true` | `false` desliga a pesquisa na web para todos (o copiloto avisa e responde só com dados do Novelo) |
| `WEB_SEARCH_MODE` | `tool` | `tool`: ferramenta `web_search` da casa, com a consulta sanitizada antes de sair (recomendado). `inline`: o server tool `openrouter:web_search` vai no mesmo pedido e o modelo pesquisa sozinho (sem sanitização da consulta) |
| `WEB_SEARCH_ENGINE` | `auto` | `auto`, `native`, `exa`, `parallel`, `perplexity` ou `firecrawl` (o Firecrawl é rejeitado com ZDR forçado) |
| `WEB_SEARCH_MAX_RESULTS` | `5` | Fontes por pesquisa (1 a 10) |
| `WEB_SEARCH_MAX_CALLS` | `3` | Pesquisas por pergunta do utilizador |
| `WEB_SEARCH_MAX_COST_USD` | `0.05` | Teto de gasto por pedido (condição `max_cost` do ciclo de server tools); `0` = sem teto |
| `WEB_SEARCH_CONTEXT_SIZE` | `low` | `low`, `medium` ou `high`: quanto texto de cada página (mais contexto custa mais tokens) |
| `WEB_SEARCH_TIMEOUT_S` | `25` | Limite de tempo de uma pesquisa |
| `WEB_SEARCH_ALLOWED_DOMAINS` / `WEB_SEARCH_EXCLUDED_DOMAINS` | vazio | Listas separadas por vírgulas; não se combinam (a de permitidos ganha) |
| `GUEST_WEB_SEARCH_ENABLED` | `false` | Convidados do evento podem pesquisar na web |
| `WEB_FETCH_ENABLED` | `true` | Ler um link `https` que o utilizador cole na mensagem (só desse domínio) |
| `WEB_FETCH_ALLOWED_DOMAINS` / `WEB_FETCH_BLOCKED_DOMAINS` | vazio | Restringem os domínios que se podem ler |
| `WEB_FETCH_MAX_CONTENT_TOKENS` | `12000` | Tamanho máximo de uma página lida |
| `SERVER_TOOLS_DATETIME_ENABLED` / `SERVER_TOOLS_TIMEZONE` | `true` / `Europe/Lisbon` | Ferramenta de data e hora no modo `inline`; a data de hoje vai sempre no contexto, neste fuso |
| `OPENROUTER_ZDR_ENFORCED` | `false` | Declara que a conta OpenRouter força ZDR: o motor Firecrawl é trocado por `auto` |

**Região e privacidade.** O OpenRouter não tem motor de pesquisa residente na UE: num endpoint regional da UE (`eu.openrouter.ai`) a pesquisa fica desligada por si (o servidor devolve 403). As consultas saem da UE para o motor de pesquisa; por isso o modo `tool` recusa consultas com emails, nomes de utilizadores, identificadores ou números internos do Novelo.

## Magic link e entrada por QR

O magic link é a forma principal de entrar (password e Google continuam como alternativas). `POST /auth/magic-link` responde sempre 204; o link vale `MAGIC_LINK_EXPIRE_MINUTES` (15), é de uso único, só o hash fica na base de dados e cria uma sessão de 30 dias. `magic_link_enabled` em `GET /auth/config` é verdadeiro com Resend configurado ou com `EMAIL_TRANSPORT=log` / ambiente de desenvolvimento. Em produção sem `RESEND_API_KEY` é falso: o pedido responde 503 e o ecrã de entrada deixa só a password e o Google.

Entrada por QR do evento (`/join?c=<código>`): o convidado escreve nome e email e entra com o role `guest` (como operador, sem gestão de utilizadores, sem administração de IA, sem apagar dados e sem ações de risco alto do copiloto). Um email que já tem conta nunca inicia sessão: recebe um magic link.

| Variável | Por omissão | Para que serve |
| --- | --- | --- |
| `QUICK_JOIN_ENABLED` | `true` | Liga ou desliga a entrada por QR |
| `QUICK_JOIN_CODE` | vazio | Código do evento (comparado em tempo constante). Em dev, vazio significa `novelo-dev`; **em produção, vazio desliga a entrada por QR**. O Coolify tem de o definir |
| `QUICK_JOIN_CONSENT_VERSION` | `2026-10-20` | Versão do texto de consentimento guardada com a data (RGPD) |
| `GUEST_AI_REQUESTS_PER_HOUR` | `20` | Pedidos de IA por convidado e hora (copiloto, triagem, relatório RAP, sugestões de alertas, «E se...?») |
| `GUEST_SOLVER_RUNS_PER_HOUR` | `10` | Execuções do otimizador por convidado e hora |
| `GUEST_AI_BUDGET_USD` | `0.5` | Gasto de IA por convidado nas últimas 24 h (0 = sem limite); acima disso, 503 `ai_budget_exceeded` |
| `GUEST_SIGNUPS_PER_HOUR` | `200` | Teto GLOBAL de entradas por QR por hora (conta na base de dados, não depende do IP; 0 = sem limite). Acima disso, 429 `rate_limited` |
| `GUEST_AI_GLOBAL_BUDGET_USD` | `5` | Teto GLOBAL do gasto de IA de todos os convidados nas últimas 24 h (soma de `ai_usage` do role `guest`; 0 = sem limite) |

O QR em SVG sai de `GET /auth/quick-join/qr` (administrador); o ecrã `/users`, separador «Cartaz do QR», mostra-o em ponto de impressão. Os convidados listam-se em `/users`, separador «Convidados». Decisão sobre enumeração: quem entra por QR com um email NOVO fica logo com sessão (é o fluxo do júri); com um email que já tem conta recebe `check_email` e um magic link. A resposta distingue os dois casos, ou seja, o QR permite perguntar «este email já tem conta?». Fica aceite porque devolver sempre `check_email` obrigaria o júri a abrir o email para entrar. Mitigações: código do evento, Turnstile, honeypot, limite por IP, por email e por falhas de código, teto global de entradas por hora (aplicado antes de saber se o email existe), e o convidado nasce com `email_verified=false` (ver «Pré-sequestro»). O trabalho dos dois ramos é equivalente (uma escrita e um email em segundo plano).

Os limites de pedidos (autenticação, magic link, QR, IA, otimizador) são **em memória, por processo**: ver «IP real do cliente e limites».

## IP real do cliente e limites

`client_ip` (`core/ratelimit.py`) decide o IP usado nos limites, no Turnstile (`remoteip`), na auditoria e nos emails. **Nunca** confia no primeiro valor de `X-Forwarded-For` (forjável). Com `TRUSTED_PROXY_HOPS=N` a cadeia é `X-Forwarded-For` mais o par TCP e o cliente é o elemento N posições antes do fim: o que o atacante põe à esquerda não conta. Cada valor passa por `ipaddress.ip_address` (lixo é descartado, IPv4 mapeado em IPv6 é normalizado, tamanho limitado); se a posição de confiança for lixo, usa o par TCP.

| Variável | Por omissão | Para que serve |
| --- | --- | --- |
| `TRUSTED_PROXY_HOPS` | `0` (dev), `2` (compose) | Nº de proxies de confiança à frente da API. `0` ignora os cabeçalhos. Produção: nginx e Traefik = 2 |
| `TRUST_CLOUDFLARE_HEADER` | `false` (dev), `true` (compose) | Se o salto mais externo (posição `N`) é um IP publicado da Cloudflare, vale o `CF-Connecting-IP`; fora da Cloudflare o cabeçalho forjado é ignorado |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Proxies cujos cabeçalhos o **uvicorn** aceita (`--forwarded-allow-ips`, antes era `*`). A API resolve o IP sozinha, por isso o uvicorn não reescreve o cliente: se o fizesse, a contagem de saltos seria feita duas vezes |
| `WEB_CONCURRENCY` | `1` | Processos do uvicorn |

Cadeia de produção: Cloudflare → Traefik (Coolify) → nginx (`web`) → API. O nginx acrescenta o IP do Traefik a `X-Forwarded-For` e deixa passar o `CF-Connecting-IP`. Se mudar a cadeia (por exemplo sem Cloudflare), ajustar `TRUSTED_PROXY_HOPS` e pôr `TRUST_CLOUDFLARE_HEADER=false`; um valor a mais atribui o IP a um proxy, um valor a menos aceita o que o cliente enviou.

**Limiter em memória.** Janela deslizante por chave, apaga chaves vazias e tem teto de 20 000 chaves por limiter (expiradas primeiro, depois as mais antigas), por isso a memória não cresce sem limite. Os contadores são **por processo**: com `WEB_CONCURRENCY=2` todos os limites valeriam o dobro. Decisão: a produção corre **um processo** (a API é assíncrona e o solver corre em threads; o compose limita a 2 CPU) e o limiter continua em memória. Os tetos que protegem dinheiro não dependem dele: convidados por hora (`users.created_at`) e gasto de IA (`ai_usage`) contam-se na base de dados. Passar a vários processos exige mover os limiters de autenticação e de QR para Postgres (tabela de acertos por chave e janela).

Outros limites novos: falhas de login por conta (hash do email, 10 em 15 min, também para emails inexistentes), registo por IP (10/h), execuções do otimizador por utilizador (6/min) com um máximo de 2 em simultâneo e de 2 PDF em simultâneo (429 «o servidor está ocupado»), passaporte público por IP (60/min).

## Desenvolvimento

O admin de dev é `admin@heldergoncalves.io` / `admin-novelo-dev-1` (entra-se em `/login?method=password`; o ecrã de entrada oferece o magic link por omissão). A entrada por QR de dev é `http://localhost:3190/join?c=novelo-dev`. O compose de dev desliga o limite de pedidos (`RATE_LIMIT_ENABLED=false`) porque os testes ponta a ponta partilham o mesmo IP, e usa `EMAIL_TRANSPORT=log`. Segredos locais (por exemplo `RESEND_API_KEY`) ficam em `.env.local`, fora do Git.

## O que o compose de produção passa à API

O `docker-compose.yml` não repassa todas as variáveis do `.env.example`: só as que lista em `api.environment`. Também repassa as variáveis de pesquisa na web (`WEB_SEARCH_*`, `WEB_FETCH_*`, `GUEST_WEB_SEARCH_ENABLED`, `SERVER_TOOLS_*`, `OPENROUTER_ZDR_ENFORCED`), `LLM_MONTHLY_BUDGET_USD` (30 por omissão; o teto mensal global de IA, editável depois no painel `/admin/ai`), `GUEST_SIGNUPS_PER_HOUR`, `GUEST_AI_GLOBAL_BUDGET_USD`, `INVITATION_EXPIRE_DAYS`, `INVITATIONS_PER_HOUR`, `IMPERSONATION_MINUTES`, `TRUSTED_PROXY_HOPS`, `TRUST_CLOUDFLARE_HEADER`, `WEB_CONCURRENCY`, `SOLVER_RUNS_PER_MINUTE` e `SOLVER_MAX_CONCURRENCY`. As restantes (por exemplo `MAGIC_LINK_EXPIRE_MINUTES`, `QUICK_JOIN_CONSENT_VERSION`, `GUEST_*` por convidado, `COPILOT_*`, `LLM_*` além dos modelos, `EMAIL_TRANSPORT`, `SESSION_TOKEN_HOURS`) ficam nos valores por omissão do `config.py` até serem acrescentadas ao compose. Definidas pelo compose, não pelo `.env`: `APP_ENV=production`, `DATABASE_URL`, `DATA_DIR`, `SECRET_KEY` (a partir de `SERVICE_PASSWORD_64_SECRETKEY`), `APP_URL` e `CORS_ORIGINS` (a partir de `DOMAIN`). Lista completa em [Deploy](deploy.md#variáveis).

## Copiloto

| Variável | Por omissão | Para que serve |
| --- | --- | --- |
| `COPILOT_CONTEXT_CAP_TOKENS` | `64000` | Janela útil máxima de contexto (mesmo que o modelo aceite mais): controla custo e latência |
| `COPILOT_MEMORY_CHAR_LIMIT` | `2200` | Limite das notas do copiloto (`memory`) por utilizador |
| `COPILOT_USER_CHAR_LIMIT` | `1375` | Limite do perfil do utilizador (`user`) |
| `COPILOT_DEFAULT_PERSONA` | `default` | Persona por omissão (`default`, `analyst`, `mentor`, `executive`, `storyteller`) |
| `COPILOT_MAX_RETENTION_DAYS` | `0` (sem máximo) | Retenção máxima das conversas, acima da escolhida pelo utilizador |
| `COPILOT_REVIEW_EVERY_TURNS` | `3` | De quantas em quantas perguntas corre a revisão automática da memória |

Para apagar o que passou do prazo de retenção: `cd apps/api && uv run python -m novelo.cli purge-copilot` (uma vez por dia, por exemplo numa tarefa agendada do Coolify). Para avaliar o copiloto com o modelo real: `just eval-copilot`.
