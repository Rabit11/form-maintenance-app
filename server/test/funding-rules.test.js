import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFundingRelation } from '../src/fundingRules.js';

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
