import test from 'node:test';
import assert from 'node:assert/strict';

const LEDGER = [
  { group: '项目基本信息', subGroup: null, code: 'duration', label: '项目周期', headerBanner: false },
  { group: '经费情况', subGroup: null, code: 'totalBudget', label: '总经费（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '国拨经费', code: 'centralGrant', label: '国拨经费（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '国拨经费', code: 'internalGrant', label: '其中商飞内部单位国拨经费（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '自筹经费', code: 'selfFund', label: '自筹经费（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '自筹经费', code: 'internalSelfFund', label: '其中商飞内部单位自筹经费（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '预算情况', code: 'spent', label: '累计支出（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '预算情况', code: 'budget2026', label: '2026年预算（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedActualBudget', label: '已结题项目实际执行经费（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedGrantSpent', label: '已结题项目国拨经费执行（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedSelfSpent', label: '已结题项目国自筹经费执行（万元）', headerBanner: false },
  { group: '经费情况', subGroup: '已结题项目执行情况', code: 'closedExecutionRate', label: '已结题项目经费执行率', headerBanner: false },
].map((f, index) => ({ ...f, index }));

function buildTransitionHeaderMatrix(fields) {
  const top = Array(fields.length).fill('');
  const mid = Array(fields.length).fill('');
  const leaf = Array(fields.length).fill('');
  const merges = [];
  let i = 0;
  while (i < fields.length) {
    const field = fields[i];
    if (field.headerBanner) {
      top[i] = field.label;
      merges.push({ s: { r: 1, c: i }, e: { r: 3, c: i } });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < fields.length && fields[j].group === field.group && !fields[j].headerBanner) j += 1;
    top[i] = field.group;
    if (j - i > 1) merges.push({ s: { r: 1, c: i }, e: { r: 1, c: j - 1 } });
    i = j;
  }
  i = 0;
  while (i < fields.length) {
    const field = fields[i];
    if (field.headerBanner) {
      i += 1;
      continue;
    }
    if (!field.subGroup) {
      mid[i] = field.label;
      merges.push({ s: { r: 2, c: i }, e: { r: 3, c: i } });
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < fields.length && fields[j].subGroup === field.subGroup && !fields[j].headerBanner) j += 1;
    mid[i] = field.subGroup;
    if (j - i > 1) merges.push({ s: { r: 2, c: i }, e: { r: 2, c: j - 1 } });
    for (let k = i; k < j; k += 1) leaf[k] = fields[k].label;
    i = j;
  }
  return { top, mid, leaf, merges };
}

test('总经费属于经费情况：顶层并入该组，中层竖向合并', () => {
  const { top, mid, leaf, merges } = buildTransitionHeaderMatrix(LEDGER);
  assert.equal(top[0], '项目基本信息');
  assert.equal(top[1], '经费情况');
  assert.equal(mid[1], '总经费（万元）');
  assert.equal(mid[2], '国拨经费');
  assert.equal(leaf[2], '国拨经费（万元）');
  assert.equal(LEDGER.filter((f) => f.group === '经费情况').length, 11);
  assert.equal(LEDGER.find((f) => f.code === 'totalBudget').group, '经费情况');
  // 经费情况顶层合并 11 列：index 1..11
  assert.ok(merges.some((m) => m.s.r === 1 && m.s.c === 1 && m.e.c === 11));
  // 总经费中+叶竖向合并，不是顶层三行 banner
  assert.ok(merges.some((m) => m.s.r === 2 && m.e.r === 3 && m.s.c === 1));
  assert.equal(merges.some((m) => m.s.r === 1 && m.e.r === 3 && m.s.c === 1), false);
});
