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
| Email | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SUPPORT` | Ver abaixo |
| IA | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_MODEL_TEXT`, `LLM_MODEL_VISION`, `LLM_MODEL_FALLBACK`, `LLM_MAX_OUTPUT_TOKENS`, `LLM_REASONING_EFFORT`, `LLM_MONTHLY_BUDGET_USD`, `LLM_MAX_CONCURRENCY`, `LLM_TIMEOUT_S`, `LLM_CHAT_TIMEOUT_S`, `LLM_MAX_RETRIES`, `LLM_RETRY_BACKOFF_S` | Só dão o valor inicial: depois, a base de dados manda (painel `/admin/ai`). Ver [IA](ia.md) |
| Copiloto | `COPILOT_CONTEXT_CAP_TOKENS`, `COPILOT_MEMORY_CHAR_LIMIT`, `COPILOT_USER_CHAR_LIMIT`, `COPILOT_DEFAULT_PERSONA`, `COPILOT_MAX_RETENTION_DAYS`, `COPILOT_REVIEW_EVERY_TURNS` | Limites do sistema; o resto cada utilizador gere nas suas definições. Ver [Copiloto](copiloto.md) |
| Otimização | `SOLVER_TIME_LIMIT_S`, `OSRM_URL` | O OSRM é opcional |
| Web | `VITE_API_URL`, `VITE_MAP_STYLE_LIGHT`, `VITE_MAP_STYLE_DARK` | Vazio = mesmo domínio; mapa CARTO por omissão |

## Resend (email)

1. Criar uma chave em [resend.com/api-keys](https://resend.com/api-keys) e pô-la em `RESEND_API_KEY`.
2. Verificar o domínio do `EMAIL_FROM` (por omissão `Novelo <novelo@heldergoncalves.io>`) no Resend.
3. Sem chave, os emails (confirmar email, recuperar password) não saem: aparecem no log da API (`just logs api`) e, em desenvolvimento, em `GET /api/v1/dev/emails` (caixa de saída de desenvolvimento, continua a funcionar sem Resend).
4. `EMAIL_SUPPORT` (por omissão `novelo@heldergoncalves.io`) é o contacto de ajuda no rodapé; confirmar que a caixa existe. Os links e o logótipo dos emails usam `APP_URL` (derivado de `DOMAIN`); o logótipo é `apps/web/public/email/novelo-logotipo-negativo.png`, servido em `https://<DOMAIN>/email/`.

### Testar emails

- Pré-visualizar: `cd apps/api && uv run python -m novelo.cli preview-emails --out /tmp/emails` gera os 4 emails em pt-PT e en (HTML e texto). Para ver o logótipo sem deploy: `--base-url http://localhost:3190` com `just dev` a correr.
- Automático: `tests/unit/test_emails.py` (HTML bem formado, alt em imagens, links https, sem placeholders, escape do nome, assunto até 70 caracteres).
- Com Resend: pôr `RESEND_API_KEY` e `EMAIL_FROM` com domínio verificado, arrancar a API e usar "Esqueci a password" com um endereço real; o email chega com HTML e versão texto. Para clientes reais (Gmail, Outlook, Apple Mail) enviar os HTML da pré-visualização pelo painel do Resend ou por um serviço como Mail-Tester.

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

## Desenvolvimento

O admin de dev é `admin@heldergoncalves.io` / `admin-novelo-dev-1`. O compose de dev desliga o limite de pedidos (`RATE_LIMIT_ENABLED=false`) porque os testes ponta a ponta partilham o mesmo IP.

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
