import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  buildStyledTransitionWorkbookBuffer,
  estimateExportRowHeight,
  exportTransitionFieldValue,
} from '../src/transitionExport.js';

const fields = [
  { code: 'name', label: '项目名称', width: 20, number: false, group: '项目基本信息', subGroup: null },
  { code: 'totalBudget', label: '总经费（万元）', width: 14, number: true, group: '经费情况', subGroup: null },
  { code: 'resultNames', label: '产生成果名称', width: 28, number: false, group: '成果转化情况', subGroup: null },
  { code: 'convertedNames', label: '转化成果名称', width: 28, number: false, group: '成果转化情况', subGroup: '已转化成果' },
  { code: 'convertedMonth', label: '转化年月', width: 14, number: false, group: '成果转化情况', subGroup: '已转化成果' },
  { code: 'convertedModel', label: '转化型号', width: 14, number: false, group: '成果转化情况', subGroup: '已转化成果' },
].map((f, index) => ({ ...f, index, ledger: true }));

function buildHeaderMatrix(list) {
  const top = list.map((f) => f.group);
  const mid = list.map((f) => f.subGroup || f.label);
  const leaf = list.map((f) => (f.subGroup ? f.label : ''));
  return { top, mid, leaf, merges: [] };
}

test('导出成果字段用分号+换行配对，不拆项目行', () => {
  const row = {
    name: '噪声项目',
    totalBudget: 150,
    resultNames: '成果A，成果B，成果C',
    convertedNames: '转化A，转化B',
    convertedMonth: '2021.6，2021.7',
    convertedModel: 'C313，C919',
  };
  const names = exportTransitionFieldValue(row, fields[2], (x) => x);
  const months = exportTransitionFieldValue(row, fields[4], (x) => x);
  assert.equal(names, '成果A；\n成果B；\n成果C');
  assert.equal(months, '2021.6；\n2021.7');
  assert.ok(!names.includes('，'));
});

test('行高随成果行数增加且单行有舒适底高', () => {
  const short = estimateExportRowHeight(['a', 1, 'x'], fields);
  const tall = estimateExportRowHeight(['a', 1, 'a；\nb；\nc；\nd；\ne'], fields);
  assert.equal(short, 26);
  assert.ok(tall >= short + 15 * 4);
  assert.ok(tall > short);
});

test('样式导出：表头居中、分号换行、经费仍一行', async () => {
  const rows = [{
    name: '噪声项目',
    totalBudget: 150,
    resultNames: 'A\nB\nC',
    convertedNames: 'X\nY\nZ',
    convertedMonth: '2021.6\n2021.7\n2021.7',
    convertedModel: 'C313\nC313\nC919',
  }];
  const buf = await buildStyledTransitionWorkbookBuffer(
    rows,
    '预先研究项目信息',
    fields,
    (x) => x,
    buildHeaderMatrix,
  );
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  assert.equal(sheet.rowCount, 5); // title+3 header + 1 data
  const header = sheet.getRow(2).getCell(1);
  assert.equal(header.alignment?.horizontal, 'center');
  assert.equal(header.alignment?.vertical, 'middle');
  assert.ok(sheet.getRow(1).height >= 32);
  assert.ok(sheet.getRow(4).height >= 30);
  const data = sheet.getRow(5);
  assert.ok(data.height >= 26 + 15 * 2);
  assert.equal(data.getCell(2).value, 150);
  assert.equal(String(data.getCell(3).value), 'A；\nB；\nC');
  assert.equal(data.getCell(3).alignment?.wrapText, true);
});
