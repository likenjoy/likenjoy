#!/bin/bash
# RWA Exchange 数据库安全备份（SQLite .backup 保证一致性）
# 建议 cron：0 3 * * * /app/backend/scripts/backup.sh
set -euo pipefail

DB_PATH="${DB_PATH:-/app/data/rwa_exchange.db}"
BACKUP_DIR="${BACKUP_DIR:-/app/data/backups}"
RETENTION="${RETENTION:-30}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rwa_exchange_$TS.db"

# .backup 使用 SQLite 在线备份 API，运行中备份也安全
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
  cp "$DB_PATH" "$BACKUP_FILE"
fi

# 保留最近 N 份，删除更早的
ls -t "$BACKUP_DIR"/rwa_exchange_*.db 2>/dev/null | tail -n +$((RETENTION + 1)) | xargs -r rm -f

echo "[backup] $(date -Is) -> $BACKUP_FILE (kept $RETENTION)"
