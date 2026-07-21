import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {
  evaluateBatchUndo,
  evaluateLogUndo,
  findUserLatestStep,
  laterChangeExists,
  logHasUndoSnapshot,
  matchActorName,
} from '../src/transitionUndo.js';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE transition_change_logs (
      id INTEGER PRIMARY KEY,
      batch_id INTEGER,
      identity_key TEXT NOT NULL,
      project_type TEXT,
      project_name TEXT,
      action TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      diff_json TEXT NOT NULL DEFAULT '[]',
      source_file TEXT,
      before_json TEXT,
      after_json TEXT,
      undone INTEGER NOT NULL DEFAULT 0,
      undo_of INTEGER,
      undone_by TEXT,
      undone_at TEXT
    );
    CREATE TABLE transition_import_batches (
      id INTEGER PRIMARY KEY,
      file_name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'merge',
      status TEXT NOT NULL DEFAULT '待确认',
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      confirmed_by TEXT,
      confirmed_at TEXT,
      backup_file TEXT
    );
  `);
  return db;
}

test('matchActorName 支持姓名/工号前缀', () => {
  assert.equal(matchActorName('王建国/200001', '王建国'), true);
  assert.equal(matchActorName('王建国', '王建国'), true);
  assert.equal(matchActorName('何雨桐/200002', '王建国'), false);
});

test('本人仅可撤回最近一步；有后续变更则拒绝', () => {
  const db = makeDb();
  const ins = db.prepare(`INSERT INTO transition_change_logs
    (identity_key,project_type,project_name,action,changed_by,changed_at,before_json,after_json,undone)
    VALUES (?,?,?,?,?,?,?,?,0)`);
  ins.run('k1', 'MJKY', '项目A', 'manual', '王建国/200001', '2026-07-20 10:00:00',
    JSON.stringify({ name: '项目A', totalBudget: 100 }),
    JSON.stringify({ name: '项目A', totalBudget: 120 }));
  ins.run('k1', 'MJKY', '项目A', 'manual', '王建国/200001', '2026-07-20 11:00:00',
    JSON.stringify({ name: '项目A', totalBudget: 120 }),
    JSON.stringify({ name: '项目A', totalBudget: 150 }));

  const older = db.prepare('SELECT * FROM transition_change_logs WHERE id=1').get();
  const newer = db.prepare('SELECT * FROM transition_change_logs WHERE id=2').get();
  const user = { name: '王建国', role: 'mgmt', scope: 'channel' };

  assert.equal(laterChangeExists(db, 'k1', 1), true);
  assert.equal(evaluateLogUndo(db, older, user).ok, false);
  assert.match(evaluateLogUndo(db, older, user).reason, /后续已再次修改/);

  const latest = findUserLatestStep(db, '王建国');
  assert.equal(latest?.logId, 2);
  assert.equal(evaluateLogUndo(db, newer, user).ok, true);

  const other = { name: '梁承泽', role: 'mgmt', scope: 'channel' };
  assert.equal(evaluateLogUndo(db, newer, other).ok, false);
  assert.match(evaluateLogUndo(db, newer, other).reason, /本人最近一步/);
});

test('总部可撤非本人步骤；无快照旧日志不可撤', () => {
  const db = makeDb();
  db.prepare(`INSERT INTO transition_change_logs
    (identity_key,project_type,project_name,action,changed_by,changed_at,before_json,after_json,undone)
    VALUES ('k2','MJKY','项目B','manual','梁承泽/201001','2026-07-20 12:00:00',NULL,?,0)`)
    .run(JSON.stringify({ name: '项目B' }));
  const log = db.prepare('SELECT * FROM transition_change_logs WHERE id=1').get();
  assert.equal(logHasUndoSnapshot(log), false);
  const hq = { name: '王建国', role: 'mgmt', scope: 'hq' };
  const gate = evaluateLogUndo(db, log, hq);
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /历史记录不支持撤回/);
});

test('批次撤回：批后改行则失败；replace 无备份则失败', () => {
  const db = makeDb();
  db.prepare(`INSERT INTO transition_import_batches
    (id,file_name,mode,status,uploaded_by,uploaded_at,confirmed_by,confirmed_at,backup_file)
    VALUES (1,'a.xlsx','merge','已入库','王建国/200001','2026-07-20','王建国/200001','2026-07-20',NULL)`).run();
  db.prepare(`INSERT INTO transition_change_logs
    (batch_id,identity_key,project_type,project_name,action,changed_by,changed_at,before_json,after_json,undone)
    VALUES (1,'k3','MJKY','项目C','update','王建国/200001','2026-07-20 13:00:00',?,?,0)`)
    .run(JSON.stringify({ name: '项目C', totalBudget: 1 }), JSON.stringify({ name: '项目C', totalBudget: 2 }));
  db.prepare(`INSERT INTO transition_change_logs
    (identity_key,project_type,project_name,action,changed_by,changed_at,before_json,after_json,undone)
    VALUES ('k3','MJKY','项目C','manual','何雨桐/200002','2026-07-20 14:00:00',?,?,0)`)
    .run(JSON.stringify({ name: '项目C', totalBudget: 2 }), JSON.stringify({ name: '项目C', totalBudget: 3 }));

  const batch = db.prepare('SELECT * FROM transition_import_batches WHERE id=1').get();
  const hq = { name: '王建国', role: 'mgmt', scope: 'hq' };
  const gate = evaluateBatchUndo(db, batch, hq);
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /后续已再次修改/);

  db.prepare(`INSERT INTO transition_import_batches
    (id,file_name,mode,status,uploaded_by,uploaded_at,backup_file)
    VALUES (2,'b.xlsx','replace','已入库','王建国/200001','2026-07-20',NULL)`).run();
  const replace = db.prepare('SELECT * FROM transition_import_batches WHERE id=2').get();
  const g2 = evaluateBatchUndo(db, replace, hq);
  assert.equal(g2.ok, false);
  assert.match(g2.reason, /备份/);
});

test('整表替换之后若有后续修改则不可撤', async () => {
  const { writeFileSync, unlinkSync, mkdirSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { resolveBackupDir } = await import('../src/backup.js');
  const db = makeDb();
  const dir = resolveBackupDir();
  mkdirSync(dir, { recursive: true });
  const fakeName = `_test_replace_undo_${process.pid}.db`;
  const fakePath = join(dir, fakeName);
  writeFileSync(fakePath, 'sqlite-placeholder');
  try {
    db.prepare(`INSERT INTO transition_import_batches
      (id,file_name,mode,status,uploaded_by,uploaded_at,backup_file)
      VALUES (1,'c.xlsx','replace','已入库','王建国/200001','2026-07-20',?)`).run(fakeName);
    db.prepare(`INSERT INTO transition_change_logs
      (batch_id,identity_key,project_type,project_name,action,changed_by,changed_at,before_json,after_json,undone)
      VALUES (1,'k4','MJKY','项目D','add','王建国/200001','2026-07-20 15:00:00',NULL,?,0)`)
      .run(JSON.stringify({ name: '项目D' }));
    db.prepare(`INSERT INTO transition_change_logs
      (identity_key,project_type,project_name,action,changed_by,changed_at,before_json,after_json,undone)
      VALUES ('k4','MJKY','项目D','manual','何雨桐/200002','2026-07-20 16:00:00',?,?,0)`)
      .run(JSON.stringify({ name: '项目D', totalBudget: 1 }), JSON.stringify({ name: '项目D', totalBudget: 2 }));
    const batch = db.prepare('SELECT * FROM transition_import_batches WHERE id=1').get();
    const hq = { name: '王建国', role: 'mgmt', scope: 'hq' };
    const gate = evaluateBatchUndo(db, batch, hq);
    assert.equal(gate.ok, false);
    assert.match(gate.reason, /后续修改/);
  } finally {
    if (existsSync(fakePath)) unlinkSync(fakePath);
  }
});
