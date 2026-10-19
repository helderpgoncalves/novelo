# Ambiente e variáveis

Tudo se configura por variáveis de ambiente lidas em `apps/api/src/novelo/core/config.py`. O `.env.example` na raiz lista todas e tem comentários; `just setup` copia-o para `.env` (que nunca vai para o Git). Em produção os valores vivem no Coolify.

| Grupo | Variáveis | Notas |
| --- | --- | --- |
| Geral | `APP_ENV`, `LOG_LEVEL`, `DOMAIN` | `APP_ENV=production` desliga `/api/docs` e `/api/openapi.json` |
| Portas (dev) | `WEB_PORT=3190`, `API_PORT=8190`, `DB_PORT=5590` | |
| Base de dados | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Em produção a password é gerada pelo Coolify |
| Sessão | `SECRET_KEY`, `APP_URL`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `SESSION_TOKEN_HOURS` | `APP_URL` entra nos links dos emails e no retorno do Google |
| Contas | `ALLOW_REGISTRATION`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PASSWORD_RESET_EXPIRE_MINUTES`, `EMAIL_VERIFY_EXPIRE_HOURS`, `RATE_LIMIT_ENABLED` | O administrador é criado no arranque se não existir |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Ver abaixo |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Ver abaixo |
| IA | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_MODEL_TEXT`, `LLM_MODEL_VISION`, `LLM_TIMEOUT_S` | Ver [IA](ia.md) |
| Otimização | `SOLVER_TIME_LIMIT_S`, `OSRM_URL` | O OSRM é opcional |
| Web | `VITE_API_URL`, `VITE_MAP_STYLE_LIGHT`, `VITE_MAP_STYLE_DARK` | Vazio = mesmo domínio; mapa CARTO por omissão |

## Resend (email)

1. Criar uma chave em [resend.com/api-keys](https://resend.com/api-keys) e pô-la em `RESEND_API_KEY`.
2. Verificar o domínio do `EMAIL_FROM` (por omissão `Novelo <noreply@bitsapiens.io>`) no Resend.
3. Sem chave, os emails (confirmar email, recuperar password) não saem: aparecem no log da API (`just logs api`) e, em desenvolvimento, em `GET /api/v1/dev/emails`.

## Google OAuth

1. Em [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials), criar um cliente "Web application".
2. URIs de redirecionamento: `http://localhost:3190/api/v1/auth/google/callback` (dev) e `https://novelo.bitsapiens.io/api/v1/auth/google/callback` (produção).
3. Preencher `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Sem eles o botão do Google não aparece (o web pergunta a `GET /api/v1/auth/config`).

## OpenRouter

Criar uma chave em [openrouter.ai/keys](https://openrouter.ai/keys) e pô-la em `OPENROUTER_API_KEY`. Confirmar os slugs dos modelos em [openrouter.ai/models](https://openrouter.ai/models) antes de os fixar. Sem chave, as funcionalidades de IA respondem 503.

## Desenvolvimento

O admin de dev é `admin@bitsapiens.io` / `admin-novelo-dev-1`. O compose de dev desliga o limite de pedidos (`RATE_LIMIT_ENABLED=false`) porque os testes ponta a ponta partilham o mesmo IP.
