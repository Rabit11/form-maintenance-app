import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTransitionExportBaseName,
  parseYearMonth,
  safeFileSegment,
  selectPrimaryImportSheet,
  uniqueArchiveName,
} from '../src/transitionFiles.js';

test('科学导出文件名包含范围、时间、行数且清理非法字符', () => {
  const name = buildTransitionExportBaseName(
    { level: '地方级', channel: '市科委', status: '进行中' },
    ['类型A', '类型B'],
    12,
    { now: new Date(2026, 6, 16, 15, 30, 25) },
  );
  assert.equal(name, '预研项目_筛选总表_地方级-市科委-进行中_20260716-153025_12条');
  assert.equal(safeFileSegment('非法:/\\*? 名称.'), '非法-名称');
});

test('单一项目类型导出命名为专项分表', () => {
  const name = buildTransitionExportBaseName(
    {},
    ['航空科学基金'],
    18,
    { now: new Date(2026, 6, 16, 8, 1, 2) },
  );
  assert.equal(name, '预研项目_专项分表_航空科学基金_20260716-080102_18条');
});

test('年月按数值比较所需键值解析，正确区分 9 月和 10 月', () => {
  assert.ok(parseYearMonth('2026.9') < parseYearMonth('2026.10'));
  assert.equal(parseYearMonth('2026-13'), null);
  assert.equal(parseYearMonth('not-a-month'), null);
});

test('平台导出回导时只选择权威总表', () => {
  const sheets = [
    { sheetName: '预先研究项目信息', rows: [{ id: 1 }, { id: 2 }] },
    { sheetName: '类型A', rows: [{ id: 1 }] },
    { sheetName: '类型B', rows: [{ id: 2 }] },
  ];
  assert.deepEqual(selectPrimaryImportSheet(sheets, sheets.map((x) => x.sheetName)), [sheets[0]]);
});

test('ZIP 文件名碰撞时稳定追加序号', () => {
  const used = new Set();
  assert.equal(uniqueArchiveName('001-同名', used), '001-同名');
  assert.equal(uniqueArchiveName('001-同名', used), '001-同名-2');
  assert.equal(uniqueArchiveName('001-同名', used), '001-同名-3');
});
