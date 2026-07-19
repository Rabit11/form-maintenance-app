import test from 'node:test';
import assert from 'node:assert/strict';
import { pairResultItems, serializeResultItems, splitResultLines } from '../src/resultItems.js';

test('按换行拆分成果名称', () => {
  assert.deepEqual(splitResultLines('成果A\n成果B\n成果C'), ['成果A', '成果B', '成果C']);
});

test('按分号拆分单行成果', () => {
  assert.deepEqual(splitResultLines('成果A；成果B；成果C'), ['成果A', '成果B', '成果C']);
});

test('成果字段按行一一配对', () => {
  const items = pairResultItems({
    resultNames: '成果1\n成果2\n成果3',
    convertedNames: '转化1\n转化2',
    convertedMonth: '2021.6\n2021.6\n2022.1',
    convertedModel: 'C919\nC919\nARJ21',
  });
  assert.equal(items.length, 3);
  assert.equal(items[0].resultName, '成果1');
  assert.equal(items[0].convertedName, '转化1');
  assert.equal(items[0].convertedMonth, '2021.6');
  assert.equal(items[0].convertedModel, 'C919');
  assert.equal(items[2].convertedName, '');
  assert.equal(items[2].convertedModel, 'ARJ21');
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
