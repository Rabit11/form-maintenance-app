import test from 'node:test';
import assert from 'node:assert/strict';
import { splitTotalBudget, validateFundingRelation } from '../src/fundingRules.js';

test('总经费等于国拨与自筹之和时通过', () => {
  assert.equal(validateFundingRelation({ totalBudget: 5000, centralGrant: 2604, selfFund: 2396 }).ok, true);
});

test('总经费与国拨、自筹合计不等时给出精确差额', () => {
  const result = validateFundingRelation({ totalBudget: 5000, centralGrant: 2604, selfFund: 924 });
  assert.equal(result.ok, false);
  assert.match(result.issues[0], /相差|多 1,472 万元/);
  assert.equal(result.sum, 3528);
});

test('内部经费子项不得超过对应国拨或自筹', () => {
  const result = validateFundingRelation({ totalBudget: 100, centralGrant: 60, selfFund: 40, internalGrant: 61, internalSelfFund: 41 });
  assert.equal(result.issues.length, 2);
});

test('演示经费拆分始终满足总经费=国拨+自筹', () => {
  for (const [total, level] of [[4200, '国家级'], [800, '地方级'], [200, '公司级'], [1188, '国家级']]) {
    const split = splitTotalBudget(total, level);
    const check = validateFundingRelation({
      totalBudget: total,
      centralGrant: split.centralGrant,
      selfFund: split.selfFund,
    });
    assert.equal(check.ok, true, `${level} ${total}: ${check.issues.join('; ')}`);
    assert.equal(Math.round((split.centralGrant + split.selfFund) * 10) / 10, total);
  }
});
