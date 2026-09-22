#!/usr/bin/env bash
# ==============================================================================
# StockSentry Automated Database Backup Script
# ==============================================================================
# PREREQUISITES:
# 1. Install rclone on your server: sudo apt install rclone
# 2. Configure Google Drive remote named 'gdrive':
#    run 'rclone config' and follow the interactive setup for Google Drive
# 3. Add to crontab for daily execution at 2:00 AM:
#    crontab -e
#    0 2 * * * /Users/rishirajthakur/Documents/stocksentry/backend/backup.sh >> /var/log/stocksentry_backup.log 2>&1
# ==============================================================================

set -e

# Configuration
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="${BACKUP_DIR}/stocksentry.db"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TEMP_BACKUP_FILE="/tmp/stocksentry_backup_${TIMESTAMP}.db"
REMOTE_DEST="gdrive:StockSentryBackups"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting StockSentry database backup..."

if [ ! -f "${DB_FILE}" ]; then
  echo "Error: Database file ${DB_FILE} not found!"
  exit 1
fi

# 1. Copy database file to temporary timestamped backup
echo "Creating temporary local snapshot: ${TEMP_BACKUP_FILE}"
cp "${DB_FILE}" "${TEMP_BACKUP_FILE}"

# 2. Upload to Google Drive remote via rclone
echo "Uploading to Google Drive remote destination: ${REMOTE_DEST}..."
rclone copy "${TEMP_BACKUP_FILE}" "${REMOTE_DEST}"

# 3. Clean up local temporary copy
echo "Cleaning up local temp copy..."
rm -f "${TEMP_BACKUP_FILE}"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup completed successfully!"
