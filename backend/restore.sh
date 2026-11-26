#!/usr/bin/env bash
set -euo pipefail

# StockSentry PostgreSQL Restore Script
# Usage: DATABASE_URL=postgresql://... ./restore.sh /path/to/stocksentry_YYYYMMDD_HHMMSS.sql.gz

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup_file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set (postgresql://...)" >&2
  exit 1
fi

echo "Restoring $BACKUP_FILE into $DATABASE_URL..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
echo "Restore completed successfully."
