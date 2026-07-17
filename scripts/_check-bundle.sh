#!/bin/bash
docker exec form-maintenance sh -c 'ls -la /app/web/dist/assets/; echo ---; for f in /app/web/dist/assets/*.js; do echo FILE:$f; grep -c 总表模板 "$f" || true; grep -c 所中心 "$f" || true; done'
