/**
 * 表单维护 · 撤回（undo）规则与回滚
 * 方案：doc/预先研究项目信息维护平台-撤回操作方案.html
 */
import Database from 'better-sqlite3';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { resolveBackupDir } from './backup.js';

export function matchActorName(changedBy, userName) {
  const by = String(changedBy || '').trim();
  const name = String(userName || '').trim();
  if (!name || !by) return false;
  return by === name || by.startsWith(`${name}/`);
}

export function isHqOrAdminUser(user) {
  return user?.role === 'admin' || (user?.role === 'mgmt' && user?.scope === 'hq');
}

/** 本人最近一步：按 id DESC 的第一条未撤回业务留痕（undo 自身不计） */
export function findUserLatestStep(db, userName) {
  const name = String(userName || '').trim();
  if (!name) return null;
  const row = db.prepare(`
    SELECT id, batch_id FROM transition_change_logs
    WHERE IFNULL(undone, 0) = 0 AND action != 'undo'
      AND (changed_by = ? OR changed_by LIKE ?)
    ORDER BY id DESC LIMIT 1
  `).get(name, `${name}/%`);
  if (!row) return null;
  if (row.batch_id != null) return { type: 'batch', batchId: Number(row.batch_id), logId: row.id };
  return { type: 'log', logId: row.id, batchId: null };
}

export function laterChangeExists(db, identityKey, afterId) {
  if (!identityKey) return false;
  return Boolean(db.prepare(`
    SELECT 1 AS ok FROM transition_change_logs
    WHERE identity_key = ? AND id > ? AND IFNULL(undone, 0) = 0 AND action != 'undo'
    LIMIT 1
  `).get(identityKey, afterId));
}

/** 单条在线变更是否具备撤回快照 */
export function logHasUndoSnapshot(log) {
  if (!log || Number(log.undone) === 1 || log.action === 'undo') return false;
  if (log.action === 'add') return true;
  if (log.action === 'update' || log.action === 'manual') {
    return Boolean(log.before_json && String(log.before_json).trim());
  }
  return false;
}

/**
 * 评估单条 changeLog 能否撤回
 * @returns {{ ok: boolean, reason: string }}
 */
export function evaluateLogUndo(db, log, user, { canWriteRow } = {}) {
  if (!log) return { ok: false, reason: '变更记录不存在' };
  if (log.action === 'undo') return { ok: false, reason: '撤回留痕不可再撤' };
  if (Number(log.undone) === 1) return { ok: false, reason: '该步骤已撤回' };
  if (log.batch_id != null) {
    return { ok: false, reason: '批次入库变更请使用「撤回本批」' };
  }
  if (!logHasUndoSnapshot(log)) {
    return { ok: false, reason: '历史记录不支持撤回（缺少变更前快照）' };
  }
  if (laterChangeExists(db, log.identity_key, log.id)) {
    return { ok: false, reason: '该项目后续已再次修改，请先撤回更新的步骤' };
  }
  const hq = isHqOrAdminUser(user);
  if (!hq) {
    const latest = findUserLatestStep(db, user?.name);
    if (!latest || latest.type !== 'log' || latest.logId !== log.id) {
      return { ok: false, reason: '仅可撤回本人最近一步操作' };
    }
    if (typeof canWriteRow === 'function') {
      let row = null;
      try { row = log.after_json ? JSON.parse(log.after_json) : null; } catch { row = null; }
      if (row && !canWriteRow(row)) {
        return { ok: false, reason: '当前账号对该项目无写权限，无法撤回' };
      }
    }
  }
  return { ok: true, reason: '' };
}

/**
 * 评估已入库批次能否撤回
 */
export function evaluateBatchUndo(db, batch, user, { canWriteRow } = {}) {
  if (!batch) return { ok: false, reason: '导入批次不存在' };
  if (batch.status !== '已入库') return { ok: false, reason: '仅已入库批次可撤回' };
  const hq = isHqOrAdminUser(user);
  if (batch.mode === 'replace' && !hq) {
    return { ok: false, reason: '整表替换仅总部总维护或超管可撤回' };
  }
  if (!hq) {
    const latest = findUserLatestStep(db, user?.name);
    if (!latest || latest.type !== 'batch' || latest.batchId !== Number(batch.id)) {
      return { ok: false, reason: '仅可撤回本人最近一步（本批确认）' };
    }
  }
  if (batch.mode === 'replace') {
    if (!batch.backup_file) {
      return { ok: false, reason: '缺少确认前备份，无法安全撤回整表替换，请联系运维用备份恢复' };
    }
    const full = resolveBackupPath(batch.backup_file);
    if (!full) {
      return { ok: false, reason: '确认前备份文件不可用，请联系运维用备份恢复' };
    }
    const logs = db.prepare(`
      SELECT * FROM transition_change_logs
      WHERE batch_id = ? AND IFNULL(undone, 0) = 0 AND action != 'undo'
      ORDER BY id DESC
    `).all(batch.id);
    const maxLogId = logs.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
    const later = db.prepare(`
      SELECT project_name, identity_key FROM transition_change_logs
      WHERE id > ? AND IFNULL(undone, 0) = 0 AND action != 'undo'
        AND (batch_id IS NULL OR batch_id != ?)
      ORDER BY id DESC LIMIT 5
    `).all(maxLogId, batch.id);
    if (later.length) {
      const sample = [...new Set(later.map((x) => x.project_name || x.identity_key))].slice(0, 3).join('、');
      return {
        ok: false,
        reason: `整表替换之后已有后续修改（如 ${sample}），请先撤回更新的步骤`,
      };
    }
    return { ok: true, reason: '', logs, backupPath: full };
  }

  const logs = db.prepare(`
    SELECT * FROM transition_change_logs
    WHERE batch_id = ? AND IFNULL(undone, 0) = 0 AND action != 'undo'
    ORDER BY id DESC
  `).all(batch.id);
  if (!logs.length) return { ok: false, reason: '该批次无可撤回的变更留痕' };

  const conflicts = [];
  for (const log of logs) {
    if (!logHasUndoSnapshot(log) && log.action !== 'add') {
      return { ok: false, reason: '历史记录不支持撤回（批次内缺少变更前快照）' };
    }
    if (laterChangeExists(db, log.identity_key, log.id)) {
      conflicts.push(log.project_name || log.identity_key);
    }
    if (!hq && typeof canWriteRow === 'function') {
      let row = null;
      try { row = log.after_json ? JSON.parse(log.after_json) : null; } catch { row = null; }
      if (row && !canWriteRow(row)) {
        return { ok: false, reason: `无权撤回项目「${log.project_name || log.identity_key}」` };
      }
    }
  }
  if (conflicts.length) {
    const sample = [...new Set(conflicts)].slice(0, 3).join('、');
    return {
      ok: false,
      reason: `该批次内项目后续已再次修改（如 ${sample}），请先撤回更新的步骤`,
    };
  }
  return { ok: true, reason: '', logs };
}

export function resolveBackupPath(backupFile) {
  if (!backupFile) return null;
  const name = String(backupFile).replace(/[/\\]/g, '');
  if (!name || name.includes('..')) return null;
  const full = join(resolveBackupDir(), name);
  return existsSync(full) ? full : null;
}

/** 从确认前备份恢复 transition_records（整表替换撤回） */
export function restoreTransitionRecordsFromBackup(liveDb, backupPath, upsertRow) {
  let openPath = backupPath;
  let tmp = null;
  if (/\.gz$/i.test(backupPath)) {
    tmp = join(resolveBackupDir(), `.tmp_undo_${Date.now()}_${process.pid}.db`);
    writeFileSync(tmp, gunzipSync(readFileSync(backupPath)));
    openPath = tmp;
  }
  const src = new Database(openPath, { readonly: true, fileMustExist: true });
  try {
    const rows = src.prepare('SELECT * FROM transition_records').all();
    liveDb.prepare('DELETE FROM transition_records').run();
    for (const r of rows) {
      const row = JSON.parse(r.row_json);
      upsertRow(row, r.batch_id ?? null);
    }
    return rows.length;
  } finally {
    src.close();
    if (tmp && existsSync(tmp)) {
      try { unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
}

/**
 * 应用单条回滚（不写 undo 留痕、不标 undone；由调用方事务内统一处理）
 */
export function applyLogRollback(db, log, { upsertRow, deleteByIdentity }) {
  if (log.action === 'add') {
    deleteByIdentity(log.identity_key);
    return;
  }
  if (log.action === 'update' || log.action === 'manual') {
    if (!log.before_json) throw new Error('历史记录不支持撤回（缺少变更前快照）');
    const before = JSON.parse(log.before_json);
    upsertRow(before, null);
    return;
  }
  throw new Error(`不支持撤回的动作：${log.action}`);
}
