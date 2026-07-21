/**
 * 成果转化多行字段：Excel 中为单单元格多行（或逗号/分号分隔），
 * 表单内拆成一一对应明细，不拆项目行，经费统计仍按项目汇总。
 */

function cleanResultPart(value) {
  const text = String(value ?? '')
    .trim()
    .replace(/^[，,;；、]+/, '')
    .replace(/[，,;；、]+$/, '')
    .trim();
  if (!text || /^(?:\/|／|—|–|−|-|－|N\/A|n\/a|NA|na|无|空)$/.test(text)) return '';
  return text;
}

/** 英文逗号分隔的短标记（年月、型号等） */
function looksLikeTokenList(parts) {
  if (parts.length < 2) return false;
  return parts.every((part) => (
    /^\d{4}\.\d{1,2}$/.test(part)
    || /^\d{4}$/.test(part)
    || /^[A-Za-z][A-Za-z0-9_-]{0,24}$/.test(part)
  ));
}

export function splitResultLines(value) {
  const text = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!text) return [];

  const byNewline = text.split('\n').map(cleanResultPart).filter(Boolean);
  if (byNewline.length > 1) return byNewline;

  const only = byNewline[0] || cleanResultPart(text);
  if (!only) return [];

  // 中文逗号 / 分号 / 顿号列表（样例中无换行时常用「，」分隔）
  if (/[；;、，]/.test(only)) {
    const parts = only.split(/[；;、，]+/).map(cleanResultPart).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  // 英文逗号：仅当像年月/型号短标记列表时拆开，避免拆英文标题
  if (only.includes(',')) {
    const parts = only.split(/,\s*/).map(cleanResultPart).filter(Boolean);
    if (looksLikeTokenList(parts)) return parts;
  }

  return [only];
}

export function joinResultLines(lines) {
  return (lines || [])
    .map((x) => cleanResultPart(x))
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

/** 将明细写回四个单元格字符串（换行连接，便于再导入 Excel）；仍是一条项目记录 */
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

/** 导入/保存时规范化成果单元格：自动分行写回，不增加项目行 */
export function normalizeResultFields(row = {}) {
  const hasContent = ['resultNames', 'convertedNames', 'convertedMonth', 'convertedModel']
    .some((key) => String(row[key] ?? '').trim());
  if (!hasContent) return {};

  const items = pairResultItems(row);
  if (!items.length) return {};

  const packed = serializeResultItems(items);
  // 保留 Excel 中已填写的数量，避免「0」被明细回写覆盖成空后触发假校验
  const excelResultCount = Number.isFinite(Number(row.resultCount)) ? Number(row.resultCount) : null;
  const excelConvertedCount = Number.isFinite(Number(row.convertedCount)) ? Number(row.convertedCount) : null;
  if (excelResultCount != null) packed.resultCount = excelResultCount;
  if (excelConvertedCount != null) packed.convertedCount = excelConvertedCount;

  const next = { ...packed };

  // 储备成果同样按单元格分行写回，仍挂在同一项目行
  const reserveNames = splitResultLines(row.reserveNames);
  const reserveYears = splitResultLines(row.reserveYear);
  if (reserveNames.length > 1 || /[；;、，\n]/.test(String(row.reserveNames ?? ''))) {
    next.reserveNames = joinResultLines(reserveNames);
    if (reserveNames.length) next.reserveCount = reserveNames.length;
  }
  if (reserveYears.length > 1 || /[；;、，\n,]/.test(String(row.reserveYear ?? ''))) {
    next.reserveYear = joinResultLines(reserveYears);
  }

  return next;
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
