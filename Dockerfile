# ============================================================
# 科研项目信息化管理平台 · 演示版
# 多阶段构建：前端构建 → 服务端依赖 → 精简运行时
# 基础镜像用 bookworm-slim（glibc），better-sqlite3 预编译二进制可直接使用
# ============================================================

# 国内服务器构建加速（.env 中已默认配置）：
#   docker compose build 自动读取 NPM_REGISTRY / APT_MIRROR
#   或手动：docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com --build-arg APT_MIRROR=mirrors.aliyun.com .
ARG NPM_REGISTRY=https://registry.npmjs.org
ARG APT_MIRROR=

# ---- Stage 1: 前端构建 ----
FROM node:22-bookworm-slim AS webbuild
ARG NPM_REGISTRY
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund --registry=$NPM_REGISTRY
COPY web/ ./
RUN npm run build

# ---- Stage 2: 服务端生产依赖 ----
FROM node:22-bookworm-slim AS serverdeps
ARG NPM_REGISTRY
ARG APT_MIRROR
# 装编译工具兜底：万一 better-sqlite3 预编译包下载失败时可从源码构建
RUN if [ -n "$APT_MIRROR" ]; then sed -i "s|deb.debian.org|$APT_MIRROR|g" /etc/apt/sources.list.d/debian.sources; fi \
    && apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /build/server
COPY server/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund --registry=$NPM_REGISTRY

# ---- Stage 3: 运行时 ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    PORT=8787
WORKDIR /app

COPY --from=serverdeps /build/server/node_modules server/node_modules
COPY server/package.json server/package.json
COPY server/src server/src
COPY server/config server/config
COPY server/ai.config.example.json server/ai.config.example.json
COPY server/templates server/templates
COPY --from=webbuild /build/web/dist web/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/server/data/uploads /app/server/backups \
    && chown -R node:node /app

USER node
EXPOSE 8787
VOLUME ["/app/server/data", "/app/server/backups"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/bootstrap').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
