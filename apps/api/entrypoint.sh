#!/bin/sh
# Produção: migra a base de dados e arranca o servidor.
set -e
alembic upgrade head
# Dados de referência da Vitrus (idempotente): fontes, circuitos, viaturas, destinos do têxtil...
python -m novelo.cli seed >/dev/null
exec uvicorn novelo.main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-2}" \
  --proxy-headers --forwarded-allow-ips "*"
