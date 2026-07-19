/**
 * 成果转化多行字段：Excel 中为单单元格多行（或顿号/分号分隔），
 * 小程序/表单内拆成一一对应明细，不拆项目行，经费统计仍按项目汇总。
 */

export function splitResultLines(value) {
  const text = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!text) return [];

  const byNewline = text.split('\n').map((x) => x.trim()).filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  // 单行但用中文/英文分号、顿号分隔时也拆开
  const only = byNewline[0] || text;
  if (/[；;、]/.test(only)) {
    return only.split(/[；;、]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [only];
}

export function joinResultLines(lines) {
  return (lines || [])
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * @returns {{ resultName: string, convertedName: string, convertedMonth: string, convertedModel: string }[]}
 */
export function pairResultItems(row = {}) {
  const resultNames = splitResultLines(row.resultNames);
  const convertedNames = splitResultLines(row.convertedNames);
  const convertedMonths = splitResultLines(row.convertedMonth);
  const convertedModels = splitResultLines(row.convertedModel);
  const count = Math.max(
    resultNames.length,
    convertedNames.length,
    convertedMonths.length,
    convertedModels.length,
    Number(row.resultCount) > 0 && resultNames.length === 0 ? Number(row.resultCount) : 0,
  );
  if (count <= 0) return [];

  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push({
      resultName: resultNames[i] || '',
      convertedName: convertedNames[i] || '',
      convertedMonth: convertedMonths[i] || '',
      convertedModel: convertedModels[i] || '',
    });
  }
  return items;
}

/** 将明细写回四个单元格字符串（换行连接，便于再导入 Excel） */
export function serializeResultItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    resultNames: joinResultLines(list.map((x) => x.resultName)),
    convertedNames: joinResultLines(list.map((x) => x.convertedName)),
    convertedMonth: joinResultLines(list.map((x) => x.convertedMonth)),
    convertedModel: joinResultLines(list.map((x) => x.convertedModel)),
    resultCount: list.filter((x) => String(x.resultName || '').trim()).length || null,
    convertedCount: list.filter((x) => String(x.convertedName || '').trim()).length || null,
  };
}

export function resultItemsPreview(items, max = 2) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { text: '—', extra: 0 };
  const names = list.map((x) => x.resultName || x.convertedName).filter(Boolean);
  if (!names.length) return { text: `共 ${list.length} 条成果明细`, extra: 0 };
  const head = names.slice(0, max).join('；');
  const extra = Math.max(0, names.length - max);
  return { text: extra ? `${head} …+${extra}` : head, extra };
}
