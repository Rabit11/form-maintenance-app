const INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

export function safeFileSegment(value, fallback = '未分类', maxLength = 48) {
  const text = String(value ?? '')
    .normalize('NFC')
    .replace(INVALID_FILE_CHARS, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, maxLength);
  return text || fallback;
}

export function exportTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function parseYearMonth(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  // 样例并集：允许仅填年份（按该年 1 月计）
  const yearOnly = text.match(/^(\d{4})年?$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (year < 1900 || year > 2200) return null;
    return year * 12;
  }
  const match = text.match(/^(\d{4})[.\-/年](\d{1,2})(?:月)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  return year * 12 + month - 1;
}

export function buildTransitionExportBaseName(query = {}, rowTypes = [], rowCount = 0, options = {}) {
  const packageMode = Boolean(options.packageMode);
  const timestamp = exportTimestamp(options.now || new Date());
  const types = [...new Set(rowTypes.map((x) => String(x || '').trim()).filter(Boolean))];
  const explicitType = String(query.projectType || '').trim();
  const singleType = explicitType || (types.length === 1 ? types[0] : '');

  let kind;
  if (packageMode) kind = singleType ? '专项分表包' : '总表及分表包';
  else kind = singleType ? '专项分表' : Object.values(query).some((x) => String(x || '').trim()) ? '筛选总表' : '总表';

  let scope = singleType;
  if (!scope) {
    const scopeParts = [query.level, query.channel, query.office || query.orgOffice, query.unit, query.status, query.acceptanceStatus, query.color, query.transformStatus]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 3);
    if (query.startFrom || query.endTo) scopeParts.push(`${query.startFrom || '起'}至${query.endTo || '今'}`);
    if (query.kw) scopeParts.push('关键词筛选');
    scope = scopeParts.join('-') || '全量';
  }

  return [
    '预研项目',
    kind,
    safeFileSegment(scope, '全量', 72),
    timestamp,
    `${Math.max(0, Number(rowCount) || 0)}条`,
  ].join('_');
}

export function selectPrimaryImportSheet(parsedSheets, workbookSheetNames = []) {
  if (!parsedSheets.length) return [];
  const normalized = (value) => String(value || '').normalize('NFC').replace(/\s+/g, '').toLowerCase();
  const preferred = new Set(['预先研究项目信息', '预研项目信息', 'sheet1'].map(normalized));
  const namedMaster = parsedSheets.find((sheet) => preferred.has(normalized(sheet.sheetName)) && sheet.rows.length);
  if (namedMaster) return [namedMaster];
  if (parsedSheets.length === 1) return parsedSheets;

  // 常规 Excel 的首个数据表通常是权威总表；只有明确的多分表工作簿才合并。
  const firstWorkbookSheet = workbookSheetNames.find((name) => parsedSheets.some((sheet) => sheet.sheetName === name));
  const first = parsedSheets.find((sheet) => sheet.sheetName === firstWorkbookSheet);
  if (first && /总表|汇总|台账/.test(first.sheetName) && first.rows.length) return [first];
  return parsedSheets;
}

export function uniqueArchiveName(baseName, usedNames) {
  const keyOf = (value) => String(value).normalize('NFC').toLowerCase();
  let candidate = baseName;
  let index = 2;
  while (usedNames.has(keyOf(candidate))) {
    candidate = `${baseName}-${index}`;
    index += 1;
  }
  usedNames.add(keyOf(candidate));
  return candidate;
}
