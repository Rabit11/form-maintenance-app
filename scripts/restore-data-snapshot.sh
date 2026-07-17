#!/bin/bash
# 将 ../data-snapshot 中的 114 数据写入本项目的 Docker volume
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAP="$(cd "$ROOT/../data-snapshot" && pwd)"
VOL="${VOLUME_NAME:-form-maintenance-app_form-maintenance-data}"

if [ ! -f "$SNAP/platform.db" ]; then
  echo "找不到快照: $SNAP/platform.db"
  exit 1
fi

cd "$ROOT"
docker compose up -d --build
echo "等待容器就绪..."
sleep 5
docker compose stop

docker run --rm \
  -v "${VOL}:/data" \
  -v "${SNAP}:/snap" \
  alpine sh -c 'rm -rf /data/*; cp /snap/platform.db /data/; cp -a /snap/platform.db-wal /snap/platform.db-shm /data/ 2>/dev/null || true; mkdir -p /data/uploads; cp -a /snap/uploads/. /data/uploads/ 2>/dev/null || true; ls -la /data'

docker compose start
echo "数据已恢复。访问 http://<服务器IP>:${SRPM_PORT:-8086}/"
