/**
 * 数据库备份（方案 Phase A）
 * - SQLite Online Backup，禁止直接拷贝运行中 db/WAL
 * - 异卷目录：默认 server/backups（Docker 挂载宿主机 ./backups）
 * - 命名：{env}_{yyyyMMdd_HHmmss}_{reason}_{sha8}.db
 * - 旁路写入 .sha256 与 MANIFEST.jsonl
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { DB_PATH } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 容器内默认 /app/server/backups；本地默认 server/backups；可用 BACKUP_DIR 覆盖 */
export function resolveBackupDir() {
  const fromEnv = String(process.env.BACKUP_DIR || '').trim();
  if (fromEnv) return fromEnv;
  return join(__dirname, '..', 'backups');
}

export const BACKUP_DIR = resolveBackupDir();

const RETENTION_DAYS = {
  daily: Number(process.env.BACKUP_KEEP_DAILY_DAYS || 30),
  weekly: Number(process.env.BACKUP_KEEP_WEEKLY_DAYS || 84), // 12 周
  checkpoint: Number(process.env.BACKUP_KEEP_CHECKPOINT_DAYS || 7),
  manual: Number(process.env.BACKUP_KEEP_MANUAL_DAYS || 30),
  'pre-confirm': Number(process.env.BACKUP_KEEP_CHECKPOINT_DAYS || 7),
  'pre-replace': Number(process.env.BACKUP_KEEP_CHECKPOINT_DAYS || 7),
  'pre-demo': Number(process.env.BACKUP_KEEP_CHECKPOINT_DAYS || 7),
  hourly: Number(process.env.BACKUP_KEEP_CHECKPOINT_DAYS || 7),
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function stampLocal(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function envTag() {
  return String(process.env.BACKUP_ENV || process.env.NODE_ENV || 'local')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 24) || 'local';
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

async function gzipFile(src, dest) {
  await pipeline(createReadStream(src), createGzip({ level: 6 }), createWriteStream(dest));
}

function reasonKey(reason) {
  return String(reason || 'manual').replace(/[^\w.-]+/g, '_').slice(0, 40);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ reason?: string, actor?: string, gzip?: boolean }} [opts]
 */
export async function createDatabaseBackup(db, opts = {}) {
  const reason = reasonKey(opts.reason || 'manual');
  const actor = opts.actor || 'system';
  const wantGzip = opts.gzip !== false && process.env.BACKUP_GZIP !== '0';
  const dir = ensureDir(resolveBackupDir());

  if (!existsSync(DB_PATH)) {
    throw new Error(`业务库不存在：${DB_PATH}`);
  }

  // 尽量落盘 WAL，再做在线备份
  try { db.pragma('wal_checkpoint(PASSIVE)'); } catch { /* ignore */ }

  const tmpPath = join(dir, `.tmp_${stampLocal()}_${process.pid}_${randomUUID().slice(0, 8)}.db`);
  await db.backup(tmpPath);

  const contentSha256 = sha256File(tmpPath);
  const sha8 = contentSha256.slice(0, 8);
  const baseName = `${envTag()}_${stampLocal()}_${reason}_${sha8}`;
  const dbName = `${baseName}.db`;
  const dbPath = join(dir, dbName);
  renameSync(tmpPath, dbPath);

  let finalPath = dbPath;
  let finalName = dbName;
  let bytes = statSync(dbPath).size;

  if (wantGzip) {
    const gzPath = `${dbPath}.gz`;
    await gzipFile(dbPath, gzPath);
    unlinkSync(dbPath);
    finalPath = gzPath;
    finalName = `${dbName}.gz`;
    bytes = statSync(gzPath).size;
  }

  const archiveSha256 = sha256File(finalPath);
  writeFileSync(`${finalPath}.sha256`, `${archiveSha256}  ${finalName}\n`, 'utf8');

  const record = {
    at: new Date().toISOString(),
    env: envTag(),
    reason,
    actor,
    file: finalName,
    path: finalPath,
    bytes,
    sha256: archiveSha256,
    archiveSha256,
    contentSha256,
    sourceDb: DB_PATH,
  };
  appendFileSync(join(dir, 'MANIFEST.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
  pruneOldBackups(dir);
  return record;
}

function parseBackupMeta(fileName) {
  // env_yyyyMMdd_HHmmss_reason_sha8.db[.gz]
  const m = fileName.match(/^(.+?)_(\d{8}_\d{6})_(.+)_([a-f0-9]{8})\.db(\.gz)?$/i);
  if (!m) return null;
  return { env: m[1], stamp: m[2], reason: m[3], sha8: m[4], gzip: Boolean(m[5]) };
}

function stampToDate(stamp) {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

export function listBackups(limit = 50) {
  const dir = resolveBackupDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => /\.db(\.gz)?$/i.test(f) && !f.startsWith('.'))
    .map((file) => {
      const full = join(dir, file);
      const st = statSync(full);
      const meta = parseBackupMeta(file) || {};
      let sha256 = '';
      const side = `${full}.sha256`;
      if (existsSync(side)) {
        sha256 = readFileSync(side, 'utf8').trim().split(/\s+/)[0] || '';
      }
      return {
        file,
        path: full,
        bytes: st.size,
        mtime: st.mtime.toISOString(),
        reason: meta.reason || 'unknown',
        stamp: meta.stamp || '',
        sha256,
        sha8: meta.sha8 || sha256.slice(0, 8),
      };
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  return files.slice(0, limit);
}

export function pruneOldBackups(dir = resolveBackupDir()) {
  if (!existsSync(dir)) return { removed: 0 };
  const now = Date.now();
  let removed = 0;
  for (const file of readdirSync(dir)) {
    if (!/\.db(\.gz)?$/i.test(file) || file.startsWith('.')) continue;
    const meta = parseBackupMeta(file);
    if (!meta) continue;
    const created = stampToDate(meta.stamp);
    if (!created) continue;
    const reason = meta.reason;
    let keepDays = RETENTION_DAYS.checkpoint;
    if (reason === 'daily') keepDays = RETENTION_DAYS.daily;
    else if (reason === 'weekly') keepDays = RETENTION_DAYS.weekly;
    else if (reason === 'manual') keepDays = RETENTION_DAYS.manual;
    else keepDays = RETENTION_DAYS[reason] ?? RETENTION_DAYS.checkpoint;
    const ageMs = now - created.getTime();
    if (ageMs <= keepDays * 86400000) continue;
    const full = join(dir, file);
    try {
      unlinkSync(full);
      if (existsSync(`${full}.sha256`)) unlinkSync(`${full}.sha256`);
      removed += 1;
    } catch { /* ignore */ }
  }
  return { removed };
}

/** 日备：每天一份；周一额外打 weekly 标签 */
export async function ensureScheduledBackups(db) {
  const dir = ensureDir(resolveBackupDir());
  const today = stampLocal().slice(0, 8); // yyyyMMdd
  const hasDaily = readdirSync(dir).some((f) => f.includes(`_${today}_`) && f.includes('_daily_'));
  const results = [];
  if (!hasDaily) {
    results.push(await createDatabaseBackup(db, { reason: 'daily', actor: 'scheduler' }));
  }
  const dow = new Date().getDay(); // 0 Sun ... 1 Mon
  if (dow === 1) {
    const hasWeekly = readdirSync(dir).some((f) => f.includes(`_${today}_`) && f.includes('_weekly_'));
    if (!hasWeekly) {
      results.push(await createDatabaseBackup(db, { reason: 'weekly', actor: 'scheduler' }));
    }
  }
  return results;
}

let schedulerStarted = false;
let schedulerRunning = false;

export function startBackupScheduler(db) {
  if (schedulerStarted) return;
  if (process.env.BACKUP_SCHEDULER === '0') return;
  schedulerStarted = true;
  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      await ensureScheduledBackups(db);
    } catch (err) {
      console.error('[backup] scheduled backup failed:', err?.message || err);
    } finally {
      schedulerRunning = false;
    }
  };
  // 启动后稍晚检查一次，之后每小时检查（到点才真正写 daily）
  setTimeout(tick, 15_000);
  setInterval(tick, 60 * 60 * 1000);
}

export function backupDirInfo() {
  const dir = resolveBackupDir();
  ensureDir(dir);
  return {
    backupDir: dir,
    sourceDb: DB_PATH,
    keepDays: { ...RETENTION_DAYS },
    count: listBackups(1000).length,
  };
}
