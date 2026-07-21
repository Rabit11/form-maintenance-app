// 造数脚本：拟真演示数据，锚定“今天”动态生成四色状态
import { unlinkSync, existsSync } from 'node:fs';
import { openDb, createSchema, ensureAuthAccounts, DB_PATH } from './db.js';
import { todayISO, addDays, statusColor, evalGrade } from './domain.js';

const TODAY = todayISO();
const THIS_YEAR = Number(TODAY.slice(0, 4));

// ---------- 确定性伪随机 ----------
let _s = 20260707;
function rnd() {
  _s |= 0; _s = (_s + 0x6D2B79F5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const round1 = (x) => Math.round(x * 10) / 10;

// ---------- 基础字典 ----------
const UNITS = [
  { id: 1, name: '上海飞机设计研究院', short: '上飞院' },
  { id: 2, name: '上海飞机制造有限公司', short: '上飞公司' },
  { id: 3, name: '北京民用飞机技术研究中心', short: '北研中心' },
  { id: 4, name: '上海飞机客户服务有限公司', short: '客服公司' },
  { id: 5, name: '民用飞机试飞中心', short: '试飞中心' },
  { id: 6, name: '复合材料与基础能力中心', short: '基础能力中心' },
  { id: 7, name: '公司总部科技管理部', short: '总部科技部', kind: 'hq' },
];
const unitByShort = Object.fromEntries(UNITS.map((u) => [u.short, u]));

const DECLARE_CHAIN = ['项目联系人', '项目负责人', '项目承担部门负责人', '二级总师', '单位财务部门负责人', '单位科技部门负责人', '单位分管领导', '一级总师', '总部科研项目处'];

const CHANNELS = [
  { id: 1, key: 'MJKY', name: 'MJKY', level: '国家级', org: 'GXB·装备二司', dept: '科研项目处', flow: ['建议书申报', '立项批复', '任务书/可研报告申报', '任务书/可研批复', '中期评估', '单位、公司两级验收评审', '国家级验收'], declare: ['建议书', '建议书意见'], filing: ['立项批复'] },
  { id: 2, key: 'ZX04', name: '04专项接续', level: '国家级', org: 'GXB·装备一司', dept: '科研项目处', flow: ['建议书申报', '立项批复', '合同书签署', '中期评估', '单位、公司两级验收评审', '国家级验收'], declare: ['建议书', '建议书意见'], filing: ['立项批复'] },
  { id: 3, key: 'ZDYF', name: '重点研发计划', level: '国家级', org: 'GXB·高新技术司', dept: '科研项目处', flow: ['申请书提交', '申请书评审', '任务书签署', '启动会', '中期评估', '单位、公司两级验收评审', '综合绩效评价'], declare: ['申请书', '申请书评审'], filing: [] },
  { id: 4, key: 'XX25', name: 'XX25专项', level: '国家级', org: '国资委·科技创新局', dept: '科研项目处', flow: ['任务清单报送', '任务清单评估并下达', '签署任务书', '季度会/双月报/年度评估', '国资委现场督导', '单位、公司两级验收评审', '验收评估'], declare: ['申报通知', '任务清单', '任务清单评估'], filing: [] },
  { id: 5, key: 'NSFC', name: '国家自然科学基金', level: '国家级', org: '科学技术部·国自然', dept: '科研项目处', flow: ['申请书提交', '申请书评审', '批准通知', '年度实施报告', '中期评估', '单位、公司两级验收评审', '国家级验收'], declare: ['申请书', '申请书评审'], filing: ['批准通知'] },
  { id: 6, key: 'FGW', name: 'FGW GXJC项目', level: '国家级', org: 'FGW·高技术司', dept: '科研项目处', flow: ['可研报告申报', '批复/投资补助下达', '实施', '中期评估', '单位、公司两级验收评审', '国家级验收'], declare: ['可研报告', '申报批复申请'], filing: ['投资补助批复'] },
  { id: 7, key: 'JBGS', name: '上海市科技攻关揭榜挂帅', level: '地方级', org: '上海市科委·空天海洋处', dept: '科研项目处', flow: ['榜单梳理', '榜单发布', '榜单答疑', '申请书评审并批复立项', '合同签订', '中期评审', '单位验收评审', '科委验收'], declare: ['榜单答疑'], filing: ['申请书评审'] },
  { id: 8, key: 'SHKC', name: '上海市科技创新行动计划', level: '地方级', org: '上海市科委·空天海洋处', dept: '科研项目处', flow: ['建议书申报', '建议书评审', '项目立项', '合同签订', '阶段性检查', '单位验收评审', '综合绩效评价'], declare: ['建议书', '建议书评审'], filing: ['立项通知'] },
  { id: 9, key: 'YYGD', name: '预研三年滚动计划', level: '公司级', org: '科技部·科研项目处', dept: '科研项目处', flow: ['建议书申报', '建议书评审', '项目立项', '任务书提交', '任务书确认并签订合同', '阶段性检查', '单位级验收评审', '公司级验收评审'], declare: ['建议书', '建议书评审'], filing: ['立项通知'] },
  { id: 10, key: 'ZDKC', name: '重大科技创新专项', level: '公司级', org: '科技部·科研项目处', dept: '科研项目处', flow: ['建议书申报', '专项论证', '项目立项', '任务书签订', '阶段性检查', '单位级验收评审', '公司级验收评审'], declare: ['建议书', '专项论证意见'], filing: ['立项通知'] },
  { id: 11, key: 'XJQX', name: '新疆大飞机气象创新中心', level: '公司级', org: '科技部·科研项目处', dept: '科研项目处', flow: ['申请书提交', '申请书评审', '技术委员会/主任委员会/理事会审议', '项目立项', '任务书提交', '任务书确认和合同签订', '阶段性检查', '单位验收评审'], declare: ['申请书', '申请书评审', '三会审议纪要'], filing: ['立项通知'] },
  { id: 12, key: 'KJZ', name: '科技周', level: '公司级', org: '科技部·科技发展处', dept: '科技发展处', flow: ['发布拟立项项目清单', '各单位立项', '实施', '验收'], declare: ['合作需求', '需求对接总结', '技术发展战略委员会审议'], filing: ['拟立项通知', '立项文件'] },
  { id: 13, key: 'DFY', name: '大飞机研究院', level: '公司级', org: '科技部·科技发展处', dept: '科技发展处', flow: ['项目建议书编制', '项目建议书评审', '形成拟立项清单', '理事会审议', '立项', '项目实施', '项目验收'], declare: ['项目申请书', '学术委员会审议'], filing: ['立项通知'] },
  { id: 14, key: 'CLLM', name: '大飞机先进材料创新联盟', level: '公司级', org: '科技部·技术基础处', dept: '技术基础处', flow: ['项目申报', '申请书评审', '联盟专委会审议', '联盟理事会审议', '立项建议报批', '发布立项通知', '合同书签署', '项目实施', '项目承担单位验收评审'], declare: ['项目申请书'], filing: ['立项建议清单及联盟专委会、理事会审议意见'] },
  { id: 15, key: 'BOEING', name: '"中国商飞-波音"可持续航空技术研究中心项目', level: '公司级', org: '科技部·科研项目处', dept: '科研项目处', flow: ['波音指导委员会立项', '项目合同签订', '向公司报备', '项目实施', '项目承担单位验收', '与总部签订拨款合同', '拨款'], declare: ['波音指导委员会会议纪要'], filing: ['三方合同'] },
];
// 渠道差异化：报备类审签链 / 科技周长链 / 各渠道评估检查内容
const ASSESS = {
  MJKY: ['中期评估'], ZX04: ['中期评估'], ZDYF: ['中期评估'],
  XX25: ['季度会/双月报', '年度评估', '国资委现场督导'],
  NSFC: ['年度实施报告', '中期评估'], FGW: ['中期评估'],
  JBGS: ['中期评审'], SHKC: ['阶段性检查'],
  YYGD: ['阶段性检查'], ZDKC: ['阶段性检查'], XJQX: ['阶段性检查'],
  KJZ: [], DFY: ['中期检查（重大项目）'], CLLM: ['阶段性检查'], BOEING: ['阶段性检查'],
};
const CHAIN_OVERRIDE = {
  BOEING: ['项目负责人', '北研中心科技部主管', '北研中心科技部部长', '北研中心分管领导', '总部科技部主管（备案）'],
  KJZ: ['项目负责人', '三级专业总师', '二级专业总师', '单位科技部门负责人', '单位分管科技领导', '总部科技发展处', '一级总师', '总部科技管理部'],
};
const MODE_OVERRIDE = { BOEING: '报备' };
for (const c of CHANNELS) {
  c.assess = ASSESS[c.key] || [];
  c.chain = CHAIN_OVERRIDE[c.key] || DECLARE_CHAIN;
  c.mode = MODE_OVERRIDE[c.key] || '审批';
}
const chByKey = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));

const USERS = [
  { id: 'u_leader', name: '周明远', role: 'leader', scope: 'hq', unit_id: 7, title: '公司领导 / 科技管理数智大屏决策查看' },
  { id: 'u_hq', name: '王建国', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部总维护 / 责任处室处长', emp_no: '200001' },
  { id: 'u_hq_staff', name: '何雨桐', role: 'mgmt', scope: 'hq', unit_id: 7, title: '总部总维护 / 科研项目主管', emp_no: '200002' },
  { id: 'u_ch_miit', name: '梁承泽', role: 'mgmt', scope: 'channel', unit_id: 7, title: '总部层级渠道专员 / 国家级', emp_no: '201001' },
  { id: 'u_ch_most', name: '纪清岚', role: 'mgmt', scope: 'channel', unit_id: 7, title: '总部层级渠道专员 / 国家级', emp_no: '201002' },
  { id: 'u_ch_ndrc', name: '唐砚秋', role: 'mgmt', scope: 'channel', unit_id: 7, title: '总部层级渠道专员 / 国家级', emp_no: '201003' },
  { id: 'u_ch_shkc', name: '许怀川', role: 'mgmt', scope: 'channel', unit_id: 7, title: '总部层级渠道专员 / 地方级', emp_no: '201004' },
  { id: 'u_ch_zgsf', name: '韩叙白', role: 'mgmt', scope: 'channel', unit_id: 7, title: '总部层级渠道专员 / 公司级', emp_no: '201005' },
  { id: 'u_super', name: '系统超级管理员', role: 'admin', scope: 'hq', unit_id: 7, title: '系统超级管理员 / 人员添加·删除·权限编辑', emp_no: '100001' },
];

/** 渠道(C列) → 总部层级渠道专员（可读全部，授权映射到层级后可改该层级渠道） */
const FORM_CHANNEL_OWNER_MAP = [
  { userId: 'u_ch_miit', name: '梁承泽', channels: ['工信部'] },
  { userId: 'u_ch_most', name: '纪清岚', channels: ['科技部'] },
  { userId: 'u_ch_ndrc', name: '唐砚秋', channels: ['发改委'] },
  { userId: 'u_ch_shkc', name: '许怀川', channels: ['市科委'] },
  { userId: 'u_ch_zgsf', name: '韩叙白', channels: ['ZGSF'] },
];

/** 项目类型 → 专项分表主管（与表头 sheet4 第 A 列一致；与 V19 冲突时服从现有表头字典） */
const FORM_TYPE_OWNER_MAP = [
  { userId: 'u_type_nat', name: '顾言蹊', types: ['MJKY', '国家科技重大专项--04专项', '1025', 'FGW第一批GXJC项目'] },
  { userId: 'u_type_rd', name: '蒋一帆', types: ['下一代国家重点研发计划', '大飞机基础研究联合基金', '新材料2030专项'] },
  { userId: 'u_type_local', name: '沈望舒', types: ['上海市科技攻关揭榜挂帅', '上海市科委、经信委项目'] },
  { userId: 'u_type_corp', name: '秦月朗', types: ['预研三年', '重大科技创新', '实验室', '科技委技术发展课题'] },
  { userId: 'u_type_lab', name: '郑晓岚', types: [
    '大飞机研究院-南航', '大飞机研究院-西工', '大飞机研究院-同济', '大飞机研究院-上海交大',
    '大飞机研究院-北航', '大飞机研究院-重庆大学', '大飞机研究院-香港理工', '大飞机研究院-中国民航大学',
  ] },
  { userId: 'u_type_coop', name: '马浩博', types: ['科技周', '新疆气象中心项目', '大飞机先进材料创新联盟', '波音合作'] },
  { userId: 'u_type_misc', name: '宋知行', types: ['KT', 'XP', '高质量专项'] },
];

// 人名池
const P = ['马浩博', '李慕白', '周子昂', '吴思远', '郑晓岚', '冯启航', '顾言蹊', '蒋一帆', '沈望舒', '韩东野', '秦月朗', '罗天翊', '梁栖梧', '宋知行', '唐云帆', '邓稼轩', '曹沐阳', '彭砚秋', '袁鹏举', '崔明睿', '苏子衿', '潘凌霄', '杜若飞', '夏鸿远', '钟英华', '江晚舟', '陆则鸣', '孔繁星', '白鹭洲', '任泊远', '傅山河', '穆清扬', '倪广衡', '成蹊', '雷震宇', '齐修远'];
const CHIEF1 = ['陈铁军', '刘远山', '黄海峰', '徐立群', '郭长风'];  // 一级总师
const CHIEF2 = ['蔡文渊', '严守拙', '石建南', '谷正阳', '章明远', '闻人靖'];  // 二级总师
const HQ_STAFF = ['何雨桐', '孙立诚'];
const UNIT_DEPT = { 1: '方致远', 2: '汪听澜', 3: '许承宇', 4: '柳含烟', 5: '欧阳靖', 6: '万里鹏' };  // 单位科技部长
const UNIT_STAFF2 = { 1: '田念慈', 2: '尹相杰', 3: '侯思齐', 4: '常乐山', 5: '祁连雪', 6: '芮小丹' };
const FIN_HEAD = { 1: '毕仲文', 2: '桑晚枫', 3: '甘明玉', 4: '路遥青', 5: '花逢时', 6: '宁致和' };
const FIN_STAFF = { 1: '龚雪君', 2: '赵美玲', 3: '樊晓星', 4: 'projectionist', 5: '边慕云', 6: '费听雨' };
FIN_STAFF[4] = '瞿采薇';

function team(unitId, ownerName) {
  // owner/tech/pm 不重名
  const pool = [...P];
  const draw = () => pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const owner = ownerName || draw();
  const reserve = (name) => {
    const idx = pool.indexOf(name);
    if (idx >= 0) pool.splice(idx, 1);
    return name;
  };
  const tech = owner === '林晚晴' ? reserve('马浩南') : draw();
  const pm = owner === '林晚晴' ? reserve('吴思远') : draw();
  return {
    owner,
    tech,
    pm,
    chief1: pick(CHIEF1),
    chief2: pick(CHIEF2),
    hqHead: '王建国',
    hqStaff: pick(HQ_STAFF),
    unitDeptHead: UNIT_DEPT[unitId],
    unitStaff: UNIT_STAFF2[unitId],
    finHq: '金世安',
    finHead: FIN_HEAD[unitId],
    finStaff: FIN_STAFF[unitId],
  };
}

// ---------- 项目定义 ----------
// [name, channelKey, unitShort, status, 总经费万, startYear, endYear, 色彩画像, owner?, partners?]
const DEF = [
  ['氢电飞机验证机研制', 'MJKY', '北研中心', '实施中', 23000, 2024, 2027, 'yellow', '马浩博', [['上飞公司', '机体结构制造'], ['上飞院', '总体气动设计'], ['客服公司', '运行支持研究']]],
  ['民机驾驶舱单一飞行员运行研究', 'MJKY', '上飞院', '实施中', 4200, 2025, 2027, 'blue', null, [['北研中心', '智能辅助决策算法']]],
  ['机载激光雷达晴空湍流探测技术', 'MJKY', '上飞院', '申报中', 5600, 2026, 2029, 'blue', '林晚晴', [['中国科学院力学研究所', '湍流机理建模']]],
  ['飞控系统多余度架构优化技术', 'ZX04', '上飞院', '实施中', 6800, 2023, 2026, 'green', null, [['北研中心', '余度管理算法']]],
  ['高速数据总线国产化验证', 'ZX04', '北研中心', '已验收', 3600, 2022, 2025, 'green', null, [['上飞院', '机载环境适配验证']]],
  ['民机噪声适航符合性预测技术', 'ZX04', '试飞中心', '申报中', 2800, 2026, 2028, 'blue', null, []],
  ['复合材料机翼损伤容限评估技术', 'ZDYF', '上飞院', '验收中', 8900, 2022, 2026, 'yellow', '林晚晴', [['西北工业大学', '损伤扩展试验'], ['基础能力中心', '试样制备与检测']]],
  ['大涵道比涡扇发动机短舱降噪技术', 'ZDYF', '上飞院', '实施中', 7400, 2024, 2027, 'blue', null, [['中国航发商发', '声衬联合设计']]],
  ['民机颤振主动抑制技术研究', 'ZDYF', '上飞院', '实施中', 5200, 2024, 2027, 'yellow', null, [['南京航空航天大学', '气动伺服弹性建模']]],
  ['增材制造钛合金主承力框应用研究', 'XX25', '上飞公司', '实施中', 9600, 2024, 2027, 'blue', null, [['中国航空制造技术研究院', '工艺规范制定']]],
  ['智能蒙皮与形变感知技术', 'XX25', '上飞院', '立项中', 4800, 2026, 2029, 'blue', null, []],
  ['大型客机气动声学综合设计技术', 'XX25', '上飞院', '已验收', 15600, 2021, 2024, 'green', null, [['北京航空航天大学', '声源识别方法'], ['试飞中心', '飞行试验验证']]],
  ['结冰风洞试验技术与相似准则研究', 'NSFC', '上飞院', '实施中', 320, 2024, 2027, 'blue', null, []],
  ['超临界机翼非定常流动机理研究', 'NSFC', '北研中心', '实施中', 280, 2025, 2028, 'blue', null, []],
  ['民机健康管理(PHM)大数据平台', 'FGW', '客服公司', '实施中', 7800, 2023, 2026, 'red', null, [['上飞院', '机载数据接口标准']]],
  ['民用飞机试飞数据中心能力建设', 'FGW', '试飞中心', '实施中', 12800, 2024, 2027, 'blue', null, []],
  ['客舱降噪与声品质设计技术', 'JBGS', '上飞院', '验收中', 3400, 2023, 2026, 'yellow', null, [['同济大学', '声品质主观评价']]],
  ['民机电动滑行系统可行性研究', 'JBGS', '北研中心', '已终止', 1800, 2023, 2025, 'green', null, []],
  ['民机全生命周期碳足迹评估技术', 'SHKC', '北研中心', '实施中', 2600, 2024, 2026, 'yellow', null, [['上海交通大学', '碳核算模型']]],
  ['大型风洞模型快速制造技术', 'SHKC', '基础能力中心', '实施中', 2200, 2024, 2026, 'blue', null, []],
  ['智能座舱人机交互技术研究', 'YYGD', '上飞院', '实施中', 3800, 2024, 2026, 'yellow', null, [['北研中心', '语音交互引擎']]],
  ['机翼自然层流减阻设计验证', 'YYGD', '上飞院', '实施中', 4600, 2023, 2026, 'red', '林晚晴', [['试飞中心', '飞行测量改装']]],
  ['起落架健康监测与预测性维护', 'YYGD', '客服公司', '验收中', 2900, 2023, 2026, 'yellow', null, [['苏州长风航空电子', '传感器组件']]],
  ['航电系统模型驱动开发方法', 'YYGD', '上飞院', '实施中', 3100, 2025, 2027, 'blue', null, []],
  ['民机安全性评估数字化工具链', 'YYGD', '上飞院', '实施中', 2700, 2025, 2027, 'blue', null, []],
  ['复材回收再利用技术研究', 'YYGD', '上飞院', '实施中', 1900, 2025, 2028, 'blue', '林晚晴', [['基础能力中心', '回收料性能评估']]],
  ['高原机场起降性能拓展研究', 'YYGD', '试飞中心', '实施中', 2400, 2024, 2026, 'blue', null, []],
  ['民机防除冰系统新构型研究', 'YYGD', '上飞院', '实施中', 3300, 2024, 2026, 'red', null, []],
  ['全机静力试验智能测控系统', 'ZDKC', '上飞公司', '实施中', 5400, 2024, 2027, 'blue', null, [['基础能力中心', '高精度加载设备']]],
  ['飞机总装脉动生产线仿真优化', 'ZDKC', '上飞公司', '实施中', 4100, 2024, 2026, 'yellow', null, []],
  ['高空长航时气象探测无人平台', 'XJQX', '北研中心', '实施中', 6200, 2024, 2027, 'red', null, [['新疆气象科学研究所', '探测载荷标定']]],
  ['气象大数据航路优化技术', 'XJQX', '客服公司', '实施中', 1600, 2025, 2027, 'yellow', null, []],
  ['智慧民机科普互动系统', 'KJZ', '客服公司', '已验收', 260, 2023, 2023, 'green', null, []],
  ['数字风洞云展示平台', 'KJZ', '上飞院', '立项中', 180, 2026, 2026, 'blue', null, []],
  ['无人驾驶航空器适航标准预研', 'DFY', '北研中心', '实施中', 1400, 2025, 2027, 'blue', null, [['中国民航大学', '标准草案编制']]],
  ['民机市场需求预测模型研究', 'DFY', '北研中心', '已验收', 900, 2023, 2025, 'green', null, []],
  ['高温树脂体系联合研发', 'CLLM', '基础能力中心', '实施中', 2800, 2024, 2027, 'yellow', null, [['中航复合材料有限责任公司', '树脂配方开发']]],
  ['拉挤成型复材长桁产业化技术', 'CLLM', '上飞公司', '申报中', 3200, 2026, 2028, 'blue', null, [['哈尔滨工业大学', '成型工艺仿真']]],
  ['钛合金紧固件国产替代验证', 'CLLM', '上飞公司', '实施中', 1700, 2024, 2026, 'blue', null, []],
  ['可持续航空燃料适配性验证', 'BOEING', '北研中心', '实施中', 5800, 2023, 2026, 'yellow', null, [['波音研究与技术', '燃料性能联合测试']]],
  ['民机噪声飞行试验方法研究', 'BOEING', '试飞中心', '已验收', 2100, 2021, 2023, 'green', null, []],
];

// 里程碑标题模板
const MS_T = ['完成总体技术方案评审', '完成关键部件详细设计', '完成原理样机制造', '完成地面集成试验', '完成试验件交付与检测', '完成中期评估并通过', '完成飞行/环境验证试验', '完成技术总结与成果归档', '完成软件工具链集成验证', '完成工艺规范固化'];
const PLAN_T = ['提交年度实施计划备案', '完成季度进展报告填报', '组织内部技术评审会', '完成外协合同签订备案', '提交中期自评估报告', '完成年度经费预算填报', '组织供应商现场核查', '完成试验大纲会签', '提交知识产权布局分析', '完成风险台账季度更新'];

function msDates(startY, endY, profile, status) {
  // 生成 4-6 个里程碑：已完成的在过去，进行中的按画像铺红/黄/蓝
  const n = ri(4, 6);
  const list = [];
  const done = status === '已验收' || status === '已终止' || status === '验收中';
  for (let i = 0; i < n; i++) {
    const frac = (i + 1) / (n + 0.5);
    const spanDays = (endY - startY + 1) * 330;
    let due = addDays(`${startY}-03-15`, Math.floor(spanDays * frac));
    if (due > `${endY}-12-20`) due = `${endY}-12-20`;
    let done_at = null;
    if (done) {
      done_at = addDays(due, -ri(3, 25));
    } else if (due < TODAY) {
      done_at = addDays(due, -ri(2, 20)); // 默认按期完成
    }
    list.push({ due, done_at });
  }
  if (!done) {
    // 按画像制造一个红/黄节点
    if (profile === 'red') {
      const target = list.find((m) => m.done_at && m.due < TODAY) || list[0];
      target.done_at = null;
      target.due = addDays(TODAY, -ri(10, 75));
    } else if (profile === 'yellow') {
      // 找一个未来节点拉近到 30 天内
      let target = list.find((m) => !m.done_at && m.due > TODAY);
      if (!target) { target = list[list.length - 1]; target.done_at = null; }
      target.due = addDays(TODAY, ri(4, 28));
    }
    // 保证至少一个远期蓝色节点
    const lastM = list[list.length - 1];
    if (lastM.done_at == null && lastM.due <= addDays(TODAY, 30) && profile !== 'yellow' && profile !== 'red') {
      lastM.due = addDays(TODAY, ri(45, 200));
    }
  }
  return list;
}

// ---------- 建库 ----------
// 优先直接删库文件；若被运行中的服务进程占用（Windows 文件锁），则降级为逐表清空重建
for (const f of [DB_PATH, DB_PATH + '-journal', DB_PATH.replace('.db', '.db-wal'), DB_PATH + '-wal', DB_PATH + '-shm']) {
  try { if (existsSync(f)) unlinkSync(f); } catch { /* 服务占用时忽略 */ }
}
const db = openDb();
const TABLES = ['transition_records', 'transition_import_rows', 'transition_import_batches', 'transition_type_owners', 'transition_channel_owners', 'units', 'channels', 'users', 'projects', 'milestones', 'plans', 'funds', 'funding_pool', 'funding_quota', 'funding_requests', 'deliverables', 'packages', 'collaborators', 'post_evals', 'approvals', 'changes', 'documents', 'alerts', 'audit', 'uploads', 'kv'];
for (const t of TABLES) db.exec(`DROP TABLE IF EXISTS ${t}`);
createSchema(db);

const ins = {
  unit: db.prepare('INSERT INTO units (id,name,short,kind) VALUES (?,?,?,?)'),
  channel: db.prepare('INSERT INTO channels (id,key,name,level,org,dept,flow_json,declare_json,filing_json,approve_chain_json,declare_mode,assess_json,enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)'),
  user: db.prepare("INSERT INTO users (id,name,role,scope,unit_id,title,status,emp_no) VALUES (?,?,?,?,?,?,'在岗',?)"),
  project: db.prepare(`INSERT INTO projects (id,code,wbs,name,goal,year_goal,level,channel_id,lead_unit_id,partners_json,team_json,start,end,status,total_budget,transform_status,accepted_at,tags_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  ms: db.prepare('INSERT INTO milestones (project_id,year,seq,title,due,done_at,evidence,delay_reason) VALUES (?,?,?,?,?,?,?,?)'),
  plan: db.prepare('INSERT INTO plans (project_id,title,source,due,done_at,status) VALUES (?,?,?,?,?,?)'),
  fund: db.prepare('INSERT INTO funds (project_id,year,budget,spent,writeoffs_json) VALUES (?,?,?,?,?)'),
  pool: db.prepare('INSERT INTO funding_pool (year,total,note) VALUES (?,?,?)'),
  quota: db.prepare('INSERT INTO funding_quota (year,unit_id,quota,paid) VALUES (?,?,?,?)'),
  freq: db.prepare('INSERT INTO funding_requests (year,unit_id,amount,purpose,status,created_at,decided_at) VALUES (?,?,?,?,?,?,?)'),
  del: db.prepare('INSERT INTO deliverables (project_id,name,type,due,delivered_at,owner,package_id) VALUES (?,?,?,?,?,?,?)'),
  pkg: db.prepare('INSERT INTO packages (id,code,name,project_id,mode,form,plan_date,actual_date,status,brief,detail,unit_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'),
  col: db.prepare('INSERT INTO collaborators (project_id,name,ctype,scores_json,total,grade,eval_date,evaluator,blacklisted,note) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  pe: db.prepare('INSERT INTO post_evals (project_id,status,deadline,started_at,finished_at,conclusion,scores_json) VALUES (?,?,?,?,?,?,?)'),
  appr: db.prepare('INSERT INTO approvals (type,title,project_id,initiator,unit_id,created_at,status,current_step,steps_json,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)'),
  chg: db.prepare('INSERT INTO changes (project_id,kind,category,detail,reason,status,created_at) VALUES (?,?,?,?,?,?,?)'),
  doc: db.prepare('INSERT INTO documents (project_id,phase,name,uploaded_at,uploader,size_kb) VALUES (?,?,?,?,?,?)'),
  alert: db.prepare('INSERT INTO alerts (project_id,kind,level,title,due,created_at,channels,read) VALUES (?,?,?,?,?,?,?,?)'),
  audit: db.prepare('INSERT INTO audit (ts,user_name,action,target,detail) VALUES (?,?,?,?,?)'),
};

db.transaction(() => {
  for (const u of UNITS) ins.unit.run(u.id, u.name, u.short, u.kind || 'unit');
  for (const c of CHANNELS) ins.channel.run(c.id, c.key, c.name, c.level, c.org, c.dept, JSON.stringify(c.flow), JSON.stringify(c.declare), JSON.stringify(c.filing), JSON.stringify(c.chain), c.mode, JSON.stringify(c.assess));
  const EMP_FALLBACK = {
    u_leader: '110001',
    u_hq: '200001', u_hq_staff: '200002',
    u_ch_miit: '201001', u_ch_most: '201002', u_ch_ndrc: '201003', u_ch_shkc: '201004', u_ch_zgsf: '201005',
    u_super: '100001',
  };
  for (const u of USERS) {
    ins.user.run(u.id, u.name, u.role, u.scope, u.unit_id, u.title, u.emp_no || EMP_FALLBACK[u.id] || null);
  }

  const GOALS = {
    氢电飞机验证机研制: '完成氢电动力验证机总体研制并实现首飞前地面全状态验证',
  };

  let seq = { y: {}, n: 0 };
  DEF.forEach((d, idx) => {
    const [name, chKey, unitShort, status, budget, sy, ey, profile, ownerName, partners = []] = d;
    const ch = chByKey[chKey];
    const unit = unitByShort[unitShort];
    const id = idx + 1;
    seq.y[sy] = (seq.y[sy] || 0) + 1;
    const code = `KY-${sy}-${String(seq.y[sy]).padStart(3, '0')}`;
    const wbs = `3-03${String(ri(10000, 99999))}-${String(ri(10, 99))}`;
    const t = team(unit.id, ownerName);
    const goal = GOALS[name] || `突破${name.replace(/技术|研究|研制|验证|平台|系统/g, '')}关键技术，形成可工程应用的技术体系与成果`;
    const yearGoal = status === '实施中' ? pick(['完成关键试验验证与阶段评审', '完成样机集成与地面试验', '完成中期评估并启动第二阶段', '完成核心算法工程化与测试']) : null;
    const transform = status === '已验收' ? pick(['已转化应用', '技术储备待应用', '接续研发立项']) : null;
    const partnerObjs = partners.map(([pn, pw]) => ({ name: pn, work: pw }));
    const ACCEPTED = { '高速数据总线国产化验证': '2025-12-18', '大型客机气动声学综合设计技术': '2024-03-20', '智慧民机科普互动系统': `${THIS_YEAR - 3}-07-20`, '民机噪声飞行试验方法研究': '2023-10-15', '民机市场需求预测模型研究': addDays(TODAY, -16) };
    ins.project.run(id, code, wbs, name, goal, yearGoal, ch.level, ch.id, unit.id, JSON.stringify(partnerObjs), JSON.stringify(t), `${sy}-0${ri(1, 6)}-01`, `${ey}-12-31`, status, budget, transform, status === '已验收' ? (ACCEPTED[name] || `${ey}-11-20`) : null, JSON.stringify([ch.name, unit.short]));

    // 里程碑
    if (status !== '申报中' && status !== '立项中') {
      const list = msDates(sy, ey, profile, status);
      list.forEach((m, i) => {
        ins.ms.run(id, Number(m.due.slice(0, 4)), i + 1, MS_T[(i + idx) % MS_T.length], m.due, m.done_at, m.done_at ? '试验报告+评审纪要.pdf' : null, !m.done_at && m.due < TODAY ? pick(['外协件交付延迟', '试验资源排期冲突', '技术方案迭代超期']) : null);
      });
      // 计划（CMOS 同步）
      const np = ri(3, 6);
      for (let i = 0; i < np; i++) {
        const past = rnd() < 0.5;
        const due = past ? addDays(TODAY, -ri(10, 200)) : addDays(TODAY, ri(5, 160));
        const doneAt = past && rnd() < 0.85 ? addDays(due, -ri(1, 10)) : null;
        const st = doneAt ? '已完成' : (past ? '待办' : (rnd() < 0.15 ? '办结审批中' : '待办'));
        ins.plan.run(id, PLAN_T[(i * 3 + idx) % PLAN_T.length], 'CMOS', due, doneAt, st);
      }
      // 经费
      for (let y = sy; y <= Math.min(ey, THIS_YEAR); y++) {
        const yearsN = ey - sy + 1;
        const base = budget / yearsN;
        const b = round1(base * (0.75 + rnd() * 0.5));
        let spentRatio;
        if (y < THIS_YEAR) spentRatio = 0.9 + rnd() * 0.09;
        else spentRatio = status === '已验收' ? 0.95 : 0.35 + rnd() * 0.35;
        const spent = round1(b * spentRatio);
        const wo = [];
        const nWo = ri(1, 3);
        for (let k = 0; k < nWo; k++) {
          wo.push({ date: `${y}-${String(ri(1, y === THIS_YEAR ? 6 : 12)).padStart(2, '0')}-${String(ri(2, 27)).padStart(2, '0')}`, amount: round1(spent / nWo), voucher: `沪财凭-${y}-${ri(1000, 9999)}`, note: pick(['试验件采购', '外协测试费', '材料费', '设备使用费', '差旅与会议', '人工费分摊']) });
        }
        ins.fund.run(id, y, b, spent, JSON.stringify(wo));
      }
    }
  });

  // ---------- 交付物 ----------
  const DELIV = [
    // project_id 由名称查
    ['氢电飞机验证机研制', [['高能量密度电池系统原理样机', '原理样机', 1], ['氢电动力系统地面集成试验报告', '成套技术成果', 1], ['燃料电池热管理专利族(3项)', '专利', 0, 'near'], ['氢安全设计技术标准(草案)', '技术标准', 0, 'far']]],
    ['复合材料机翼损伤容限评估技术', [['复材损伤容限评估软件V2.0', '软著', 1], ['损伤扩展试验数据库', '成套技术成果', 1], ['冲击损伤评估方法发明专利', '专利', 1], ['损伤容限设计指南', '技术标准', 0, 'near']]],
    ['大型客机气动声学综合设计技术', [['气动声学设计工具链V3.0', '软著', 1], ['声源识别方法发明专利(2项)', '专利', 1], ['机体噪声预测技术标准', '技术标准', 1], ['SCI/EI论文(8篇)', '论文', 1]]],
    ['高速数据总线国产化验证', [['国产总线接口组件(套件)', '设备', 1], ['机载环境适配验证报告', '成套技术成果', 1], ['总线协议一致性测试软著', '软著', 1]]],
    ['客舱降噪与声品质设计技术', [['客舱声学仿真模型库', '软著', 1], ['声品质主观评价方法论文(4篇)', '论文', 1], ['低噪声内饰设计专利', '专利', 0, 'near']]],
    ['增材制造钛合金主承力框应用研究', [['钛合金主承力框全尺寸试验件', '原理样机', 1], ['增材工艺规范', '技术标准', 0, 'far'], ['成形过程仿真软著', '软著', 1]]],
    ['民机健康管理(PHM)大数据平台', [['PHM平台V1.0(部署版)', '成套技术成果', 0, 'over'], ['边缘数据采集终端', '设备', 1], ['故障预测算法专利(2项)', '专利', 0, 'near']]],
    ['智能座舱人机交互技术研究', [['多模态交互原型座舱', '原理样机', 0, 'near'], ['语音指令语料库与软著', '软著', 1]]],
    ['机翼自然层流减阻设计验证', [['层流机翼设计准则', '技术标准', 0, 'over'], ['飞行测量数据集', '成套技术成果', 0, 'far'], ['转捩预测方法论文(3篇)', '论文', 1]]],
    ['起落架健康监测与预测性维护', [['起落架载荷谱监测系统', '设备', 1], ['寿命预测模型软著', '软著', 1], ['健康监测传感布置专利', '专利', 1]]],
    ['结冰风洞试验技术与相似准则研究', [['结冰相似准则修正方法论文(2篇)', '论文', 1], ['缩比试验换算软件', '软著', 0, 'near']]],
    ['全机静力试验智能测控系统', [['智能测控系统V1.0', '设备', 0, 'far'], ['载荷协调控制算法软著', '软著', 1]]],
    ['可持续航空燃料适配性验证', [['SAF适配性测试报告(联合)', '成套技术成果', 0, 'near'], ['燃料系统材料相容性数据库', '成套技术成果', 1]]],
    ['民机噪声飞行试验方法研究', [['噪声飞行试验方法标准', '技术标准', 1], ['试验数据处理软著', '软著', 1]]],
    ['高空长航时气象探测无人平台', [['气象探测载荷舱原理样机', '原理样机', 0, 'over'], ['平台总体设计报告', '成套技术成果', 1]]],
    ['民机市场需求预测模型研究', [['需求预测模型软著', '软著', 1], ['市场研究报告(3册)', '成套技术成果', 1]]],
    ['高温树脂体系联合研发', [['高温树脂配方(中试批次)', '成套技术成果', 0, 'near'], ['固化工艺参数专利', '专利', 0, 'far']]],
  ];
  const projByName = {};
  for (const row of db.prepare('SELECT id,name,lead_unit_id,start,end,status FROM projects').all()) projByName[row.name] = row;

  let pkgSeq = 0;
  const PKGS = [
    { name: '气动声学设计工具链成果包', proj: '大型客机气动声学综合设计技术', mode: '向型号转化', form: '装机', status: '已完成', plan: '2025-06-30', actual: '2025-05-20', brief: '工具链纳入型号声学设计流程，支撑后续型号低噪声设计。', detail: '转化任务：纳入2025年公司预先研究成果转化工作计划；应用对象：在研宽体型号；应用单位：上飞院。' },
    { name: '高速数据总线接口组件成果包', proj: '高速数据总线国产化验证', mode: '向型号转化', form: '装机', status: '已完成', plan: '2025-12-31', actual: '2025-11-08', brief: '国产总线组件完成装机评审，进入型号供应链。', detail: '应用对象：C系列航电改进批次；应用单位：北研中心、上飞院。' },
    { name: '客舱声品质设计方法成果包', proj: '客舱降噪与声品质设计技术', mode: '向型号转化', form: '未装机', status: '已签协议', plan: 'F+120', brief: '设计方法移交型号内饰团队，开展装机前评估。', detail: '转化任务：纳入2026年成果转化计划；应用单位：上飞院客舱集成部门。' },
    { name: '静力试验智能测控系统成果包', proj: '全机静力试验智能测控系统', mode: '向市场转化', form: '转让', status: '已签协议', plan: 'F+60', brief: '测控系统整体转让至航空试验服务企业。', detail: '交易对象：某航空科技服务公司；合同金额：1350万元；转化净收益：约420万元；已启动奖励分配流程。' },
    { name: '结冰相似准则软件成果包', proj: '结冰风洞试验技术与相似准则研究', mode: '向市场转化', form: '许可', status: '洽谈中', plan: 'F+22', brief: '缩比换算软件对风洞试验机构开放许可。', detail: '合作对象：国内两家风洞试验中心；许可模式：三年期使用许可。' },
    { name: 'PHM边缘采集终端成果包', proj: '民机健康管理(PHM)大数据平台', mode: '向市场转化', form: '联合实施', status: '洽谈中', plan: 'F-18', brief: '与航空公司联合开展机队级健康监测试点。', detail: '合作对象：两家国内航司；商务模式：按机队规模订阅。' },
    { name: '湍流探测算法库成果包', proj: '机载激光雷达晴空湍流探测技术', mode: '向市场转化', form: '其他', status: '未启动', plan: 'F+320', brief: '面向通航与公务机市场的湍流预警算法储备。', detail: '待项目中期成果固化后启动。' },
    { name: '层流设计准则成果包', proj: '机翼自然层流减阻设计验证', mode: '向型号转化', form: '未装机', status: '洽谈中', plan: 'F+45', brief: '层流设计准则纳入型号气动设计规范评估。', detail: '应用对象：下一代单通道型号预研；应用单位：上飞院。' },
  ];
  for (const [pname, items] of DELIV) {
    const proj = projByName[pname];
    if (!proj) continue;
    for (const [dn, dt, delivered, when] of items) {
      let due, deliveredAt = null;
      if (delivered) {
        due = addDays(TODAY, -ri(60, 400));
        deliveredAt = addDays(due, -ri(3, 30));
      } else if (when === 'over') {
        due = addDays(TODAY, -ri(15, 60));
      } else if (when === 'near') {
        due = addDays(TODAY, ri(5, 28));
      } else {
        due = addDays(TODAY, ri(60, 300));
      }
      ins.del.run(proj.id, dn, dt, due, deliveredAt, pick(['公司', '公司、各单位', '公司、参研单位']), null);
    }
  }
  for (const p of PKGS) {
    const proj = projByName[p.proj];
    if (!proj) continue;
    pkgSeq += 1;
    const code = `CG-${THIS_YEAR}-${String(pkgSeq).padStart(3, '0')}`;
    let plan = p.plan;
    if (typeof plan === 'string' && plan.startsWith('F')) plan = addDays(TODAY, Number(plan.slice(1)));
    ins.pkg.run(pkgSeq, code, p.name, proj.id, p.mode, p.form, plan, p.actual || null, p.status, p.brief, p.detail, proj.lead_unit_id);
    // 绑定该项目已交付交付物
    db.prepare('UPDATE deliverables SET package_id=? WHERE project_id=? AND delivered_at IS NOT NULL').run(pkgSeq, proj.id);
  }

  // ---------- 协作单位评价 ----------
  const evalFor = (pname, cname, ctype, base, note = null, blacklisted = 0) => {
    const proj = projByName[pname];
    if (!proj) return;
    const s = {
      tech: Math.min(100, base + ri(-4, 6)),
      quality: Math.min(100, base + ri(-5, 5)),
      schedule: Math.min(100, base + ri(-8, 4)),
      service: Math.min(100, base + ri(-3, 6)),
      compliance: Math.min(100, base + ri(-2, 5)),
    };
    const total = Math.round((s.tech + s.quality + s.schedule + s.service + s.compliance) / 5);
    ins.col.run(proj.id, cname, ctype, JSON.stringify(s), total, evalGrade(total), addDays(TODAY, -ri(20, 400)), pick(P), blacklisted, note);
  };
  evalFor('大型客机气动声学综合设计技术', '北京航空航天大学', '参研', 93);
  evalFor('大型客机气动声学综合设计技术', '民用飞机试飞中心', '参研', 91);
  evalFor('高速数据总线国产化验证', '中航光电科技股份有限公司', '外协', 88);
  evalFor('高速数据总线国产化验证', '华东软件测评中心', '外协', 58, '进度履约严重滞后，测试报告两次退回；已按程序协调法律部门纳入黑名单。', 1);
  evalFor('民机噪声飞行试验方法研究', '波音研究与技术', '参研', 90);
  evalFor('民机市场需求预测模型研究', '中国民航大学', '参研', 84);
  evalFor('智慧民机科普互动系统', '上海某数字科技有限公司', '外协', 76);
  evalFor('复合材料机翼损伤容限评估技术', '西北工业大学', '参研', 89);
  evalFor('起落架健康监测与预测性维护', '苏州长风航空电子', '外协', 82);
  evalFor('客舱降噪与声品质设计技术', '同济大学', '参研', 86);
  // 未评价的在库协作单位
  const pendCols = [['民机市场需求预测模型研究', '中航信息产业研究院', '参研'], ['氢电飞机验证机研制', '上飞公司', '参研'], ['氢电飞机验证机研制', '上飞院', '参研'], ['大涵道比涡扇发动机短舱降噪技术', '中国航发商发', '参研'], ['可持续航空燃料适配性验证', '波音研究与技术', '参研'], ['高温树脂体系联合研发', '中航复合材料有限责任公司', '参研'], ['增材制造钛合金主承力框应用研究', '中国航空制造技术研究院', '参研']];
  for (const [pn, cn, ct] of pendCols) {
    const proj = projByName[pn];
    if (proj) ins.col.run(proj.id, cn, ct, null, null, null, null, null, 0, null);
  }

  // ---------- 后评价 ----------
  // V19 本轮按 411582 批注暂缓/删除后评价，保留表结构用于后续阶段，不再写入演示待办与预警。

  // ---------- 审批流 ----------
  const CH_STEPS = {
    declaration: DECLARE_CHAIN,
    filing: ['项目团队上传立项材料', '单位科技管理部审核', '总部科研项目处备案'],
    change: ['项目团队填报', '二级单位主管部门初审', '总部管理部门终审'],
    data_change: ['项目团队填报', '二级单位内部审批', '总部科技主管确认'],
    milestone_close: ['项目团队提交佐证', '单位科技部门核验'],
    plan_finish: ['项目团队提交办结申请', '二级单位管理团队终审'],
    acceptance: ['项目团队提交验收申请', '二级单位管理团队初审', '责任总师技术复核', '总部管理团队终审'],
    funding: ['单位提交拨付申请', '总部科技部审核', '总部财务部复核', '拨付执行'],
    package: ['项目团队填报转化信息', '二级单位管理团队审核', '总部管理团队备案'],
    evaluation: ['项目团队五维评分', '单位管理团队确认', '总部备案'],
  };
  function mkSteps(type, proj, currentIdx, assignees = {}) {
    const t = proj ? JSON.parse(proj.team_json || '{}') : {};
    const nameFor = (title) => {
      if (assignees[title]) return assignees[title];
      if (title.includes('一级总师')) return t.chief1 || '陈铁军';
      if (title.includes('二级总师')) return t.chief2 || pick(CHIEF2);
      if (title.includes('责任总师')) return t.chief1 || '陈铁军';
      if (title.includes('总部') || title.includes('科研项目处')) return '王建国';
      if (title.includes('财务')) return t.finHead || '桑晚枫';
      if (title.includes('项目负责人')) return t.owner || pick(P);
      if (title.includes('项目团队') || title.includes('项目联系人') || title.includes('单位提交')) return t.owner || pick(P);
      if (title.includes('分管领导')) return pick(['贺天工', '倪云舟']);
      if (title.includes('单位科技') || title.includes('二级单位') || title.includes('单位管理')) return t.unitDeptHead || pick(Object.values(UNIT_DEPT));
      if (title.includes('部门负责人')) return pick(P);
      if (title.includes('拨付执行')) return '金世安';
      return pick(P);
    };
    return CH_STEPS[type].map((title, i) => ({
      title,
      assignee: nameFor(title),
      status: i < currentIdx ? 'approved' : i === currentIdx ? 'current' : 'pending',
      at: i < currentIdx ? addDays(TODAY, -ri(1, 20)) : null,
      comment: i < currentIdx ? pick(['同意，按程序推进。', '材料齐备，同意上报。', '技术路线可行，同意。', '经核无误，同意。']) : null,
    }));
  }
  function approval(type, title, pname, currentIdx, payload = {}, status = '审批中', createdDaysAgo = ri(2, 15)) {
    const proj = pname ? db.prepare('SELECT * FROM projects WHERE name=?').get(pname) : null;
    const steps = mkSteps(type, proj, status === '审批中' ? currentIdx : CH_STEPS[type].length);
    if (status !== '审批中') steps.forEach((s) => { s.status = 'approved'; s.at = s.at || addDays(TODAY, -ri(5, 60)); s.comment = s.comment || '同意。'; });
    const t = proj ? JSON.parse(proj.team_json) : {};
    ins.appr.run(type, title, proj ? proj.id : null, t.owner || '林晚晴', proj ? proj.lead_unit_id : 1, addDays(TODAY, -createdDaysAgo), status, currentIdx, JSON.stringify(steps), JSON.stringify(payload));
  }

  // 在途（构造给各角色的待办）
  approval('declaration', '「机载激光雷达晴空湍流探测技术」MJKY 建议书申报审签', '机载激光雷达晴空湍流探测技术', 7, { materials: ['建议书', '建议书意见'] });          // 当前:一级总师(陈铁军)
  approval('declaration', '「民机噪声适航符合性预测技术」04专项接续 建议书申报审签', '民机噪声适航符合性预测技术', 7, { materials: ['建议书', '建议书意见'] });        // 当前:一级总师
  approval('acceptance', '「复合材料机翼损伤容限评估技术」公司级验收申请', '复合材料机翼损伤容限评估技术', 2, { level: '公司级' });                                     // 当前:责任总师技术复核
  approval('filing', '「智能蒙皮与形变感知技术」立项备案', '智能蒙皮与形变感知技术', 2, { materials: ['任务清单', '任务书(盖章版)'] });                                  // 当前:总部备案(王建国)
  approval('change', '「氢电飞机验证机研制」里程碑延期变更（机体制造 +90天）', '氢电飞机验证机研制', 2, { category: '延期', delta: '+90天', target: '完成机体制造' });   // 当前:总部终审
  approval('package', '「客舱声品质设计方法成果包」转化备案', '客舱降噪与声品质设计技术', 2, { package: 'CG-2026-003' });                                              // 当前:总部备案
  approval('acceptance', '「起落架健康监测与预测性维护」公司级验收申请', '起落架健康监测与预测性维护', 3, { level: '公司级' });                                          // 当前:总部终审
  approval('data_change', '「高原机场起降性能拓展研究」年度任务填报数据修正', '高原机场起降性能拓展研究', 2, { field: '年度目标', from: '完成3个机场试飞', to: '完成2个机场试飞+1个仿真评估' }); // 当前:总部科技主管
  approval('declaration', '「拉挤成型复材长桁产业化技术」材料联盟申报审签', '拉挤成型复材长桁产业化技术', 4, { materials: ['项目申请书'] });                            // 当前:单位财务部门负责人(上飞公司→赵美玲侧)
  approval('plan_finish', '「飞控系统多余度架构优化技术」计划办结申请（Q2 进展报告）', '飞控系统多余度架构优化技术', 1, { plan: '完成季度进展报告填报' });                 // 当前:二级单位管理团队
  approval('milestone_close', '「智能座舱人机交互技术研究」里程碑销项材料核验', '智能座舱人机交互技术研究', 1, { milestone: '完成原理样机制造' });
  approval('evaluation', '「结冰风洞试验技术」协作单位评价确认', '结冰风洞试验技术与相似准则研究', 1, {});
  // 已办结历史
  approval('declaration', '「复材回收再利用技术研究」预研滚动计划申报审签', '复材回收再利用技术研究', 9, {}, '已通过', 220);
  approval('acceptance', '「民机市场需求预测模型研究」验收申请', '民机市场需求预测模型研究', 4, {}, '已通过', 300);
  approval('change', '「民机健康管理(PHM)大数据平台」外协单位更换变更', '民机健康管理(PHM)大数据平台', 3, { category: '外协方' }, '已通过', 120);
  approval('filing', '「数字风洞云展示平台」科技周立项备案', '数字风洞云展示平台', 3, {}, '已通过', 30);
  approval('declaration', '「民机电动滑行系统可行性研究」揭榜挂帅申报审签', '民机电动滑行系统可行性研究', 9, {}, '已通过', 700);

  // ---------- 变更台账 ----------
  const chgRows = [
    ['氢电飞机验证机研制', '项目变更', '延期', '「完成机体制造」里程碑由 2026-12 调整至 2027-03', '氢储罐供应商交付延迟，影响机体总装', '审批中'],
    ['民机健康管理(PHM)大数据平台', '项目变更', '外协方', '数据标注外协由 A 公司变更为 B 公司', '原外协单位产能不足，进度连续两月滞后', '已通过'],
    ['高原机场起降性能拓展研究', '数据变更', '数据修正', '年度任务填报口径修正', '填报口径误将仿真评估计入试飞架次', '审批中'],
    ['复合材料机翼损伤容限评估技术', '项目变更', '经费', '2025 年度预算科目间调剂 180 万元', '试验件复验增加检测费支出', '已通过'],
  ];
  for (const [pn, kind, cat, det, reason, st] of chgRows) {
    const proj = projByName[pn];
    if (proj) ins.chg.run(proj.id, kind, cat, det, reason, st, addDays(TODAY, -ri(5, 90)));
  }

  // ---------- 文档归档 ----------
  const projAll = db.prepare('SELECT p.*, c.declare_json, c.filing_json FROM projects p JOIN channels c ON c.id=p.channel_id').all();
  for (const p of projAll) {
    const t = JSON.parse(p.team_json);
    const dec = JSON.parse(p.declare_json);
    const fil = JSON.parse(p.filing_json);
    for (const m of dec) ins.doc.run(p.id, '申报', `${m}.pdf`, addDays(p.start, -ri(20, 60)), t.owner, ri(800, 6000));
    if (p.status !== '申报中') for (const m of fil) ins.doc.run(p.id, '立项', `${m}(盖章版).pdf`, addDays(p.start, -ri(1, 15)), t.owner, ri(500, 3000));
    if (['实施中', '验收中', '已验收'].includes(p.status)) {
      ins.doc.run(p.id, '实施', '年度里程碑清单.xlsx', `${THIS_YEAR}-03-${String(ri(10, 28)).padStart(2, '0')}`, t.pm, ri(60, 300));
      ins.doc.run(p.id, '实施', '中期评估报告.pdf', addDays(TODAY, -ri(60, 300)), t.owner, ri(2000, 9000));
    }
    if (['验收中', '已验收'].includes(p.status)) {
      ins.doc.run(p.id, '验收', '验收申请书.pdf', addDays(TODAY, -ri(20, 200)), t.owner, ri(900, 4000));
      ins.doc.run(p.id, '验收', '成果汇编.pdf', addDays(TODAY, -ri(10, 150)), t.tech, ri(5000, 20000));
    }
  }

  // ---------- 总部经费拨付 ----------
  ins.pool.run(THIS_YEAR, 52000, '年度科研经费总盘子（经总部管理层审批锁定）');
  ins.pool.run(THIS_YEAR - 1, 47000, '上年度清算完成');
  const quotas = [[1, 15600, 9800], [2, 12400, 7300], [3, 9800, 6100], [4, 2400, 1100], [5, 6200, 3900], [6, 3600, 2200]];
  for (const [u, q, paid] of quotas) ins.quota.run(THIS_YEAR, u, q, paid);
  ins.freq.run(THIS_YEAR, 1, 3200, '三季度里程碑节点经费（复材损伤容限、层流验证等 6 项）', '待审批', addDays(TODAY, -6), null);
  ins.freq.run(THIS_YEAR, 3, 1800, '氢电验证机机体制造专项拨付', '待审批', addDays(TODAY, -3), null);
  ins.freq.run(THIS_YEAR, 2, 2600, '二季度批量拨付（增材钛框、静力测控等 4 项）', '已拨付', addDays(TODAY, -55), addDays(TODAY, -48));
  ins.freq.run(THIS_YEAR, 5, 1500, '试飞数据中心设备购置', '已拨付', addDays(TODAY, -80), addDays(TODAY, -70));
  ins.freq.run(THIS_YEAR, 4, 900, 'PHM 平台试点运行经费', '已驳回', addDays(TODAY, -30), addDays(TODAY, -26));
  ins.freq.run(THIS_YEAR, 6, 1200, '高温树脂中试线改造', '已拨付', addDays(TODAY, -100), addDays(TODAY, -92));

  // ---------- 预警 ----------
  const msRows = db.prepare('SELECT m.*, p.name pname FROM milestones m JOIN projects p ON p.id=m.project_id').all();
  for (const m of msRows) {
    const c = statusColor(m.due, m.done_at, TODAY);
    if (c === 'red') ins.alert.run(m.project_id, '里程碑', 'red', `【逾期告警】${m.pname}：「${m.title}」已超期`, m.due, m.due, '站内,邮箱,蓝信', 0);
    else if (c === 'yellow') ins.alert.run(m.project_id, '里程碑', 'yellow', `【临期预警】${m.pname}：「${m.title}」距到期不足30天`, m.due, addDays(m.due, -30), '站内,邮箱,蓝信', 0);
  }
  const delRows = db.prepare('SELECT d.*, p.name pname FROM deliverables d JOIN projects p ON p.id=d.project_id').all();
  for (const dRow of delRows) {
    const c = statusColor(dRow.due, dRow.delivered_at, TODAY);
    if (c === 'red') ins.alert.run(dRow.project_id, '交付物', 'red', `【逾期告警】${dRow.pname}：交付物「${dRow.name}」逾期未交付`, dRow.due, dRow.due, '站内,邮箱,蓝信', 0);
    else if (c === 'yellow') ins.alert.run(dRow.project_id, '交付物', 'yellow', `【临期预警】${dRow.pname}：交付物「${dRow.name}」临近交付期限`, dRow.due, addDays(dRow.due, -30), '站内,邮箱', 0);
  }
  const pkgRed = db.prepare("SELECT k.*, p.name pname FROM packages k JOIN projects p ON p.id=k.project_id WHERE k.status NOT IN ('已完成')").all();
  for (const k of pkgRed) {
    const c = statusColor(k.plan_date, k.actual_date, TODAY);
    if (c === 'red') ins.alert.run(k.project_id, '成果转化', 'red', `【逾期告警】成果包「${k.name}」超过计划转化时间未完成`, k.plan_date, k.plan_date, '站内,邮箱', 0);
    else if (c === 'yellow') ins.alert.run(k.project_id, '成果转化', 'yellow', `【临期预警】成果包「${k.name}」临近计划转化时间`, k.plan_date, addDays(k.plan_date, -30), '站内', 0);
  }
  ins.alert.run(projByName['民机健康管理(PHM)大数据平台'].id, '经费', 'yellow', '【经费预警】PHM 大数据平台：年度执行率 38%，低于时序进度基准', null, addDays(TODAY, -5), '站内,邮箱', 0);

  // ---------- 表单维护：项目类型分工备注（已取消类型主管登录账号，仅保留名称备忘） ----------
  const insTypeOwner = db.prepare(`INSERT INTO transition_type_owners
    (project_type, owner_user_id, owner_name, can_import, can_export)
    VALUES (?,?,?,?,1)`);
  for (const group of FORM_TYPE_OWNER_MAP) {
    for (const projectType of group.types) {
      insTypeOwner.run(projectType, '', group.name, 1);
    }
  }

  // ---------- 表单维护：总部层级渠道专员授权 ----------
  const insChOwner = db.prepare(`INSERT INTO transition_channel_owners
    (source_channel, owner_user_id, owner_name, can_import, can_export)
    VALUES (?,?,?,?,1)`);
  for (const group of FORM_CHANNEL_OWNER_MAP) {
    for (const ch of group.channels) {
      insChOwner.run(ch, group.userId, group.name, 1);
    }
  }

  // ---------- 审计日志 ----------
  const AUD = [
    ['林晚晴', '提交申报', '机载激光雷达晴空湍流探测技术', '提交 MJKY 建议书申报审签流程'],
    ['王建国', '审批通过', '数字风洞云展示平台', '科技周立项备案办结'],
    ['系统', '自动预警', '机翼自然层流减阻设计验证', '「层流机翼设计准则」交付物逾期，触发红色告警'],
    ['赵美玲', '经费核销', '增材制造钛合金主承力框应用研究', '核销 2026 年二季度支出 412.6 万元'],
    ['陈铁军', '技术复核', '民机驾驶舱单一飞行员运行研究', '任务书技术路线复核通过'],
    ['系统', 'CMOS同步', '全平台', '同步 CMOS 计划 37 条，更新完成状态 12 条'],
    ['方致远', '初审通过', '复合材料机翼损伤容限评估技术', '公司级验收申请单位初审通过'],
    ['系统超级管理员', '字典维护', '渠道字典', '新增渠道「重大科技创新专项」编码 ZDKC'],
    ['汪听澜', '评价确认', '高速数据总线国产化验证', '确认华东软件测评中心评价结果：不合格(58分)'],
    ['王建国', '黑名单', '华东软件测评中心', '按程序协调法律部门，纳入协作单位黑名单'],
    ['系统', '自动归集', '项目台账', '台账字段随「氢电飞机验证机研制」里程碑填报自动更新'],
    ['金世安', '经费拨付', '试飞中心', '拨付试飞数据中心设备购置经费 1500 万元'],
    ['王建国', '表单分发', '专项分表', '按项目类型拆分并授权 7 名项目类型主管维护分表'],
    ['顾言蹊', '分表维护', 'MJKY', '登录维护本人负责专项分表，变更已留痕'],
  ];
  AUD.forEach((a, i) => ins.audit.run(addDays(TODAY, -(i * 2 + 1)) + ` ${String(ri(8, 18)).padStart(2, '0')}:${String(ri(10, 59))}:00`, a[0], a[1], a[2], a[3]));
})();

ensureAuthAccounts(db);

// ---------- 汇总输出 ----------
const count = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
const tables = ['units', 'channels', 'users', 'projects', 'milestones', 'plans', 'funds', 'deliverables', 'packages', 'collaborators', 'post_evals', 'approvals', 'changes', 'documents', 'alerts', 'audit', 'funding_quota', 'funding_requests'];
console.log(`✔ 种子数据已生成 @ ${DB_PATH}（今日锚点 ${TODAY}）`);
for (const t of tables) console.log(`  ${t.padEnd(18)} ${count(t)}`);
const colors = { red: 0, yellow: 0, blue: 0, green: 0 };
for (const m of db.prepare('SELECT due, done_at FROM milestones').all()) colors[statusColor(m.due, m.done_at, TODAY)]++;
console.log('  里程碑四色分布  ', JSON.stringify(colors));
db.close();
