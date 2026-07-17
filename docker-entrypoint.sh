#!/bin/sh
set -e

DB=/app/server/data/platform.db
BACKUP_DIR="${BACKUP_DIR:-/app/server/backups}"

mkdir -p "$BACKUP_DIR" /app/server/data/uploads
# 挂载宿主机目录时保证 node 用户可写
chmod 777 "$BACKUP_DIR" 2>/dev/null || true

# 首次启动（或显式要求）自动灌注演示数据；四色状态按容器当天日期锚定
if [ ! -f "$DB" ] || [ "$FORCE_SEED" = "1" ]; then
  echo "[srpm] seeding demo database (anchor date: $(date +%F)) ..."
  node /app/server/src/seed.js
else
  echo "[srpm] existing database found, skip seeding (set FORCE_SEED=1 to reset)"
fi

echo "[srpm] backup dir: $BACKUP_DIR"
echo "[srpm] starting server on port ${PORT:-8787} ..."
exec node /app/server/src/index.js
