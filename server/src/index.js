import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import api from './api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', api);
app.use('/api', (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err?.code === 'LIMIT_FILE_SIZE' ? 413 : Number(err?.status || err?.statusCode) || 500;
  const message = status >= 500 ? '服务器处理失败，请稍后重试或联系管理员查看日志' : String(err?.message || '请求处理失败');
  console.error(`[api] ${req.method} ${req.originalUrl}:`, err?.stack || err);
  res.status(status).json({ error: message });
});

// 生产/演示模式：托管前端构建产物
const dist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(join(dist, 'index.html')));
}

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`✔ 表单维护 APP @ http://localhost:${PORT}${existsSync(dist) ? '（含前端静态托管）' : ''}`);
});

