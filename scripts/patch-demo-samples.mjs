import fs from 'fs';

const p = 'server/src/api.js';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes("from './demoSamples.js'")) {
  s = s.replace(
    "import { aiStatus, extractProjectInfo } from './ai.js';",
    "import { aiStatus, extractProjectInfo } from './ai.js';\nimport { buildRichDemoCases, DEMO_UNITS, DEMO_MAJORS, DEMO_OWNERS, DEMO_UPDATERS, DEMO_RESULT_POOL, DEMO_MODELS } from './demoSamples.js';",
  );
}

const start = s.indexOf('function defaultTransitionRows()');
const end = s.indexOf('const transitionKey =', start);
if (start < 0 || end < 0) throw new Error('bounds not found');

const replacement = `function defaultTransitionRows() {
  const units = DEMO_UNITS;
  const majors = DEMO_MAJORS;
  const owners = DEMO_OWNERS;
  const updaters = DEMO_UPDATERS;
  const resultPool = DEMO_RESULT_POOL;
  const models = DEMO_MODELS;
  const cases = buildRichDemoCases();

  return cases.map((c, i) => {
    const unit = units[i % units.length];
    const [major1, major2] = majors[i % majors.length];
    const total = Math.round((c.budget || (280 + (i % 17) * 380 + (c.level === '国家级' ? 1800 : c.level === '地方级' ? 600 : 120))) * 10) / 10;
    const split = fundSplit(total, c.level);
    const startY = 2022 + (i % 4);
    const endY = startY + 2 + (i % 3);
    const startMonth = \`\${startY}.\${(i % 9) + 1}\`;
    const endMonth = \`\${endY}.\${((i + 4) % 9) + 1}\`;
    const spentRatio = c.status === '已完成' ? 0.92 : c.status === '延期' ? 0.78 : c.status === '立项中' ? 0.08 : 0.28 + (i % 6) * 0.09;
    const spent = Math.round(total * spentRatio * 10) / 10;
    const budget2026 = Math.round(total * (c.status === '已完成' ? 0.05 : 0.16 + (i % 5) * 0.02) * 10) / 10;
    const budget2026Actual = Math.round(budget2026 * (0.35 + (i % 7) * 0.08) * 10) / 10;
    const done = c.status === '已完成';
    const resultNames = c.result > 0
      ? Array.from({ length: c.result }, (_, k) => \`\${resultPool[(i + k) % resultPool.length]}（\${c.name.slice(0, 8)}）\`).join('；')
      : '';
    const convertedNames = c.converted > 0
      ? Array.from({ length: c.converted }, (_, k) => \`\${models[(i + k) % models.length]}应用包-\${k + 1}\`).join('；')
      : '';
    const reserveNames = c.reserve > 0
      ? Array.from({ length: c.reserve }, (_, k) => \`技术储备-\${resultPool[(i + k + 3) % resultPool.length]}\`).join('；')
      : '';
    return normalizeTransitionRow({
      id: \`TR-SAMPLE-\${String(i + 1).padStart(3, '0')}\`,
      serial: String(i + 1),
      code: \`YY-\${c.level === '国家级' ? 'GJ' : c.level === '地方级' ? 'DF' : 'GS'}-\${String(1001 + i)}\`,
      level: c.level,
      sourceChannel: c.sourceChannel,
      projectType: c.projectType,
      major1,
      major2,
      name: c.name,
      center: unit.center,
      demandUnit: c.level === '公司级' ? '公司总部科技管理部' : unit.name,
      responsibleUnit: unit.name,
      managerUnit: unit.short,
      projectStatus: c.status,
      acceptanceStatus: c.accept,
      owner: owners[i % owners.length],
      approvalMonth: startMonth,
      startMonth,
      endMonth,
      duration: \`\${(endY - startY) * 12 + ((i % 5) + 2)}月\`,
      totalBudget: total,
      centralGrant: split.centralGrant,
      internalGrant: Math.round(split.centralGrant * (0.28 + (i % 4) * 0.05) * 10) / 10,
      selfFund: split.selfFund,
      internalSelfFund: Math.round(split.selfFund * (0.45 + (i % 3) * 0.08) * 10) / 10,
      spent,
      budget2026,
      budget2026Actual,
      budget2026Rate: budget2026 ? \`\${Math.min(120, Math.round((budget2026Actual / budget2026) * 100))}%\` : '',
      closedActualBudget: done ? spent : '',
      closedGrantSpent: done ? Math.round(spent * 0.58 * 10) / 10 : '',
      closedSelfSpent: done ? Math.round(spent * 0.42 * 10) / 10 : '',
      closedExecutionRate: done ? \`\${Math.min(100, Math.round((spent / total) * 100))}%\` : '',
      resultCount: c.result,
      resultNames,
      convertedCount: c.converted,
      convertedNames,
      convertedMonth: c.converted > 0 ? \`\${endY - 1}.\${(i % 9) + 1}\` : '',
      convertedModel: c.converted > 0 ? models[i % models.length] : '',
      reserveCount: c.reserve,
      reserveNames,
      reserveYear: c.reserve > 0 ? String(endY + 1) : '',
      remarks: [
        \`样本案例 · \${c.level}/\${c.sourceChannel}/\${c.projectType}\`,
        c.color === 'red' ? '风险：节点滞后，需督办' : '',
        c.converted > 0 ? \`转化型号：\${models[i % models.length]}\` : '',
        \`责任中心：\${unit.center}\`,
      ].filter(Boolean).join('；'),
      color: c.color,
      updatedBy: updaters[i % updaters.length],
      updatedAt: TODAY(),
      sourceFile: '样本案例-丰富演示包.xlsx',
      sourceExcelSheet: '预先研究项目信息',
      sourceRow: 6 + i,
    });
  });
}

function seedDemoChangeLogs(rows) {
  db.prepare('DELETE FROM transition_change_logs').run();
  const actors = ['王建国', '何雨桐', '顾言蹊', '蒋一帆', '沈望舒', '秦月朗', '郑晓岚', '马浩博', '宋知行'];
  const sample = rows.slice(0, Math.min(40, rows.length));
  for (let i = 0; i < sample.length; i += 1) {
    const row = sample[i];
    insertTransitionChangeLog({
      row,
      action: 'add',
      userName: actors[i % actors.length],
      sourceFile: row.sourceFile || '样本案例-丰富演示包.xlsx',
    });
    if (i % 3 === 0) {
      const before = { ...row, totalBudget: Math.round((Number(row.totalBudget) || 100) * 0.85 * 10) / 10, projectStatus: '立项中' };
      insertTransitionChangeLog({
        row,
        action: 'manual',
        userName: actors[(i + 2) % actors.length],
        before,
        sourceFile: row.sourceFile || '样本案例-丰富演示包.xlsx',
      });
    }
    if (i % 5 === 0 && Number(row.convertedCount) > 0) {
      const before = { ...row, convertedCount: 0, convertedNames: '' };
      insertTransitionChangeLog({
        row,
        action: 'manual',
        userName: actors[(i + 1) % actors.length],
        before,
        sourceFile: row.sourceFile || '样本案例-丰富演示包.xlsx',
      });
    }
  }
}

`;

s = s.slice(0, start) + replacement + s.slice(end);

// update import-demo handler to seed change logs
s = s.replace(
  `  const rows = defaultTransitionRows();
  setTransitionRows(rows);
  ensureFormTypeOwners();
  audit(user.name, '表单维护', '批量导入', \`按样例表字段口径导入演示数据 \${rows.length} 行\`);
  res.json({ ok: true, imported: rows.length });`,
  `  const rows = defaultTransitionRows();
  setTransitionRows(rows);
  ensureFormTypeOwners();
  seedDemoChangeLogs(rows);
  audit(user.name, '表单维护', '批量导入', \`按丰富样本包导入演示数据 \${rows.length} 行（含变更留痕）\`);
  res.json({ ok: true, imported: rows.length, changeLogs: recentTransitionChangeLogs(20).length });`,
);

fs.writeFileSync(p, s);
console.log('OK: replaced defaultTransitionRows + import-demo');
