/**
 * 预先研究项目信息导出：成果格内分行 + 分号标记、表头居中、行高自适应。
 * 仍一行一项目，经费不因成果条数翻倍。
 */
import ExcelJS from 'exceljs';
import { pairResultItems, serializeResultItems, splitResultLines } from './resultItems.js';

const RESULT_PAIR_CODES = new Set(['resultNames', 'convertedNames', 'convertedMonth', 'convertedModel']);
const RESULT_LINE_CODES = new Set([...RESULT_PAIR_CODES, 'reserveNames', 'reserveYear']);

/** 导出分隔：格内换行对齐，条目间用中文分号标记（导入仍认换行/逗号/分号） */
export function joinResultExportLines(lines = []) {
  return (lines || [])
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join('；\n');
}

function toExportResultText(value) {
  return joinResultExportLines(splitResultLines(value));
}

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8F1F8' },
};
const TITLE_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD6E6F2' },
};
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FF94A3B8' } },
  left: { style: 'thin', color: { argb: 'FF94A3B8' } },
  bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
  right: { style: 'thin', color: { argb: 'FF94A3B8' } },
};

function cellText(value) {
  if (value == null) return '';
  return String(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export function exportTransitionFieldValue(row, field, normalizeRow) {
  const normalized = typeof normalizeRow === 'function' ? normalizeRow(row) : row;
  if (field.number) {
    const value = normalized[field.code];
    return value == null || value === '' ? null : Number(value);
  }
  if (RESULT_PAIR_CODES.has(field.code)) {
    const items = pairResultItems(normalized);
    if (items.length) {
      const packed = serializeResultItems(items);
      return toExportResultText(packed[field.code] || '');
    }
    return toExportResultText(normalized[field.code]);
  }
  if (RESULT_LINE_CODES.has(field.code)) {
    return toExportResultText(normalized[field.code]);
  }
  return cellText(normalized[field.code]);
}

function lineCount(value) {
  const text = String(value ?? '');
  if (!text) return 1;
  return Math.max(1, text.split(/\n/).length);
}

/** 按列宽估算自动换行行数（中文约按 1 字符 ≈ 1 列宽单位） */
function wrappedLineCount(value, colWidth = 14) {
  const width = Math.max(6, Number(colWidth) || 14);
  const chunks = String(value ?? '').split(/\n/);
  let lines = 0;
  for (const chunk of chunks) {
    const text = chunk.replace(/；\s*$/, '').trim();
    if (!text) {
      lines += 1;
      continue;
    }
    // Excel 列宽偏字符宽；中文略宽，按 0.9 折算更保守
    const chars = [...text].length;
    lines += Math.max(1, Math.ceil(chars / (width * 0.9)));
  }
  return Math.max(1, lines);
}

/**
 * 数据行行高：单行舒适底高 + 每条成果行间距；长文案按列宽折行计入。
 * Excel 行高单位为点（pt）。
 */
export function estimateExportRowHeight(values, fields) {
  const BASE = 26; // 单行底高（含上下留白）
  const PER_LINE = 15; // 每多一行的行距
  const CAP = 360;
  let lines = 1;
  fields.forEach((field, i) => {
    if (!RESULT_LINE_CODES.has(field.code)) return;
    const colWidth = Math.max(8, Math.min(40, (field.width || 14) * 0.95));
    lines = Math.max(lines, wrappedLineCount(values[i], colWidth));
  });
  if (lines <= 1) return BASE;
  return Math.min(CAP, BASE + (lines - 1) * PER_LINE);
}

function estimateHeaderRowHeight(labels, fields, { min = 24, perLine = 13 } = {}) {
  let lines = 1;
  labels.forEach((label, i) => {
    const width = Math.max(8, Math.min(40, (fields[i]?.width || 14) * 0.95));
    lines = Math.max(lines, wrappedLineCount(label, width));
  });
  return Math.min(72, Math.max(min, 10 + lines * perLine));
}

function applyHeaderStyle(cell, { title = false } = {}) {
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.font = {
    name: '微软雅黑',
    size: title ? 14 : 10,
    bold: true,
    color: { argb: 'FF0F172A' },
  };
  cell.fill = title ? TITLE_FILL : HEADER_FILL;
  cell.border = THIN_BORDER;
}

function applyDataStyle(cell, { wrap = false, number = false } = {}) {
  cell.alignment = {
    horizontal: number ? 'right' : 'left',
    vertical: wrap ? 'top' : 'middle',
    wrapText: wrap,
  };
  cell.font = { name: '微软雅黑', size: 10, color: { argb: 'FF0F172A' } };
  cell.border = THIN_BORDER;
}

/**
 * @param {object[]} rows
 * @param {string} title
 * @param {object[]} fields ledger fields（含 index/width/number/code/label/group/subGroup）
 * @param {(row: object) => object} normalizeRow
 * @param {(fields: object[]) => { top: string[], mid: string[], leaf: string[], merges: object[] }} buildHeaderMatrix
 */
export async function buildStyledTransitionWorkbookBuffer(rows, title, fields, normalizeRow, buildHeaderMatrix) {
  const { top, mid, leaf, merges } = buildHeaderMatrix(fields);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '表单维护 APP';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('预先研究项目信息', {
    views: [{ state: 'frozen', ySplit: 4 }],
    properties: { defaultRowHeight: 26 },
  });

  sheet.columns = fields.map((f) => ({
    key: f.code,
    width: Math.max(8, Math.min(40, (f.width || 14) * 0.95)),
  }));

  const titleRow = sheet.getRow(1);
  titleRow.height = 34;
  for (let c = 0; c < fields.length; c += 1) {
    const cell = titleRow.getCell(c + 1);
    cell.value = c === 0 ? title : '';
    applyHeaderStyle(cell, { title: true });
  }
  sheet.mergeCells(1, 1, 1, Math.max(1, fields.length));

  const writeHeaderRow = (rowNumber, labels, height) => {
    const row = sheet.getRow(rowNumber);
    row.height = height;
    labels.forEach((label, c) => {
      const cell = row.getCell(c + 1);
      cell.value = label || '';
      applyHeaderStyle(cell);
    });
  };
  writeHeaderRow(2, top, estimateHeaderRowHeight(top, fields, { min: 26 }));
  writeHeaderRow(3, mid, estimateHeaderRowHeight(mid, fields, { min: 26 }));
  writeHeaderRow(4, leaf, estimateHeaderRowHeight(leaf, fields, { min: 32, perLine: 14 }));

  for (const m of merges) {
    // matrix merges use 0-based r/c where r=1..3 maps to Excel rows 2..4
    const r1 = m.s.r + 1;
    const c1 = m.s.c + 1;
    const r2 = m.e.r + 1;
    const c2 = m.e.c + 1;
    if (r1 === r2 && c1 === c2) continue;
    try {
      sheet.mergeCells(r1, c1, r2, c2);
    } catch {
      // 忽略重叠合并
    }
  }

  rows.forEach((raw, i) => {
    const excelRow = i + 5;
    const values = fields.map((f) => exportTransitionFieldValue(raw, f, normalizeRow));
    const row = sheet.getRow(excelRow);
    row.height = estimateExportRowHeight(values, fields);
    values.forEach((value, c) => {
      const field = fields[c];
      const cell = row.getCell(c + 1);
      const wrap = RESULT_LINE_CODES.has(field.code);
      if (field.number) {
        cell.value = value == null || value === '' ? null : Number(value);
        applyDataStyle(cell, { number: true });
      } else {
        cell.value = value == null ? '' : String(value);
        applyDataStyle(cell, { wrap });
      }
    });
  });

  const lastDataRow = Math.max(5, rows.length + 4);
  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: lastDataRow, column: fields.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
