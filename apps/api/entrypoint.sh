#!/bin/sh
# Produção: migra a base de dados e arranca o servidor.
set -e
alembic upgrade head
exec uvicorn novelo.main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-2}" \
  --proxy-headers --forwarded-allow-ips "*"
