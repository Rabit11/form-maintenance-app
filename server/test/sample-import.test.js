import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { normalizeResultFields, pairResultItems } from '../src/resultItems.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE = join(__dirname, '..', 'templates', '预先研究项目信息（样例）.xlsx');

function isBlankPlaceholder(value) {
  const text = String(value ?? '').replace(/\s+/g, '').trim();
  return !text || /^(?:\/|／|—|–|−|-|－|N\/A|n\/a|NA|na|无|空)$/.test(text);
}

function cellText(value) {
  if (value == null) return '';
  if (isBlankPlaceholder(value)) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function cellNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (isBlankPlaceholder(value)) return null;
  const text = cellText(value).replace(/,/g, '').replace(/万元/g, '').replace(/%$/, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function normalizeHeaderLabel(value) {
  return cellText(value).replace(/\s+/g, '').replace(/[()]/g, (m) => (m === '(' ? '（' : '）'));
}

const FIELD_LABELS = [
  ['serial', '序号'], ['level', '级别'], ['sourceChannel', '项目来源/渠道'], ['projectType', '项目类型'],
  ['major1', '一级专业'], ['major2', '二级专业'], ['name', '项目名称'], ['center', '所中心'],
  ['demandUnit', '管理/需求单位'], ['responsibleUnit', '责任单位'], ['projectStatus', '项目状态'],
  ['acceptanceStatus', '验收状态'], ['owner', '中国商飞内部负责人'], ['approvalMonth', '项目立项年月'],
  ['startMonth', '项目开始年月'], ['endMonth', '项目结束年月'], ['duration', '项目周期'],
  ['totalBudget', '总经费（万元）'], ['centralGrant', '国拨经费（万元）'],
  ['internalGrant', '其中商飞内部单位国拨经费（万元）'], ['selfFund', '自筹经费（万元）'],
  ['internalSelfFund', '其中商飞内部单位自筹经费（万元）'], ['spent', '累计支出（万元）'],
  ['budget2026', '2026年预算（万元）'], ['closedActualBudget', '已结题项目实际执行经费（万元）'],
  ['closedGrantSpent', '已结题项目国拨经费执行（万元）'], ['closedSelfSpent', '已结题项目国自筹经费执行（万元）'],
  ['closedExecutionRate', '已结题项目经费执行率'], ['resultCount', '产生成果数量'],
  ['resultNames', '产生成果名称'], ['convertedCount', '已转化数量'], ['convertedNames', '转化成果名称'],
  ['convertedMonth', '转化年月'], ['convertedModel', '转化型号'], ['reserveCount', '技术储备数量'],
  ['reserveNames', '储备成果名称'], ['reserveYear', '预计转化年度'], ['remarks', '备注'],
];

test('可上传样例：表头并集可完整映射且经费恒等', () => {
  assert.ok(existsSync(SAMPLE), '样例模板应存在于 server/templates');
  const aoa = XLSX.utils.sheet_to_json(
    XLSX.read(readFileSync(SAMPLE), { type: 'buffer' }).Sheets.Sheet1,
    { header: 1, defval: '', raw: false, blankrows: false },
  );
  const headerIndex = aoa.findIndex(
    (line) => line.some((x) => cellText(x) === '项目类型') && line.some((x) => cellText(x) === '项目名称'),
  );
  assert.ok(headerIndex >= 0);
  const mid = aoa[headerIndex] || [];
  const leaf = aoa[headerIndex + 1] || [];
  const group = aoa[headerIndex - 1] || [];
  const colByLabel = new Map();
  const maxCols = Math.max(mid.length, leaf.length, group.length);
  for (let c = 0; c < maxCols; c += 1) {
    for (const label of [mid[c], leaf[c], group[c]].map(normalizeHeaderLabel).filter(Boolean)) {
      if (!colByLabel.has(label)) colByLabel.set(label, c);
    }
  }
  const map = new Map();
  for (const [code, label] of FIELD_LABELS) {
    const col = colByLabel.get(normalizeHeaderLabel(label));
    assert.notEqual(col, undefined, `缺少列：${label}`);
    map.set(code, col);
  }
  assert.equal(map.get('center'), 7);
  assert.equal(map.get('remarks'), 37);

  const dataStart = headerIndex + 2;
  let rows = 0;
  let withCenter = 0;
  for (let i = dataStart; i < aoa.length; i += 1) {
    const cells = aoa[i];
    const name = cellText(cells[map.get('name')]);
    if (!name) continue;
    rows += 1;
    if (cellText(cells[map.get('center')])) withCenter += 1;
    const total = cellNumber(cells[map.get('totalBudget')]) || 0;
    const grant = cellNumber(cells[map.get('centralGrant')]) || 0;
    const self = cellNumber(cells[map.get('selfFund')]) || 0;
    assert.ok(Math.abs(total - grant - self) <= 0.05, `${name} 经费不恒等`);
    // 「/」占位应读为空
    assert.equal(cellNumber('/'), null);
    assert.equal(cellText('/'), '');
    const pack = normalizeResultFields({
      resultNames: cells[map.get('resultNames')],
      convertedNames: cells[map.get('convertedNames')],
      convertedMonth: cells[map.get('convertedMonth')],
      convertedModel: cells[map.get('convertedModel')],
    });
    const items = pairResultItems({
      resultNames: pack.resultNames ?? cells[map.get('resultNames')],
      convertedNames: pack.convertedNames ?? cells[map.get('convertedNames')],
      convertedMonth: pack.convertedMonth ?? cells[map.get('convertedMonth')],
      convertedModel: pack.convertedModel ?? cells[map.get('convertedModel')],
    });
    assert.ok(Array.isArray(items));
  }
  assert.equal(rows, 24);
  assert.equal(withCenter, 24);
});
