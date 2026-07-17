#!/bin/bash
set -euo pipefail
APP=/data_SSD_21T/users/yanghuiran/yanghuiran/form-maintenance-app
cd "$APP"

echo "[1] extract if needed"
if [ -f /tmp/form-maintenance-deploy.tgz ]; then
  tar -xzf /tmp/form-maintenance-deploy.tgz -C "$APP"
fi
chmod +x docker-entrypoint.sh

echo "[2] ensure port env + backup dir"
if [ ! -f .env ]; then
  cp .env.example .env
fi
if grep -q '^SRPM_PORT=' .env; then
  sed -i 's/^SRPM_PORT=.*/SRPM_PORT=8086/' .env
else
  echo 'SRPM_PORT=8086' >> .env
fi
# 异卷冷备目录（宿主机），与 Docker named volume 分离
mkdir -p "$APP/backups"
chmod 777 "$APP/backups" 2>/dev/null || true
if ! grep -q '^BACKUP_DIR=' .env 2>/dev/null; then
  echo 'BACKUP_DIR=/app/server/backups' >> .env
fi
if ! grep -q '^BACKUP_ENV=' .env 2>/dev/null; then
  echo 'BACKUP_ENV=prod114' >> .env
fi

ROLLBACK_IMAGE="form-maintenance-app:rollback-$(date +%Y%m%d-%H%M%S)"
if docker image inspect form-maintenance-app:latest >/dev/null 2>&1; then
  docker tag form-maintenance-app:latest "$ROLLBACK_IMAGE"
fi

echo "[3] build new image while current service stays online"
docker compose -f docker-compose.yml build

echo "[4] pre-deploy database backup"
curl -fsS -X POST -H 'x-user: u_super' -H 'Content-Type: application/json' \
  http://127.0.0.1:8086/api/admin/backups -d '{}' >/tmp/form-maintenance-predeploy-backup.json 2>/dev/null || true

echo "[5] switch container"
docker compose -f docker-compose.yml up -d --no-build --force-recreate

echo "[6] health check"
sleep 5
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:8086/api/bootstrap >/dev/null 2>&1; then
    echo "OK http://10.90.111.114:8086/"
    docker ps --filter name=form-maintenance --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
    exit 0
  fi
  sleep 3
done
echo "ERROR: new version failed health check, rolling back"
docker ps --filter name=form-maintenance --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
docker logs --tail 40 form-maintenance || true
if docker image inspect "$ROLLBACK_IMAGE" >/dev/null 2>&1; then
  docker tag "$ROLLBACK_IMAGE" form-maintenance-app:latest
  docker compose -f docker-compose.yml up -d --no-build --force-recreate
fi
exit 1
