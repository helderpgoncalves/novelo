#!/bin/sh
# Produção: migra a base de dados e arranca o servidor.
set -e
alembic upgrade head
# Dados de referência da Vitrus (idempotente): fontes, circuitos, viaturas, destinos do têxtil...
python -m novelo.cli seed >/dev/null
# Um só processo por omissão: os limites de pedidos vivem em memória (por processo). O IP do cliente é resolvido pela
# própria API (TRUSTED_PROXY_HOPS, ver core/ratelimit.py), por isso o uvicorn só reescreve cabeçalhos de proxies de
# FORWARDED_ALLOW_IPS (por omissão o loopback: nenhum pedido de fora, nunca "*").
exec uvicorn novelo.main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-1}" \
  --proxy-headers --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}"
