function amount(value) {
  if (value == null || value === '') return null;
  const number = Number(String(value).replace(/,/g, '').replace(/万元/g, '').trim());
  return Number.isFinite(number) ? number : null;
}

function displayAmount(value) {
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export function validateFundingRelation(values, tolerance = 0.01) {
  const total = amount(values.totalBudget);
  const grant = amount(values.centralGrant) ?? 0;
  const self = amount(values.selfFund) ?? 0;
  const internalGrant = amount(values.internalGrant);
  const internalSelf = amount(values.internalSelfFund);
  const issues = [];

  if (total != null) {
    const sum = grant + self;
    const difference = total - sum;
    if (Math.abs(difference) > tolerance) {
      const direction = difference > 0 ? '总经费比两项合计多' : '国拨与自筹合计比总经费多';
      issues.push(`总经费必须等于国拨经费与自筹经费之和：${displayAmount(grant)} + ${displayAmount(self)} = ${displayAmount(sum)} 万元；当前总经费 ${displayAmount(total)} 万元，${direction} ${displayAmount(Math.abs(difference))} 万元`);
    }
  }
  if (internalGrant != null && internalGrant > grant + tolerance) {
    issues.push(`其中商飞内部单位国拨经费 ${displayAmount(internalGrant)} 万元不能大于国拨经费 ${displayAmount(grant)} 万元`);
  }
  if (internalSelf != null && internalSelf > self + tolerance) {
    issues.push(`其中商飞内部单位自筹经费 ${displayAmount(internalSelf)} 万元不能大于自筹经费 ${displayAmount(self)} 万元`);
  }

  return { ok: issues.length === 0, total, grant, self, sum: grant + self, issues };
}
