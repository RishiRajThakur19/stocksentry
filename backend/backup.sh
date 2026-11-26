#!/usr/bin/env bash
set -euo pipefail

# StockSentry Nightly PostgreSQL Backup with Rotation (7 daily, 4 weekly) + Offsite rclone
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/stocksentry}"
DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
LOG_FILE="$BACKUP_ROOT/backup.log"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DAY_OF_WEEK="$(date -u +%u)" # 7 = Sunday
DUMP_FILE="$DAILY_DIR/stocksentry_${TIMESTAMP}.sql.gz"

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG_FILE"
}

alert_failure() {
  local msg="$1"
  log "ERROR: $msg"
  if [[ -n "${ALERT_EMAIL:-}" && -n "${SMTP_HOST:-}" ]]; then
    python3 - <<PY || true
import os, smtplib
from email.message import EmailMessage
m = EmailMessage()
m["Subject"] = "[ALERT] StockSentry Nightly Backup Failed"
m["From"] = os.environ.get("SMTP_USER", "backups@tataplayfiber.com")
m["To"] = os.environ["ALERT_EMAIL"]
m.set_content("""$msg""")
with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587")), timeout=10) as s:
    s.starttls()
    if os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"):
        s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASSWORD"])
    s.send_message(m)
PY
  fi
}

trap 'alert_failure "Backup failed at line $LINENO"' ERR

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set (postgresql://...)" >&2
  exit 1
fi

log "Starting pg_dump to $DUMP_FILE..."
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$DUMP_FILE"

if [[ "$DAY_OF_WEEK" == "7" ]]; then
  cp "$DUMP_FILE" "$WEEKLY_DIR/stocksentry_weekly_${TIMESTAMP}.sql.gz"
  log "Copied weekly snapshot."
fi

# Rotation: keep 7 daily, 4 weekly
ls -1t "$DAILY_DIR"/stocksentry_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$WEEKLY_DIR"/stocksentry_weekly_*.sql.gz 2>/dev/null | tail -n +5 | xargs -r rm -f

# Offsite copy via rclone if configured
if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  log "Syncing backups offsite to $RCLONE_REMOTE..."
  rclone copy "$BACKUP_ROOT" "$RCLONE_REMOTE" --exclude "backup.log"
fi

log "Backup completed successfully: $DUMP_FILE"
