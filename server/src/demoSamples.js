/**
 * 表单维护 APP · 丰富演示样本
 * 覆盖：三级层级 × 部委渠道 × 司局/处室 × 全部项目类型主管类型
 * 含状态/预警/经费/成果转化/单位/专业多样性，供「加载样本案例」一键灌入。
 */

const STATUS_POOL = [
  { status: '进行中', accept: '未验收', color: 'blue' },
  { status: '进行中', accept: '单位级验收', color: 'yellow' },
  { status: '延期', accept: '未验收', color: 'red' },
  { status: '延期', accept: '单位级验收', color: 'red' },
  { status: '已完成', accept: '公司级验收', color: 'green' },
  { status: '已完成', accept: '机关验收', color: 'green' },
  { status: '立项中', accept: '未验收', color: 'blue' },
  { status: '验收中', accept: '单位级验收', color: 'yellow' },
];

/** 按项目类型的业务主题词，用于自动扩写出更多样本名 */
const TYPE_TOPICS = {
  MJKY: ['氢电动力集成验证', '驾驶舱人机工效', '分布式航电架构', '飞控软件安全认证', '机翼气动弹性优化', '航电以太网时延分析'],
  '国家科技重大专项--04专项': ['飞控冗余架构', '高速数据总线国产化', '电传作动可靠性', '综合航电任务系统', '飞控传感器容错'],
  '1025': ['增材钛合金承力框', '智能蒙皮形变感知', '关键结构智能检测', '数字化装配定位', '钛合金激光焊接'],
  'FGW第一批GXJC项目': ['PHM健康管理平台', '试飞数据中心能力', '供应链数字化协同', '民机工业互联网节点', '全生命周期数据湖'],
  '下一代国家重点研发计划': ['复材损伤容限评估', '噪声适航预测', '绿色动力热管理', '结构健康在线监测', '低阻层流翼型验证'],
  '大飞机基础研究联合基金': ['结冰相似准则', '超临界非定常流动', '复材屈曲后行为', '湍流边界层控制', '多物理场耦合算法'],
  '新材料2030专项': ['高韧性环氧基体', '高温合金粉末冶金', '低介电透波复材', '耐刮擦表面涂层', '热塑性复材焊接'],
  '上海市科技攻关揭榜挂帅': ['客舱降噪声品质', '电动滑行可行性', '智慧机库巡检机器人', '机坪无人牵引车', '客舱空气消杀装置'],
  '上海市科委、经信委项目': ['全生命周期碳足迹', '风洞模型快速制造', '结构健康监测示范', '智能物流产线试点', '绿色制造能耗看板'],
  '预研三年': ['智能座舱交互', '自然层流减阻', '航电网络安全', '客舱无线娱乐EMC', '缝翼机构轻量化', '环控系统能效提升'],
  '重大科技创新': ['静力试验智能测控', '脉动总装仿真优化', '数字孪生虚实联动', '智能工艺知识库', '总装质量闭环系统'],
  '实验室': ['气动声学联实能力', '复材工艺联实共享', '电磁兼容试验能力', '低温环境模拟舱'],
  '科技委技术发展课题': ['氢能航空路线图', '智能化发展战略', 'SAF适航路径', '低空经济技术布局'],
  '科技周': ['智慧民机科普互动', '数字风洞云展示', '青少年STEAM课程包', '飞行模拟体验舱'],
  '新疆气象中心项目': ['高空气象探测无人平台', '航路气象大数据优化', '极端天气飞行决策', '高原机场气象保障'],
  '大飞机先进材料创新联盟': ['高温树脂联合研发', '拉挤长桁产业化', '粉体循环利用工艺', '复材快速固化体系'],
  '波音合作': ['SAF适配性验证', '噪声飞行试验方法', '客舱人体工程学评测', '可持续材料联合筛选'],
  KT: ['防冰加热膜攻关', '起落架缓冲仿真', '力感模拟装置', '舱门密封性能试验'],
  XP: ['边条翼涡控试验', '自适应缝翼驱动', '分布式电推进缩比', '变弯度后缘概念验证'],
  '高质量专项': ['供应商质量数据贯通', '关键特性过程能力', '零缺陷装配工艺包', '供应商准入评价模型'],
  '大飞机研究院-南航': ['无人适航标准预研', '飞行品质评估方法', '复杂气象飞行仿真'],
  '大飞机研究院-西工': ['复材损伤扩展仿真', '先进气动多学科优化', '结构拓扑减重设计'],
  '大飞机研究院-同济': ['客舱声学舒适模型', '地勤智能调度算法', '机场运行效能评估'],
  '大飞机研究院-上海交大': ['碳核算方法', '氢电混合动力仿真', '电池热安全管理'],
  '大飞机研究院-北航': ['气动声学源识别', '飞控故障重构', '高升力构型优化'],
  '大飞机研究院-重庆大学': ['高温合金增材窗口', '薄壁精密测量', '智能装配扭矩控制'],
  '大飞机研究院-香港理工': ['智能蒙皮传感网络', '客舱空气品质监测', '轻量化座椅结构'],
  '大飞机研究院-中国民航大学': ['运行安全风险评估', '通航气象服务保障', '航班恢复决策支持'],
};

const TYPE_META = {
  MJKY: { level: '国家级', sourceChannel: '工信部', orgOffice: '装备二司', ownerHint: '顾言蹊', budgetBase: 3800 },
  '国家科技重大专项--04专项': { level: '国家级', sourceChannel: '工信部', orgOffice: '装备一司', ownerHint: '顾言蹊', budgetBase: 4500 },
  '1025': { level: '国家级', sourceChannel: '工信部', orgOffice: '高新技术司', ownerHint: '顾言蹊', budgetBase: 3200 },
  'FGW第一批GXJC项目': { level: '国家级', sourceChannel: '发改委', orgOffice: '高技术司', ownerHint: '顾言蹊', budgetBase: 7000 },
  '下一代国家重点研发计划': { level: '国家级', sourceChannel: '科技部', orgOffice: '国自然', ownerHint: '蒋一帆', budgetBase: 4000 },
  '大飞机基础研究联合基金': { level: '国家级', sourceChannel: '科技部', orgOffice: '国自然', ownerHint: '蒋一帆', budgetBase: 1000 },
  '新材料2030专项': { level: '国家级', sourceChannel: '科技部', orgOffice: '国自然', ownerHint: '蒋一帆', budgetBase: 4800 },
  '上海市科技攻关揭榜挂帅': { level: '地方级', sourceChannel: '市科委', orgOffice: '空天海洋处', ownerHint: '沈望舒', budgetBase: 1400 },
  '上海市科委、经信委项目': { level: '地方级', sourceChannel: '市科委', orgOffice: '空天海洋处', ownerHint: '沈望舒', budgetBase: 1500 },
  '预研三年': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '秦月朗', budgetBase: 700 },
  '重大科技创新': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '秦月朗', budgetBase: 2000 },
  '实验室': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '秦月朗', budgetBase: 1100 },
  '科技委技术发展课题': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '秦月朗', budgetBase: 400 },
  '新疆气象中心项目': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '马浩博', budgetBase: 1100 },
  '波音合作': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '马浩博', budgetBase: 2000 },
  KT: { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '宋知行', budgetBase: 320 },
  XP: { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '宋知行', budgetBase: 500 },
  '高质量专项': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', ownerHint: '宋知行', budgetBase: 800 },
  '科技周': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '马浩博', budgetBase: 260 },
  '大飞机研究院-南航': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 560 },
  '大飞机研究院-西工': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 600 },
  '大飞机研究院-同济': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 480 },
  '大飞机研究院-上海交大': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 580 },
  '大飞机研究院-北航': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 720 },
  '大飞机研究院-重庆大学': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 520 },
  '大飞机研究院-香港理工': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 560 },
  '大飞机研究院-中国民航大学': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', ownerHint: '郑晓岚', budgetBase: 500 },
  '大飞机先进材料创新联盟': { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '技术基础处', ownerHint: '马浩博', budgetBase: 1500 },
};

function pickStatus(i) {
  return STATUS_POOL[i % STATUS_POOL.length];
}

function outcomeProfile(status, i) {
  if (status === '立项中') return { result: 0, converted: 0, reserve: 1 + (i % 2) };
  if (status === '已完成') return { result: 3 + (i % 3), converted: 2 + (i % 2), reserve: i % 2 };
  if (status === '延期') return { result: 1 + (i % 2), converted: 0, reserve: 1 };
  if (status === '验收中') return { result: 2 + (i % 2), converted: 1, reserve: 0 };
  return { result: 1 + (i % 3), converted: i % 3 === 0 ? 1 : 0, reserve: 1 + (i % 2) };
}

/** 手搓精品样本（保证业务可读性与多样性） */
function curatedCases() {
  return [
    { level: '国家级', sourceChannel: '工信部', orgOffice: '装备二司', projectType: 'MJKY', name: '氢电飞机验证机总体方案研究', status: '进行中', accept: '未验收', color: 'yellow', result: 2, converted: 0, reserve: 1, budget: 4200, unitHint: '北研中心' },
    { level: '国家级', sourceChannel: '工信部', orgOffice: '装备一司', projectType: '国家科技重大专项--04专项', name: '飞控系统冗余度架构优化技术', status: '已完成', accept: '机关验收', color: 'green', result: 4, converted: 3, reserve: 1, budget: 6800, unitHint: '上飞院' },
    { level: '国家级', sourceChannel: '工信部', orgOffice: '高新技术司', projectType: '1025', name: '增材制造钛合金主承力框应用研究', status: '进行中', accept: '未验收', color: 'blue', result: 1, converted: 0, reserve: 2, budget: 2980, unitHint: '上飞公司' },
    { level: '国家级', sourceChannel: '发改委', orgOffice: '高技术司', projectType: 'FGW第一批GXJC项目', name: '民机健康管理PHM大数据平台', status: '延期', accept: '单位级验收', color: 'red', result: 3, converted: 1, reserve: 1, budget: 8900, unitHint: '基础能力中心' },
    { level: '国家级', sourceChannel: '科技部', orgOffice: '国自然', projectType: '下一代国家重点研发计划', name: '复合材料机翼损伤容限评估技术', status: '进行中', accept: '单位级验收', color: 'yellow', result: 3, converted: 1, reserve: 1, budget: 4120, unitHint: '上飞院' },
    { level: '国家级', sourceChannel: '科技部', orgOffice: '国自然', projectType: '大飞机基础研究联合基金', name: '结冰风洞试验相似准则研究', status: '进行中', accept: '未验收', color: 'blue', result: 1, converted: 0, reserve: 1, budget: 980, unitHint: '试飞中心' },
    { level: '国家级', sourceChannel: '科技部', orgOffice: '国自然', projectType: '新材料2030专项', name: '高韧性环氧树脂基体体系研发', status: '进行中', accept: '未验收', color: 'yellow', result: 2, converted: 0, reserve: 2, budget: 4560, unitHint: '基础能力中心' },
    { level: '地方级', sourceChannel: '市科委', orgOffice: '空天海洋处', projectType: '上海市科技攻关揭榜挂帅', name: '客舱降噪与声品质设计技术', status: '进行中', accept: '单位级验收', color: 'yellow', result: 2, converted: 1, reserve: 1, budget: 1680, unitHint: '客服公司' },
    { level: '地方级', sourceChannel: '市科委', orgOffice: '空天海洋处', projectType: '上海市科委、经信委项目', name: '民机全生命周期碳足迹评估技术', status: '进行中', accept: '未验收', color: 'blue', result: 2, converted: 0, reserve: 1, budget: 1260, unitHint: '上飞院' },
    { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', projectType: '预研三年', name: '智能座舱人机交互技术研究', status: '进行中', accept: '未验收', color: 'yellow', result: 2, converted: 0, reserve: 1, budget: 680, unitHint: '上飞院' },
    { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', projectType: '重大科技创新', name: '民机数字孪生与虚实联动平台', status: '进行中', accept: '未验收', color: 'blue', result: 1, converted: 0, reserve: 2, budget: 2680, unitHint: '上飞公司' },
    { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科技发展处', projectType: '科技周', name: '智慧民机科普互动系统', status: '已完成', accept: '公司级验收', color: 'green', result: 3, converted: 3, reserve: 0, budget: 280, unitHint: '客服公司' },
    { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '技术基础处', projectType: '大飞机先进材料创新联盟', name: '高温树脂体系联合研发', status: '进行中', accept: '单位级验收', color: 'yellow', result: 3, converted: 1, reserve: 1, budget: 1760, unitHint: '基础能力中心' },
    { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', projectType: '波音合作', name: '可持续航空燃料适配性验证', status: '进行中', accept: '未验收', color: 'yellow', result: 2, converted: 0, reserve: 1, budget: 2340, unitHint: '试飞中心' },
    { level: '公司级', sourceChannel: 'ZGSF', orgOffice: '科研项目处', projectType: '高质量专项', name: '高质量-零缺陷装配工艺包建设', status: '延期', accept: '未验收', color: 'red', result: 1, converted: 0, reserve: 1, budget: 920, unitHint: '上飞公司' },
  ];
}

/** 按类型主题词批量扩写，覆盖全部主管类型 */
function generatedCases() {
  const out = [];
  let i = 0;
  for (const [projectType, topics] of Object.entries(TYPE_TOPICS)) {
    const meta = TYPE_META[projectType];
    if (!meta) continue;
    topics.forEach((topic, ti) => {
      const st = pickStatus(i + ti);
      const outcome = outcomeProfile(st.status, i + ti);
      const budget = Math.round((meta.budgetBase * (0.78 + ((i + ti) % 7) * 0.06)) * 10) / 10;
      out.push({
        level: meta.level,
        sourceChannel: meta.sourceChannel,
        orgOffice: meta.orgOffice,
        projectType,
        name: `${topic}（${projectType.length > 10 ? projectType.slice(0, 8) : projectType}）`,
        status: st.status,
        accept: st.accept,
        color: st.color,
        ...outcome,
        budget,
        ownerHint: meta.ownerHint,
      });
      i += 1;
    });
  }
  return out;
}

export function buildRichDemoCases() {
  const curated = curatedCases();
  const generated = generatedCases();
  // 去重：同名优先保留精品
  const seen = new Set();
  const merged = [];
  for (const c of [...curated, ...generated]) {
    const key = `${c.projectType}|${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  return merged;
}

export const DEMO_UNITS = [
  { short: '上飞院', name: '上海飞机设计研究院', center: '总体气动所' },
  { short: '上飞公司', name: '上海飞机制造有限公司', center: '总装制造中心' },
  { short: '北研中心', name: '北京民用飞机技术研究中心', center: '预先研究中心' },
  { short: '客服公司', name: '上海飞机客户服务有限公司', center: '运行支持所' },
  { short: '试飞中心', name: '民用飞机试飞中心', center: '试飞工程部' },
  { short: '基础能力中心', name: '复合材料与基础能力中心', center: '复合材料所' },
  { short: '上飞院', name: '上海飞机设计研究院', center: '强度所' },
  { short: '上飞公司', name: '上海飞机制造有限公司', center: '复材制造中心' },
  { short: '北研中心', name: '北京民用飞机技术研究中心', center: '航电系统所' },
  { short: '试飞中心', name: '民用飞机试飞中心', center: '试飞技术部' },
];

export const DEMO_MAJORS = [
  ['10-总体气动', '1001-总体与气动'],
  ['10-总体气动', '1002-需求与验证'],
  ['20-机体', '2002-强度'],
  ['20-机体', '2003-结构'],
  ['30-系统', '3002-飞控'],
  ['30-系统', '3001-航电电气'],
  ['40-制造', '4005-增材制造'],
  ['40-制造', '4001-系统工艺'],
  ['50-复合材料', '5001-复合材料设计'],
  ['50-复合材料', '5002-复合材料与工艺'],
  ['60-飞行', '6001-试飞工程'],
  ['70-运行支持', '7001-运行支援'],
  ['80-通用基础', '8005-信息化'],
  ['80-通用基础', '8004-标准化技术'],
  ['80-通用基础', '8003-情报档案'],
];

export const DEMO_OWNERS = [
  '林晚晴', '马浩南', '吴思远', '马浩博', '郑晓岚', '顾言蹊', '蒋一帆', '沈望舒',
  '秦月朗', '宋知行', '李慕白', '周子昂', '冯启航', '韩东野', '罗天翊', '梁栖梧',
  '许知夏', '唐暮云', '沈星野', '叶澄空',
];

export const DEMO_UPDATERS = [
  '王建国/E100001', '何雨桐/E100002', '顾言蹊/E200101', '蒋一帆/E200201',
  '沈望舒/E200301', '秦月朗/E200401', '郑晓岚/E200501', '马浩博/E200601',
  '宋知行/E200701', '汇总表维护人/E900001',
];

export const DEMO_OPERATOR_NOS = [
  'E100001', 'E100002', 'E200101', 'E200201', 'E200301', 'E200401', 'E200501', 'E200601', 'E200701', 'E900001',
];

export const DEMO_RESULT_POOL = [
  '总体方案报告', '风洞试验数据集', '仿真分析报告', '工程样机', '工艺规范',
  '软件原型', '专利受理', '软件著作', '标准草案', '试验台架', '适航符合性说明', '材料性能数据库',
  '软件需求规格', '地面试验大纲', '飞行试验数据包', '工艺评定报告', '可靠性评估报告',
];

export const DEMO_MODELS = ['C919', 'CR929', 'ARJ21', 'C929', '在研宽体型号', '支线改进型号'];

export const DEMO_PARTNERS = [
  '南京航空航天大学', '西北工业大学', '同济大学', '上海交通大学', '北京航空航天大学',
  '重庆大学', '香港理工大学', '中国民航大学', '中国商飞上海飞机制造有限公司', '国内材料供应商A',
];
