import test from 'node:test';
import assert from 'node:assert/strict';
import { statusColor, worstColor, evalGrade, daysBetween, addDays } from '../src/domain.js';

const TODAY = '2026-07-07';

test('绿色：已完成节点（即使已超期）', () => {
  assert.equal(statusColor('2026-01-01', '2026-01-05', TODAY), 'green');
  assert.equal(statusColor('2026-12-01', '2026-06-30', TODAY), 'green');
});

test('红色：未完成且已超期', () => {
  assert.equal(statusColor('2026-07-06', null, TODAY), 'red');
  assert.equal(statusColor('2025-12-31', null, TODAY), 'red');
});

test('黄色：未完成且剩余 ≤30 天（含当日到期）', () => {
  assert.equal(statusColor('2026-07-07', null, TODAY), 'yellow');
  assert.equal(statusColor('2026-08-06', null, TODAY), 'yellow'); // 恰 30 天
});

test('蓝色：未完成且剩余 >30 天', () => {
  assert.equal(statusColor('2026-08-07', null, TODAY), 'blue'); // 31 天
  assert.equal(statusColor('2027-01-01', null, TODAY), 'blue');
});

test('最差色优先级 红>黄>蓝>绿；空集为绿', () => {
  assert.equal(worstColor(['green', 'blue', 'yellow', 'red']), 'red');
  assert.equal(worstColor(['green', 'yellow', 'blue']), 'yellow');
  assert.equal(worstColor(['green', 'blue']), 'blue');
  assert.equal(worstColor(['green', 'green']), 'green');
  assert.equal(worstColor([]), 'green');
});

test('协作单位评价四档', () => {
  assert.equal(evalGrade(95), '优秀');
  assert.equal(evalGrade(90), '优秀');
  assert.equal(evalGrade(84), '良好');
  assert.equal(evalGrade(66), '合格');
  assert.equal(evalGrade(59), '不合格');
});

test('日期工具', () => {
  assert.equal(daysBetween('2026-07-07', '2026-08-06'), 30);
  assert.equal(addDays('2026-07-07', 30), '2026-08-06');
  assert.equal(addDays('2026-07-07', -7), '2026-06-30');
});
