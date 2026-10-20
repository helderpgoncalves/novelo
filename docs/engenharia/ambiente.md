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
| Convidados | `GUEST_AI_REQUESTS_PER_HOUR`, `GUEST_SOLVER_RUNS_PER_HOUR`, `GUEST_AI_BUDGET_USD` | Limites por convidado (role `guest`) |
| Anti-bots | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_ENABLED`, `TURNSTILE_REQUIRED`, `TURNSTILE_TIMEOUT_S` | Ver «Cloudflare Turnstile» abaixo |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ver abaixo |
| Email | `RESEND_API_KEY`, `EMAIL_TRANSPORT`, `EMAIL_FROM`, `EMAIL_SUPPORT` | Ver abaixo |
| IA | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_MODEL_TEXT`, `LLM_MODEL_VISION`, `LLM_MODEL_FALLBACK`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_REASONING_EFFORT`, `LLM_MONTHLY_BUDGET_USD`, `LLM_MAX_CONCURRENCY`, `LLM_TIMEOUT_S`, `LLM_CHAT_TIMEOUT_S`, `LLM_MAX_RETRIES`, `LLM_RETRY_BACKOFF_S` | Só dão o valor inicial: depois, a base de dados manda (painel `/admin/ai`). Ver [IA](ia.md) |
| Copiloto | `COPILOT_CONTEXT_CAP_TOKENS`, `COPILOT_MEMORY_CHAR_LIMIT`, `COPILOT_USER_CHAR_LIMIT`, `COPILOT_DEFAULT_PERSONA`, `COPILOT_MAX_RETENTION_DAYS`, `COPILOT_REVIEW_EVERY_TURNS` | Limites do sistema; o resto cada utilizador gere nas suas definições. Ver [Copiloto](copiloto.md) |
| Otimização | `SOLVER_TIME_LIMIT_S`, `OSRM_URL` | `OSRM_URL` está reservada: a API lê-a, mas ainda não há cliente OSRM (as distâncias são em linha reta com fator de desvio 1,3) e o compose não tem serviço OSRM |
| Web | `VITE_API_URL`, `VITE_MAP_STYLE_LIGHT`, `VITE_MAP_STYLE_DARK` | Vazio = mesmo domínio; mapa CARTO por omissão |

## Resend (email)

1. Criar uma chave em [resend.com/api-keys](https://resend.com/api-keys) e pô-la em `RESEND_API_KEY`.
2. Verificar o domínio do `EMAIL_FROM` (por omissão `Novelo <novelo@heldergoncalves.io>`) no Resend.
3. Sem chave, os emails (magic link, confirmar email, recuperar password, boas-vindas de convidado) não saem: aparecem no log da API (`just logs api`) e, em desenvolvimento, em `GET /api/v1/dev/emails` (caixa de saída de desenvolvimento, fora do OpenAPI e nunca montada em produção).
4. `EMAIL_TRANSPORT` escolhe o modo: `auto` (por omissão: Resend se houver chave), `log` (nunca envia; é o que o `docker-compose.dev.yml` assume, para os testes ponta a ponta não enviarem emails a sério) ou `resend` (força o envio real, útil em `.env.local` para testar o Resend em dev).
5. `EMAIL_SUPPORT` (por omissão `novelo@heldergoncalves.io`) é o contacto de ajuda no rodapé; confirmar que a caixa existe. Os links e o logótipo dos emails usam `APP_URL` (derivado de `DOMAIN`); o logótipo é `apps/web/public/email/novelo-logotipo-negativo.png`, servido em `https://<DOMAIN>/email/`.

### Testar emails

- Pré-visualizar: `cd apps/api && uv run python -m novelo.cli preview-emails --out /tmp/emails` gera os 4 emails em pt-PT e en (HTML e texto). Para ver o logótipo sem deploy: `--base-url http://localhost:3190` com `just dev` a correr.
- Automático: `tests/unit/test_emails.py` (HTML bem formado, alt em imagens, links https, sem placeholders, escape do nome, assunto até 70 caracteres).
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

O QR em SVG sai de `GET /auth/quick-join/qr` (administrador); o ecrã `/users`, separador «Cartaz do QR», mostra-o em ponto de impressão. Os convidados listam-se em `/users`, separador «Convidados». Os limites de pedidos (autenticação, magic link, QR, IA, otimizador) são **em memória, por processo**: o `entrypoint.sh` arranca 2 processos por omissão (`WEB_CONCURRENCY`), por isso o limite efetivo pode chegar ao dobro.

## Desenvolvimento

O admin de dev é `admin@heldergoncalves.io` / `admin-novelo-dev-1` (entra-se em `/login?method=password`; o ecrã de entrada oferece o magic link por omissão). A entrada por QR de dev é `http://localhost:3190/join?c=novelo-dev`. O compose de dev desliga o limite de pedidos (`RATE_LIMIT_ENABLED=false`) porque os testes ponta a ponta partilham o mesmo IP, e usa `EMAIL_TRANSPORT=log`. Segredos locais (por exemplo `RESEND_API_KEY`) ficam em `.env.local`, fora do Git.

## O que o compose de produção passa à API

O `docker-compose.yml` não repassa todas as variáveis do `.env.example`: só as que lista em `api.environment`. As restantes (por exemplo `MAGIC_LINK_EXPIRE_MINUTES`, `QUICK_JOIN_CONSENT_VERSION`, `GUEST_*`, `COPILOT_*`, `LLM_*` além dos modelos, `EMAIL_TRANSPORT`, `SESSION_TOKEN_HOURS`) ficam nos valores por omissão do `config.py` até serem acrescentadas ao compose. Definidas pelo compose, não pelo `.env`: `APP_ENV=production`, `DATABASE_URL`, `DATA_DIR`, `SECRET_KEY` (a partir de `SERVICE_PASSWORD_64_SECRETKEY`), `APP_URL` e `CORS_ORIGINS` (a partir de `DOMAIN`). Lista completa em [Deploy](deploy.md#variáveis).

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
