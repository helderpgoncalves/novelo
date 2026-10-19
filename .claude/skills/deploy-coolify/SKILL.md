---
name: deploy-coolify
description: Deploy do Novelo no Coolify com o domínio novelo.bitsapiens.io, variáveis, healthchecks e diagnóstico de falhas em produção. Usar ao mexer em docker-compose, Dockerfiles ou quando o deploy falha.
---

# Deploy no Coolify

Detalhe completo: `docs/engenharia/deploy.md`.

- **Produção:** `docker-compose.yml` (serviços `web` nginx+SPA, `api`, `db`), um só domínio `https://novelo.bitsapiens.io`; o nginx do `web` encaminha `/api/` para `api:8000`. Nenhuma porta publicada.
- **Coolify:** recurso Docker Compose a partir do repo GitHub, branch `main`, ficheiro `docker-compose.yml`; no serviço `web` pôr o domínio `https://novelo.bitsapiens.io` (porta 80). Deploy automático no push à `main`.
- **Variáveis** (Coolify → Environment Variables): `OPENROUTER_API_KEY` (segredo), `LLM_MODEL_TEXT`, `LLM_MODEL_VISION`, `DOMAIN`, opcionais `LOG_LEVEL`, `SOLVER_TIME_LIMIT_S`. A password do Postgres é gerada pelo Coolify (`SERVICE_PASSWORD_POSTGRES`).
- **DNS:** registo A (ou CNAME via Cloudflare) de `novelo.bitsapiens.io` para o IP da VPS.
- **Antes de fazer push:** `just check` e `just build` (constrói as imagens de produção localmente).
- **Diagnóstico:** `GET /api/v1/health` (liveness) e `/api/v1/ready` (BD + IA). Logs da API são JSON com `request_id`. Falha de build do web ⇒ quase sempre `pnpm-lock.yaml` ou `openapi.json` fora de sincronia. Falha da API no arranque ⇒ migração Alembic (ver logs).
- **Rollback:** `git revert` do commit e push; marcar a versão da demo com tag `v1.0-demo`.
- Segurança: contentores sem root, CORS só para o domínio, nada sensível com prefixo `VITE_`, `.env` nunca no Git.
