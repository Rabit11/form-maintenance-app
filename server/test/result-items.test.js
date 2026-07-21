import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeResultFields,
  pairResultItems,
  serializeResultItems,
  splitResultLines,
} from '../src/resultItems.js';

test('按换行拆分成果名称', () => {
  assert.deepEqual(splitResultLines('成果A\n成果B\n成果C'), ['成果A', '成果B', '成果C']);
});

test('按分号拆分单行成果', () => {
  assert.deepEqual(splitResultLines('成果A；成果B；成果C'), ['成果A', '成果B', '成果C']);
});

test('去掉行尾中英文逗号后再配对', () => {
  const items = pairResultItems({
    resultNames: '成果1，\n成果2，\n成果3',
    convertedNames: '转化1，\n转化2，\n转化3',
    convertedMonth: '2021.6,\n2021.7,\n2022.1,',
    convertedModel: 'C919,\nC919,\nARJ21,',
  });
  assert.equal(items.length, 3);
  assert.equal(items[0].resultName, '成果1');
  assert.equal(items[0].convertedMonth, '2021.6');
  assert.equal(items[0].convertedModel, 'C919');
  assert.equal(items[2].convertedModel, 'ARJ21');
});

test('无换行时按中文逗号拆分（样例挤在一格）', () => {
  const text = '钛合金粉末重复利用技术，民用飞机金属增材制造结构设计优化方法（试行稿），金属选区熔融毛坯件设计要求';
  assert.deepEqual(splitResultLines(text), [
    '钛合金粉末重复利用技术',
    '民用飞机金属增材制造结构设计优化方法（试行稿）',
    '金属选区熔融毛坯件设计要求',
  ]);
});

test('英文逗号仅拆年月/型号短标记', () => {
  assert.deepEqual(splitResultLines('2021.6,2021.7,2021.7'), ['2021.6', '2021.7', '2021.7']);
  assert.deepEqual(splitResultLines('C313,C909,C616'), ['C313', 'C909', 'C616']);
  assert.deepEqual(
    splitResultLines('Simulation and Analysis of Civil Aircraft Cabin Wireless Network Based on Winprop'),
    ['Simulation and Analysis of Civil Aircraft Cabin Wireless Network Based on Winprop'],
  );
});

test('写回后仍为换行单元格，不增加项目行', () => {
  const packed = serializeResultItems([
    { resultName: 'A', convertedName: 'a', convertedMonth: '2021.6', convertedModel: 'C919' },
    { resultName: 'B', convertedName: 'b', convertedMonth: '2021.6', convertedModel: 'C919' },
  ]);
  assert.equal(packed.resultNames, 'A\nB');
  assert.equal(packed.convertedModel, 'C919\nC919');
  assert.equal(packed.resultCount, 2);
  assert.equal(packed.convertedCount, 2);
});

test('normalizeResultFields 自动分行写回且条数正确', () => {
  const packed = normalizeResultFields({
    resultNames: '成果甲，\n成果乙，',
    convertedNames: '转化甲，\n转化乙，',
    convertedMonth: '2021.6,\n2021.7,',
    convertedModel: 'C313,\nC313,',
    totalBudget: 200,
  });
  assert.equal(packed.resultNames, '成果甲\n成果乙');
  assert.equal(packed.convertedMonth, '2021.6\n2021.7');
  assert.equal(packed.resultCount, 2);
  assert.equal(packed.convertedCount, 2);
  assert.equal(packed.totalBudget, undefined);
});
