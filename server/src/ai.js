// AI 文档识读：供应商可配置（anthropic / openai 兼容 / mock 模拟）
// 配置优先级：环境变量 > server/ai.config.json > 默认 mock
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'ai.config.json');

export function aiConfig() {
  let file = {};
  if (existsSync(CONFIG_PATH)) {
    try { file = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')); } catch { /* 配置损坏时忽略 */ }
  }
  let apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || file.apiKey || '';
  if (/粘贴|你的|xxxx|api03-xx/i.test(apiKey)) apiKey = '';   // 占位符视为未配置
  let provider = process.env.AI_PROVIDER || file.provider || '';
  if (!provider) {
    if (process.env.ANTHROPIC_API_KEY) provider = 'anthropic';
    else if (apiKey) provider = file.baseUrl || process.env.AI_BASE_URL ? 'openai' : 'anthropic';
    else provider = 'mock';
  }
  if (!apiKey && provider !== 'mock') provider = 'mock';
  const baseUrl = process.env.AI_BASE_URL || file.baseUrl
    || (provider === 'anthropic' ? 'https://api.anthropic.com' : '');
  const model = process.env.AI_MODEL || file.model
    || (provider === 'anthropic' ? 'claude-sonnet-5' : file.model || '');
  return { provider, apiKey, baseUrl, model };
}

export function aiStatus() {
  const c = aiConfig();
  return {
    configured: c.provider !== 'mock',
    provider: c.provider,
    model: c.provider === 'mock' ? '本地规则模拟' : c.model,
  };
}

const DELIVERABLE_TYPES = ['专利', '论文', '软著', '技术标准', '原理样机', '设备', '成套技术成果'];

const EXTRACT_TOOL = {
  name: 'extract_project_info',
  description: '从科研项目申报材料（建议书/申请书/任务书）中抽取结构化立项信息',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '项目名称全称（不含"建议书/申请书"等文种后缀）' },
      goal: { type: 'string', description: '项目总体目标，浓缩为一段话（≤120字）' },
      yearGoal: { type: 'string', description: '当年年度目标（如有）' },
      budget: { type: 'number', description: '申请总经费，单位：万元（文中若为亿元请换算）' },
      start: { type: 'string', description: '项目开始日期 YYYY-MM-DD（只有年月则取当月首日）' },
      end: { type: 'string', description: '项目结束日期 YYYY-MM-DD' },
      channelGuess: { type: 'string', description: '最可能的立项渠道，必须从提供的渠道列表中原样选择' },
      owner: { type: 'string', description: '项目负责人姓名（必须是人名，不是单位名；文中未写则留空）' },
      tech: { type: 'string', description: '技术负责人姓名（必须是人名；文中未写则留空）' },
      partners: {
        type: 'array', description: '参研/协作单位',
        items: { type: 'object', properties: { name: { type: 'string' }, work: { type: 'string', description: '分工内容' } }, required: ['name'] },
      },
      milestones: {
        type: 'array', description: '里程碑/研究计划节点，按时间顺序',
        items: { type: 'object', properties: { title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['title'] },
      },
      deliverables: {
        type: 'array', description: '预期成果/交付物',
        items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string', enum: DELIVERABLE_TYPES } }, required: ['name'] },
      },
      summary: { type: 'string', description: '一句话文档摘要，用于归档索引' },
    },
    required: ['name'],
  },
};

function systemPrompt(channels) {
  return `你是科研项目管理平台的申报材料结构化助手。用户上传一份科研项目申报文档（建议书/申请书/任务清单等），你负责精确抽取立项关键信息，用于自动预填申报表单（用户会人工核对修改）。
规则：
1. 只抽取文档中明确存在的信息，缺失字段留空，严禁编造。
2. 金额统一换算为万元；日期统一为 YYYY-MM-DD。
3. channelGuess 必须从以下渠道列表中原样选择一个（依据文档中的申报对象/专项名称判断，判断不了则留空）：
${channels.map((c) => `   - ${c}`).join('\n')}
4. 里程碑保留原文动词短语（如"完成XX试验"），不超过 8 条；交付物类型只能取：${DELIVERABLE_TYPES.join('、')}。`;
}

async function callAnthropic(cfg, { text, pdfBase64, channels }) {
  const userContent = [];
  if (pdfBase64) {
    userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } });
    userContent.push({ type: 'text', text: '请从上述申报文档中抽取结构化立项信息。' });
  } else {
    userContent.push({ type: 'text', text: `以下是申报文档全文，请抽取结构化立项信息：\n\n${text.slice(0, 60000)}` });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 3000,
        system: systemPrompt(channels),
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'extract_project_info' },
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const block = (data.content || []).find((b) => b.type === 'tool_use');
    if (!block) throw new Error('模型未返回结构化结果');
    return { fields: block.input, usage: data.usage };
  } finally { clearTimeout(timer); }
}

async function callOpenAI(cfg, { text, channels }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  const payload = {
    model: cfg.model,
    temperature: 0.1,
    max_tokens: 3000,
    // 智谱 GLM：结构化抽取无需深度思考，关闭以保证秒级响应
    ...(cfg.baseUrl.includes('bigmodel.cn') ? { thinking: { type: 'disabled' } } : {}),
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt(channels) + `\n\n请直接输出一个 JSON 对象，可用字段：${Object.keys(EXTRACT_TOOL.input_schema.properties).join(', ')}（缺失字段可省略），其中 partners=[{name,work}]、milestones=[{title,due}]、deliverables=[{name,type}]。不要输出任何其他文字。` },
      { role: 'user', content: `申报文档全文：\n\n${text.slice(0, 60000)}` },
    ],
  };
  const post = (body) => fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    signal: ctrl.signal,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  try {
    let res = await post(payload);
    // 个别网关不支持 response_format，去掉后重试一次
    if (!res.ok && res.status < 500) {
      const errBody = await res.text();
      if (/response_format/i.test(errBody)) {
        const { response_format, ...rest } = payload;
        res = await post(rest);
      } else {
        throw new Error(`AI 网关 ${res.status}: ${errBody.slice(0, 300)}`);
      }
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI 网关 ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message || {};
    // GLM 等思考型模型可能把推理放在 reasoning_content，正文才是答案；正文为空时兜底
    let raw = msg.content || msg.reasoning_content || '';
    raw = raw.replace(/```(json)?/g, '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('模型未返回 JSON 结果');
    return { fields: JSON.parse(m[0]), usage: data.usage };
  } finally { clearTimeout(timer); }
}

/** 本地规则模拟解析（未配置密钥时的降级路径，保证演示流程可走通） */
function mockExtract({ text, channels }) {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const title = (lines.find((l) => /(研究|研制|技术|系统|平台|验证)/.test(l) && l.length <= 45) || lines[0] || '未命名项目')
    .replace(/(项目)?(建议书|申请书|任务书|任务清单|可研报告)$/g, '').trim();
  const budgetM = text.match(/([\d,.]+)\s*万元/) || text.match(/([\d.]+)\s*亿元/);
  let budget;
  if (budgetM) budget = budgetM[0].includes('亿') ? Math.round(parseFloat(budgetM[1]) * 10000) : parseFloat(budgetM[1].replace(/,/g, ''));
  const dates = [...text.matchAll(/(20\d{2})\s*年\s*(\d{1,2})\s*月|(20\d{2})-(\d{1,2})(?:-(\d{1,2}))?/g)]
    .map((m) => {
      const y = m[1] || m[3]; const mo = String(m[2] || m[4] || '1').padStart(2, '0'); const d = String(m[5] || '01').padStart(2, '0');
      return `${y}-${mo}-${d}`;
    }).sort();
  const goalLine = lines.find((l) => /(目标|旨在|拟突破|面向)/.test(l) && l.length > 12);
  const milestones = lines.filter((l) => /^\d?[.、）)]?\s*完成/.test(l) && l.length < 50).slice(0, 8)
    .map((l, i) => {
      const body = l.replace(/^\d+[.、）)]\s*/, '');
      const dm = body.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月/);
      const due = dm ? `${dm[1]}-${String(dm[2]).padStart(2, '0')}-28`
        : dates[0] ? `${Number(dates[0].slice(0, 4)) + Math.floor(i / 2)}-${i % 2 ? '12' : '06'}-30` : undefined;
      return { title: body.replace(/[（(]\s*20\d{2}\s*年\s*\d{1,2}\s*月\s*[)）]\s*$/, '').trim(), due };
    });
  const channelGuess = channels.find((c) => text.includes(c)) || '';
  const partnerM = [...text.matchAll(/(参研单位|协作单位|合作单位)[：:]\s*([^\n。]+)/g)];
  const partners = partnerM.length
    ? partnerM[0][2].split(/[、，,;；]/).map((s) => s.trim()).filter(Boolean).slice(0, 5).map((n) => ({ name: n, work: '' }))
    : [];
  return {
    fields: {
      name: title, goal: goalLine || '', budget,
      start: dates[0], end: dates[dates.length - 1] !== dates[0] ? dates[dates.length - 1] : undefined,
      channelGuess, partners, milestones,
      deliverables: [
        [/专利/, '发明专利（若干项）', '专利'],
        [/论文/, '学术论文（若干篇）', '论文'],
        [/软著|软件著作权/, '软件著作权', '软著'],
        [/标准/, '技术标准（草案）', '技术标准'],
        [/样机/, '原理样机', '原理样机'],
      ].filter(([re]) => re.test(text)).map(([, n, t]) => ({ name: n, type: t })),
      summary: `${title}（本地规则模拟解析，配置 AI 密钥后可获得完整识别效果）`,
    },
    usage: null,
  };
}

/** 抽取结果归一化：日期补全为 YYYY-MM-DD、数值兜底，保证前端控件可直接使用 */
function normalizeFields(f) {
  const fixDate = (s) => {
    if (!s || typeof s !== 'string') return s;
    const t = s.trim().replace(/[./年]/g, '-').replace(/月/g, '').replace(/-+$/, '');
    if (/^\d{4}$/.test(t)) return `${t}-12-31`;
    if (/^\d{4}-\d{1,2}$/.test(t)) { const [y, m] = t.split('-'); return `${y}-${m.padStart(2, '0')}-28`; }
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) { const [y, m, d] = t.split('-'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
    return s;
  };
  const out = { ...f };
  out.start = fixDate(out.start);
  out.end = fixDate(out.end);
  if (typeof out.budget === 'string') out.budget = parseFloat(String(out.budget).replace(/[^\d.]/g, '')) || undefined;
  if (Array.isArray(out.milestones)) out.milestones = out.milestones.map((m) => ({ ...m, due: fixDate(m.due) }));
  return out;
}

export async function extractProjectInfo({ text, pdfBase64, channels }) {
  const cfg = aiConfig();
  let r;
  if (cfg.provider === 'anthropic') r = { ...(await callAnthropic(cfg, { text, pdfBase64, channels })), provider: 'anthropic', model: cfg.model };
  else if (cfg.provider === 'openai') r = { ...(await callOpenAI(cfg, { text, channels })), provider: 'openai', model: cfg.model };
  else r = { ...mockExtract({ text, channels }), provider: 'mock', model: '本地规则模拟' };
  return { ...r, fields: normalizeFields(r.fields) };
}
