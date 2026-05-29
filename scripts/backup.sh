#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/email-relay}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="${DATABASE_URL:-}"

if [[ -z "$DATABASE_URL" ]]; then
  if [[ -f /opt/email-relay/.env ]]; then
    source /opt/email-relay/.env
  fi
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup..."

pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_DIR/email-relay-db-$TIMESTAMP.sql.gz"

echo "[$(date -Iseconds)] Backup created: $BACKUP_DIR/email-relay-db-$TIMESTAMP.sql.gz"

find "$BACKUP_DIR" -name "email-relay-db-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "[$(date -Iseconds)] Old backups cleaned (retention: $RETENTION_DAYS days)"
echo "[$(date -Iseconds)] Backup complete"
