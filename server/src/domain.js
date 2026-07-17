// 全局四色状态规则（需求 V18 §二(四)）：优先级 红 > 黄 > 蓝 > 绿
// 绿=已完成；蓝=正常推进(距到期>30天)；黄=临期(≤30天)；红=已超期

export const COLOR_PRIORITY = { red: 0, yellow: 1, blue: 2, green: 3 };

export function todayISO(d = new Date()) {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export function daysBetween(fromISO, toISO) {
  const a = new Date(fromISO + 'T00:00:00Z').getTime();
  const b = new Date(toISO + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 单节点四色：due 截止日, doneAt 完成日(空=未完成), today 今日 */
export function statusColor(due, doneAt, today) {
  if (doneAt) return 'green';
  if (!due) return 'blue';
  const left = daysBetween(today, due);
  if (left < 0) return 'red';
  if (left <= 30) return 'yellow';
  return 'blue';
}

/** 多节点取最差色（红>黄>蓝>绿）；空集合视为绿 */
export function worstColor(colors) {
  if (!colors || colors.length === 0) return 'green';
  return colors.reduce((w, c) => (COLOR_PRIORITY[c] < COLOR_PRIORITY[w] ? c : w), 'green');
}

/** 协作单位评价等级：优秀≥90 / 良好80-89 / 合格60-79 / 不合格<60 */
export function evalGrade(score) {
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 60) return '合格';
  return '不合格';
}

/** 距到期剩余天数（负数=已超期） */
export function daysLeft(due, today) {
  return daysBetween(today, due);
}
