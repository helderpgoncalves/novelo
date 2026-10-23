#!/usr/bin/env bash
# Backup diário da base de dados do Novelo em produção (Postgres, formato custom). As fotografias dos lotes vivem na
# base de dados, por isso vão incluídas. O resto está no Git e volta com um redeploy.
#
# Instalar no servidor do Coolify (ver docs/engenharia/deploy.md, «Backups»):
#   scp scripts/ops/novelo-backup.sh root@<vps>:/root/novelo-backup.sh && chmod +x /root/novelo-backup.sh
#   0 4 * * * /root/novelo-backup.sh >> /var/log/novelo-backup.log 2>&1
#
# Os backups ficam no servidor: copia BACKUP_DIR para fora dele de vez em quando, um disco morto leva os dois.
set -euo pipefail

# O Coolify chama aos contentores "<serviço>-<id da stack>-<timestamp>"; o timestamp muda a cada redeploy.
STACK_ID="${STACK_ID:-gpt5am2bgdzxiixn5efdygei}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/novelo}"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

STAMP="$(date +%Y%m%d-%H%M%S)"
log() { printf '%s  %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERRO: $*" >&2; exit 1; }

DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep -m1 "^db-${STACK_ID}" || true)"
[ -n "$DB_CONTAINER" ] || die "sem contentor de base de dados para a stack ${STACK_ID}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Escreve-se num ficheiro .partial e só se renomeia depois de verificar, para uma execução interrompida nunca deixar um
# ficheiro truncado com ar de backup válido.
TMP="${BACKUP_DIR}/.novelo-${STAMP}.dump.partial"
OUT="${BACKUP_DIR}/novelo-${STAMP}.dump"
log "a copiar a base de dados de ${DB_CONTAINER}"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP" || { rm -f "$TMP"; die "pg_dump falhou"; }
docker exec -i "$DB_CONTAINER" pg_restore --list > /dev/null < "$TMP" || { rm -f "$TMP"; die "a cópia não passou na verificação, não a guardo"; }
mv "$TMP" "$OUT"
chmod 600 "$OUT"
log "base de dados -> ${OUT} ($(du -h "$OUT" | cut -f1))"

# Retenção: apaga só os .dump antigos deste projeto.
find "$BACKUP_DIR" -maxdepth 1 -name 'novelo-*.dump' -mtime +"$RETAIN_DAYS" -print -delete | while read -r f; do log "apagado (mais de ${RETAIN_DAYS} dias): $f"; done
log "feito"
