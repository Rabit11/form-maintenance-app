import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { hashPassword } from './authPassword.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = join(DATA_DIR, 'platform.db');

export function openDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export function createSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS units (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    short TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'unit'   -- unit | hq
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    level TEXT NOT NULL,                -- 国家级 | 地方级 | 公司级
    org TEXT,                           -- 渠道部门（部委/委局）
    dept TEXT,                          -- 内部管理处室
    flow_json TEXT NOT NULL,            -- 全周期流程节点数组
    declare_json TEXT NOT NULL,         -- 申报需提交材料
    filing_json TEXT NOT NULL,          -- 立项需提交材料
    approve_chain_json TEXT NOT NULL,   -- 申报审签链（渠道差异化）
    declare_mode TEXT NOT NULL DEFAULT '审批',   -- 审批 | 报备
    assess_json TEXT NOT NULL DEFAULT '[]',      -- 评估检查内容（渠道差异化）
    enabled INTEGER NOT NULL DEFAULT 1           -- 渠道启用/终止
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS transition_type_owners (
    project_type TEXT PRIMARY KEY,
    owner_user_id TEXT,
    owner_name TEXT,
    can_import INTEGER NOT NULL DEFAULT 1,
    can_export INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transition_channel_owners (
    source_channel TEXT PRIMARY KEY,
    owner_user_id TEXT,
    owner_name TEXT,
    can_import INTEGER NOT NULL DEFAULT 1,
    can_export INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transition_import_batches (
    id INTEGER PRIMARY KEY,
    upload_id INTEGER,
    file_name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'merge',       -- merge | replace
    status TEXT NOT NULL DEFAULT '待确认',     -- 待确认 | 已入库 | 已取消 | 已撤回
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    confirmed_by TEXT,
    confirmed_at TEXT,
    backup_file TEXT,                          -- 确认入库前备份文件名（整表替换撤回用）
    parsed_count INTEGER NOT NULL DEFAULT 0,
    added_count INTEGER NOT NULL DEFAULT 0,
    updated_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    invalid_count INTEGER NOT NULL DEFAULT 0,
    report_json TEXT NOT NULL DEFAULT '{}',
    issues_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS transition_import_rows (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER NOT NULL,
    row_no INTEGER,
    identity_key TEXT,
    project_type TEXT,
    project_name TEXT,
    action TEXT NOT NULL,                     -- add | update | skip
    row_json TEXT NOT NULL,
    validation_json TEXT NOT NULL,
    issue TEXT
  );

  CREATE TABLE IF NOT EXISTS transition_records (
    id TEXT PRIMARY KEY,
    identity_key TEXT UNIQUE NOT NULL,
    project_type TEXT NOT NULL,
    project_name TEXT,
    source_file TEXT,
    source_excel_sheet TEXT,
    source_row INTEGER,
    updated_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    batch_id INTEGER,
    row_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transition_change_logs (
    id INTEGER PRIMARY KEY,
    batch_id INTEGER,
    identity_key TEXT NOT NULL,
    project_type TEXT,
    project_name TEXT,
    action TEXT NOT NULL,               -- add | update | manual | undo
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL,
    diff_json TEXT NOT NULL DEFAULT '[]',
    source_file TEXT,
    before_json TEXT,                  -- 变更前整行快照
    after_json TEXT,                   -- 变更后整行快照
    undone INTEGER NOT NULL DEFAULT 0,
    undo_of INTEGER,                   -- 指向被撤回的 log id（action=undo 时）
    undone_by TEXT,
    undone_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,                 -- team | chief | mgmt | finance | admin | leader
    scope TEXT NOT NULL DEFAULT 'unit', -- hq | unit | self
    unit_id INTEGER,
    title TEXT,
    avatar TEXT,
    status TEXT NOT NULL DEFAULT '在岗', -- 在岗 | 已离岗（权限自动回收）
    emp_no TEXT,                         -- 六位工号（账户）
    password_hash TEXT,                  -- 登录密码哈希；初始=工号
    must_change_password INTEGER NOT NULL DEFAULT 1  -- 初次登录须改密
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,          -- 平台编号 KY-2024-017
    wbs TEXT,                           -- WBS 编号
    name TEXT NOT NULL,
    goal TEXT,
    year_goal TEXT,
    level TEXT NOT NULL,
    channel_id INTEGER NOT NULL,
    lead_unit_id INTEGER NOT NULL,
    partners_json TEXT NOT NULL DEFAULT '[]',   -- [{name, work}]
    team_json TEXT NOT NULL DEFAULT '{}',       -- {owner,tech,pm,chief1,chief2,hqChief,hqStaff,unitDeptHead,unitStaff,finHq,finHead,finStaff}
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    status TEXT NOT NULL,               -- 草稿|申报中|立项中|实施中|验收中|已验收|已终止
    total_budget REAL NOT NULL,         -- 万元
    transform_status TEXT,              -- 已转化应用|接续研发立项|技术储备待应用|NULL
    accepted_at TEXT,                   -- 验收办结日期（协作评价30日倒计时锚点）
    tags_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    title TEXT NOT NULL,
    due TEXT NOT NULL,
    done_at TEXT,
    evidence TEXT,
    delay_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'CMOS',
    due TEXT NOT NULL,
    done_at TEXT,
    status TEXT NOT NULL DEFAULT '待办'  -- 待办|办结审批中|已完成
  );

  CREATE TABLE IF NOT EXISTS funds (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    budget REAL NOT NULL,
    spent REAL NOT NULL,
    writeoffs_json TEXT NOT NULL DEFAULT '[]'   -- [{date, amount, voucher, milestone}]
  );

  CREATE TABLE IF NOT EXISTS funding_pool (
    year INTEGER PRIMARY KEY,
    total REAL NOT NULL,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS funding_quota (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    unit_id INTEGER NOT NULL,
    quota REAL NOT NULL,
    paid REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS funding_requests (
    id INTEGER PRIMARY KEY,
    year INTEGER NOT NULL,
    unit_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT '待审批',  -- 待审批|已拨付|已驳回
    created_at TEXT NOT NULL,
    decided_at TEXT
  );

  CREATE TABLE IF NOT EXISTS deliverables (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,                 -- 专利|论文|软著|技术标准|原理样机|设备|成套技术成果
    due TEXT,
    delivered_at TEXT,
    owner TEXT NOT NULL DEFAULT '公司', -- 权属
    package_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,          -- 成果编号 CG-2026-001
    name TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    mode TEXT NOT NULL,                 -- 向型号转化|向市场转化
    form TEXT NOT NULL,                 -- 装机|未装机|转让|许可|联合实施|作价投资|其他
    plan_date TEXT,
    actual_date TEXT,
    status TEXT NOT NULL,               -- 未启动|洽谈中|已签协议|已完成
    brief TEXT,
    detail TEXT,
    unit_id INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS collaborators (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    ctype TEXT NOT NULL,                -- 参研|外协
    scores_json TEXT,                   -- {tech,quality,schedule,service,compliance}
    total REAL,
    grade TEXT,                         -- 优秀|良好|合格|不合格
    eval_date TEXT,
    evaluator TEXT,
    blacklisted INTEGER NOT NULL DEFAULT 0,
    note TEXT
  );

  CREATE TABLE IF NOT EXISTS post_evals (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    status TEXT NOT NULL,               -- 待启动|进行中|已完成
    deadline TEXT NOT NULL,             -- 验收后3年
    started_at TEXT,
    finished_at TEXT,
    conclusion TEXT,
    scores_json TEXT                    -- {goal,schedule,budget,output,collab,risk}
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,                 -- declaration|filing|change|data_change|milestone_close|plan_finish|acceptance|funding|package|evaluation|post_eval
    title TEXT NOT NULL,
    project_id INTEGER,
    initiator TEXT NOT NULL,
    unit_id INTEGER,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '审批中',   -- 审批中|已通过|已驳回|已撤销
    current_step INTEGER NOT NULL DEFAULT 0,
    steps_json TEXT NOT NULL,           -- [{title, assignee, role, status, at, comment}]
    payload_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS changes (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    kind TEXT NOT NULL,                 -- 项目变更|数据变更
    category TEXT,                      -- 延期|经费|外协方|付款节点|核心指标|数据修正
    detail TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT '审批中',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    phase TEXT NOT NULL,                -- 申报|立项|实施|验收|成果转化|后评价
    name TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    uploader TEXT,
    size_kb INTEGER,
    file_path TEXT                      -- 真实上传文件的存储路径（种子文档为 NULL）
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY,
    orig_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime TEXT,
    size_kb INTEGER,
    uploaded_at TEXT NOT NULL,
    uploader TEXT,
    project_id INTEGER,                 -- 归档后关联项目
    text_chars INTEGER,
    extracted_json TEXT                 -- AI 识读结果留档
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    kind TEXT NOT NULL,                 -- 里程碑|交付物|验收|经费|后评价|成果转化
    level TEXT NOT NULL,                -- red|yellow
    title TEXT NOT NULL,
    due TEXT,
    created_at TEXT NOT NULL,
    channels TEXT NOT NULL DEFAULT '站内,邮箱,蓝信',
    recipients TEXT NOT NULL DEFAULT '项目团队、对应管理团队',
    read INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    user_name TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT
  );
  `);
  migrateSchema(db);
}

/** 已有库补列 / 补表 */
export function migrateSchema(db) {
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('emp_no')) {
    db.exec('ALTER TABLE users ADD COLUMN emp_no TEXT');
  }
  if (!cols.includes('password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  }
  if (!cols.includes('must_change_password')) {
    db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1');
  }

  const logCols = db.prepare('PRAGMA table_info(transition_change_logs)').all().map((c) => c.name);
  if (logCols.length) {
    if (!logCols.includes('before_json')) db.exec('ALTER TABLE transition_change_logs ADD COLUMN before_json TEXT');
    if (!logCols.includes('after_json')) db.exec('ALTER TABLE transition_change_logs ADD COLUMN after_json TEXT');
    if (!logCols.includes('undone')) db.exec('ALTER TABLE transition_change_logs ADD COLUMN undone INTEGER NOT NULL DEFAULT 0');
    if (!logCols.includes('undo_of')) db.exec('ALTER TABLE transition_change_logs ADD COLUMN undo_of INTEGER');
    if (!logCols.includes('undone_by')) db.exec('ALTER TABLE transition_change_logs ADD COLUMN undone_by TEXT');
    if (!logCols.includes('undone_at')) db.exec('ALTER TABLE transition_change_logs ADD COLUMN undone_at TEXT');
  }

  const batchCols = db.prepare('PRAGMA table_info(transition_import_batches)').all().map((c) => c.name);
  if (batchCols.length && !batchCols.includes('backup_file')) {
    db.exec('ALTER TABLE transition_import_batches ADD COLUMN backup_file TEXT');
  }

  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_emp_no
    ON users(emp_no) WHERE emp_no IS NOT NULL AND emp_no != ''`);
  db.exec(`CREATE TABLE IF NOT EXISTS transition_channel_owners (
    source_channel TEXT PRIMARY KEY,
    owner_user_id TEXT,
    owner_name TEXT,
    can_import INTEGER NOT NULL DEFAULT 1,
    can_export INTEGER NOT NULL DEFAULT 1
  )`);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transition_records_type ON transition_records(project_type);
    CREATE INDEX IF NOT EXISTS idx_transition_records_batch ON transition_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_transition_import_batches_status ON transition_import_batches(status, id DESC);
    CREATE INDEX IF NOT EXISTS idx_transition_import_rows_batch_action ON transition_import_rows(batch_id, action);
    CREATE INDEX IF NOT EXISTS idx_transition_change_logs_batch ON transition_change_logs(batch_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_unit_status ON projects(lead_unit_id, status);
    CREATE INDEX IF NOT EXISTS idx_funds_project_year ON funds(project_id, year);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status, created_at);
  `);
}

/** 超级管理员 + 渠道专员等账号，统一六位工号（密码 = 工号） */
export function ensureAuthAccounts(db) {
  const EMP_NOS = {
    u_super: '100001',
    u_leader: '110001',
    u_hq: '200001',
    u_hq_staff: '200002',
    u_ch_miit: '201001',
    u_ch_most: '201002',
    u_ch_ndrc: '201003',
    u_ch_shkc: '201004',
    u_ch_zgsf: '201005',
  };

  const upsertUser = db.prepare(`INSERT INTO users (id,name,role,scope,unit_id,title,status,emp_no)
    VALUES (?,?,?,?,?,?, '在岗', ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      role=excluded.role,
      scope=excluded.scope,
      unit_id=excluded.unit_id,
      title=excluded.title,
      emp_no=COALESCE(NULLIF(users.emp_no,''), excluded.emp_no)`);

  // 原「系统管理员」(u_admin/100002) 已并入系统超级管理员，仅保留单一运维账号
  upsertUser.run('u_super', '系统超级管理员', 'admin', 'hq', 7, '系统超级管理员 / 人员添加·删除·权限编辑', '100001');
  try { db.prepare("DELETE FROM users WHERE id='u_admin' OR emp_no='100002'").run(); } catch { /* ignore */ }
  upsertUser.run('u_leader', '周明远', 'leader', 'hq', 7, '总部领导 / 决策查看只读', '110001');
  upsertUser.run('u_hq', '王建国', 'mgmt', 'hq', 7, '总部总维护 / 责任处室处长', '200001');
  upsertUser.run('u_hq_staff', '何雨桐', 'mgmt', 'hq', 7, '总部总维护 / 科研项目主管', '200002');
  // 总部层级渠道专员（可读全部，仅可改本人负责层级下的渠道）
  upsertUser.run('u_ch_miit', '梁承泽', 'mgmt', 'channel', 7, '总部层级渠道专员 / 国家级', '201001');
  upsertUser.run('u_ch_most', '纪清岚', 'mgmt', 'channel', 7, '总部层级渠道专员 / 国家级', '201002');
  upsertUser.run('u_ch_ndrc', '唐砚秋', 'mgmt', 'channel', 7, '总部层级渠道专员 / 国家级', '201003');
  upsertUser.run('u_ch_shkc', '许怀川', 'mgmt', 'channel', 7, '总部层级渠道专员 / 地方级', '201004');
  upsertUser.run('u_ch_zgsf', '韩叙白', 'mgmt', 'channel', 7, '总部层级渠道专员 / 公司级', '201005');
  // 已取消「二级单位项目管理团队负责人」角色账号
  try {
    db.prepare("DELETE FROM users WHERE id IN ('u_unit_mgr','u_unit_pm') OR emp_no IN ('210001','210002')").run();
  } catch { /* ignore */ }

  // 删除各二级单位人员账号（所属单位 kind=unit；不含总部 hq）
  try {
    db.prepare(`DELETE FROM users WHERE id IN (
      'u_team_owner','u_team_tech','u_team_pm','u_chief2','u_fin_head','u_fin_staff','u_fin'
    ) OR emp_no IN (
      '120001','120002','120003','130002','140001','140002','140003'
    )`).run();
    db.prepare(`DELETE FROM users WHERE unit_id IN (SELECT id FROM units WHERE kind='unit')`).run();
  } catch { /* ignore */ }

  // 删除一级总师、项目类型主管账号（表单维护侧仅保留超管/领导/总部总维护/渠道专员）
  try {
    db.prepare(`DELETE FROM users WHERE id IN (
      'u_chief',
      'u_type_nat','u_type_rd','u_type_local','u_type_corp','u_type_lab','u_type_coop','u_type_misc'
    ) OR emp_no IN (
      '130001','300001','300002','300003','300004','300005','300006','300007'
    ) OR (role='chief') OR (role='mgmt' AND scope='type')`).run();
    db.prepare(`UPDATE transition_type_owners SET owner_user_id='' WHERE owner_user_id LIKE 'u_type_%'`).run();
  } catch { /* ignore */ }

  const upd = db.prepare(`UPDATE users SET emp_no=? WHERE id=? AND (emp_no IS NULL OR emp_no='')`);
  for (const [id, empNo] of Object.entries(EMP_NOS)) {
    upd.run(empNo, id);
  }

  // 为尚无密码的账号写入初始密码（=工号），并标记须改密
  ensureInitialPasswords(db);
  // 内置演示账号允许跳过强制改密直接进入（人员管理新建账号仍须首次改密）
  allowDemoSkipPasswordChange(db);
}

/** 缺省密码：工号；已有 password_hash 的不覆盖 */
export function ensureInitialPasswords(db) {
  const rows = db.prepare(`SELECT id, emp_no, password_hash FROM users
    WHERE emp_no IS NOT NULL AND emp_no != ''`).all();
  const setPwd = db.prepare(`UPDATE users SET password_hash=?, must_change_password=1
    WHERE id=? AND (password_hash IS NULL OR password_hash='')`);
  for (const row of rows) {
    if (row.password_hash) continue;
    setPwd.run(hashPassword(row.emp_no), row.id);
  }
}

/** 登录页「角色演示」内置账号：不强制改密，可一键进入 */
const DEMO_LOGIN_IDS = [
  'u_super', 'u_leader', 'u_hq', 'u_hq_staff',
  'u_ch_miit', 'u_ch_most', 'u_ch_ndrc', 'u_ch_shkc', 'u_ch_zgsf',
];

export function allowDemoSkipPasswordChange(db) {
  const stmt = db.prepare('UPDATE users SET must_change_password=0 WHERE id=?');
  for (const id of DEMO_LOGIN_IDS) stmt.run(id);
}
