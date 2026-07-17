# -*- coding: utf-8 -*-
"""综合 V19 分类表 + 预先研究项目信息-表头，生成层级级联字典 Excel。"""
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

sys.stdout.reconfigure(encoding='utf-8')

DOC = Path(__file__).resolve().parent
out = DOC / '表单维护工具-层级级联字典-V19.xlsx'

# ========== V19 分类全表（与需求截图一致）==========
v19_channels = [
    # level, 部委委局, 司局处室, 内部管理部门, 内部管理处室, 渠道编码, 渠道名称
    ('国家级', 'GXB', '装备二司', '科技部', '科研项目处', 'MJKY', 'MJKY'),
    ('国家级', 'GXB', '装备一司', '科技部', '科研项目处', 'ZX04', '04专项接续'),
    ('国家级', 'GXB', '高新技术司', '科技部', '科研项目处', 'ZDYF', '重点研发计划'),
    ('国家级', '国资委', '科技创新局', '科技部', '科研项目处', 'XX25', 'XX25专项'),
    ('国家级', '科学技术部', '国自然', '科技部', '科研项目处', 'NSFC', '国家自然科学基金'),
    ('国家级', 'FGW', '高技术司', '科技部', '科研项目处', 'FGW', 'FGW GXJC项目'),
    ('地方级', '上海市科委', '空天海洋处', '科技部', '科研项目处', 'JBGS', '上海市科技攻关揭榜挂帅'),
    ('地方级', '上海市科委', '空天海洋处', '科技部', '科研项目处', 'SHKC', '上海市科技创新行动计划'),
    ('公司级', '科技部', '科研项目处', '科技部', '科研项目处', 'YYGD', '预研三年滚动计划'),
    ('公司级', '科技部', '科研项目处', '科技部', '科研项目处', 'ZDKC', '重大科技创新专项'),
    ('公司级', '科技部', '科研项目处', '科技部', '科研项目处', 'XJQX', '新疆大飞机气象创新中心'),
    ('公司级', '科技部', '科技发展处', '科技部', '科技发展处', 'KJZ', '科技周'),
    ('公司级', '科技部', '科技发展处', '科技部', '科技发展处', 'DFY', '大飞机研究院'),
    ('公司级', '科技部', '技术基础处', '科技部', '技术基础处', 'CLLM', '大飞机先进材料创新联盟'),
    ('公司级', '科技部', '科研项目处', '科技部', '科研项目处', 'BOEING', '“中国商飞-波音”可持续航空技术研究中心项目'),
]

# 表头 sheet4!F1:F5 项目来源/渠道简称
source_by_code = {
    'MJKY': '工信部', 'ZX04': '工信部', 'XX25': '工信部',
    'ZDYF': '科技部', 'NSFC': '科技部',
    'FGW': '发改委',
    'JBGS': '市科委', 'SHKC': '市科委',
    'YYGD': 'ZGSF', 'ZDKC': 'ZGSF', 'XJQX': 'ZGSF', 'KJZ': 'ZGSF',
    'DFY': 'ZGSF', 'CLLM': 'ZGSF', 'BOEING': 'ZGSF',
}

# V19 渠道 → 表头「项目类型」sheet4!A（含一对多拆分）
type_map = {
    'MJKY': ['MJKY'],
    'ZX04': ['国家科技重大专项--04专项'],
    'ZDYF': ['下一代国家重点研发计划'],
    'XX25': ['1025'],
    'NSFC': ['大飞机基础研究联合基金'],
    'FGW': ['FGW第一批GXJC项目'],
    'JBGS': ['上海市科技攻关揭榜挂帅'],
    'SHKC': ['上海市科委、经信委项目'],
    'YYGD': ['预研三年'],
    'ZDKC': ['重大科技创新'],
    'XJQX': ['新疆气象中心项目'],
    'KJZ': ['科技周'],
    'DFY': [
        '大飞机研究院-南航', '大飞机研究院-西工', '大飞机研究院-同济',
        '大飞机研究院-上海交大', '大飞机研究院-北航', '大飞机研究院-重庆大学',
        '大飞机研究院-香港理工', '大飞机研究院-中国民航大学',
    ],
    'CLLM': ['大飞机先进材料创新联盟'],
    'BOEING': ['波音合作'],
}

orphan_types = [
    dict(项目类型='实验室', 建议项目层级='公司级', 建议项目来源渠道='ZGSF', 建议挂靠V19渠道='待确认',
         说明='表头sheet4有，V19分类表无对应渠道名称'),
    dict(项目类型='科技委技术发展课题', 建议项目层级='公司级', 建议项目来源渠道='ZGSF', 建议挂靠V19渠道='待确认',
         说明='表头sheet4有，V19分类表无对应渠道名称'),
    dict(项目类型='KT', 建议项目层级='待确认', 建议项目来源渠道='待确认', 建议挂靠V19渠道='待确认',
         说明='表头sheet4有，含义待业务确认'),
    dict(项目类型='新材料2030专项', 建议项目层级='国家级', 建议项目来源渠道='科技部', 建议挂靠V19渠道='待确认',
         说明='表头sheet4有，V19分类表无对应渠道名称'),
    dict(项目类型='高质量专项', 建议项目层级='待确认', 建议项目来源渠道='待确认', 建议挂靠V19渠道='待确认',
         说明='表头sheet4有，含义待业务确认'),
    dict(项目类型='XP', 建议项目层级='待确认', 建议项目来源渠道='待确认', 建议挂靠V19渠道='待确认',
         说明='表头sheet4有，含义待业务确认'),
]

overview = pd.DataFrame([
    dict(筛选字段='级别', 数据来源='表头主表列B下拉 + V19项目层级', 级联上级='—',
         级联下级='项目来源/渠道、项目类型', 说明='国家级 / 地方级 / 公司级'),
    dict(筛选字段='项目来源/渠道', 数据来源='表头sheet4!F1:F5', 级联上级='级别',
         级联下级='项目类型', 说明='工信部 / 市科委 / 发改委 / ZGSF / 科技部'),
    dict(筛选字段='项目类型', 数据来源='表头sheet4!A列专项名称', 级联上级='级别 + 项目来源/渠道',
         级联下级='分表拆分', 说明='表单维护按D列项目类型拆分分表；与V19渠道名称有别名映射'),
    dict(筛选字段='一级专业', 数据来源='表头「一级专业」工作表', 级联上级='—',
         级联下级='二级专业', 说明='10~80'),
    dict(筛选字段='二级专业', 数据来源='表头「二级专业」工作表', 级联上级='一级专业',
         级联下级='—', 说明='编码前两位对应一级专业'),
    dict(筛选字段='项目状态/验收状态等', 数据来源='表头填写说明', 级联上级='无',
         级联下级='无', 说明='独立维度，不随层级级联'),
])

rows_v19 = []
for lv, buwei, sijiu, dept, office, code, name in v19_channels:
    rows_v19.append(dict(
        项目层级=lv,
        渠道部门_部委委局=buwei,
        渠道部门_司局处室=sijiu,
        内部管理_部门=dept,
        内部管理_处室=office,
        渠道编码=code,
        渠道名称=name,
        表头_项目来源渠道=source_by_code[code],
        表头_项目类型_主值=type_map[code][0],
        表头_项目类型_条数=len(type_map[code]),
        备注=(
            'V19渠道部门为国资委，表头「项目来源/渠道」归入工信部' if code == 'XX25'
            else 'V19渠道部门为GXB·高新技术司，表头「项目来源/渠道」归入科技部' if code == 'ZDYF'
            else ''
        ),
    ))
df_v19 = pd.DataFrame(rows_v19)

rows_cascade = []
order = 0
for lv, buwei, sijiu, dept, office, code, name in v19_channels:
    src = source_by_code[code]
    aliases = type_map[code]
    for ptype in aliases:
        order += 1
        if len(aliases) > 1:
            relation = '一对多-主类型' if ptype == aliases[0] else '一对多-扩展类型'
        elif ptype != name:
            relation = '别名映射（V19渠道名≠表头项目类型）'
        else:
            relation = '同名映射'
        rows_cascade.append(dict(
            序号=order,
            级别=lv,
            项目来源渠道=src,
            项目类型=ptype,
            V19_渠道编码=code,
            V19_渠道名称=name,
            V19_部委委局=buwei,
            V19_司局处室=sijiu,
            V19_内部管理处室=office,
            映射关系=relation,
        ))
df_cascade = pd.DataFrame(rows_cascade)

cnt = defaultdict(set)
for lv, buwei, sijiu, dept, office, code, name in v19_channels:
    cnt[(lv, source_by_code[code])].add(code)
src_level = []
for (lv, src), codes in sorted(cnt.items(), key=lambda x: (['国家级', '地方级', '公司级'].index(x[0][0]), x[0][1])):
    buweis = sorted({b for l, b, s, d, o, c, n in v19_channels if l == lv and source_by_code[c] == src})
    names = [n for l, b, s, d, o, c, n in v19_channels if l == lv and source_by_code[c] == src]
    src_level.append(dict(
        级别=lv,
        项目来源渠道=src,
        渠道数量=len(codes),
        对应V19部委委局='、'.join(buweis),
        对应渠道名称=' / '.join(names),
    ))
df_src = pd.DataFrame(src_level)

alias_pairs = [
    ('预研三年滚动计划', '预研三年', '公司级', 'YYGD'),
    ('重大科技创新专项', '重大科技创新', '公司级', 'ZDKC'),
    ('重点研发计划', '下一代国家重点研发计划', '国家级', 'ZDYF'),
    ('04专项接续', '国家科技重大专项--04专项', '国家级', 'ZX04'),
    ('XX25专项', '1025', '国家级', 'XX25'),
    ('国家自然科学基金', '大飞机基础研究联合基金', '国家级', 'NSFC'),
    ('FGW GXJC项目', 'FGW第一批GXJC项目', '国家级', 'FGW'),
    ('上海市科技创新行动计划', '上海市科委、经信委项目', '地方级', 'SHKC'),
    ('上海市科技攻关揭榜挂帅', '上海市科技攻关揭榜挂帅', '地方级', 'JBGS'),
    ('新疆大飞机气象创新中心', '新疆气象中心项目', '公司级', 'XJQX'),
    ('大飞机研究院', '大飞机研究院-南航（等8校）', '公司级', 'DFY'),
    ('大飞机先进材料创新联盟', '大飞机先进材料创新联盟', '公司级', 'CLLM'),
    ('“中国商飞-波音”可持续航空技术研究中心项目', '波音合作', '公司级', 'BOEING'),
    ('MJKY', 'MJKY', '国家级', 'MJKY'),
    ('科技周', '科技周', '公司级', 'KJZ'),
]
df_alias = pd.DataFrame([
    dict(
        项目层级=lv, V19_渠道编码=code, V19_渠道名称=v19n,
        表头_项目类型=ptype, 表头_项目来源渠道=source_by_code[code],
    )
    for v19n, ptype, lv, code in alias_pairs
])

df_orphan = pd.DataFrame(orphan_types)

majors = [
    ('10', '总体气动', [('1001', '总体与气动'), ('1002', '需求与验证'), ('1003', '适航与四性'), ('1004', '舱室')]),
    ('20', '机体', [('2001', '材料与工艺'), ('2002', '强度'), ('2003', '结构')]),
    ('30', '系统', [
        ('3001', '航电电气'), ('3002', '飞控'), ('3003', '液压起落架刹车'),
        ('3004', '动力机APU'), ('3005', '燃油与防火'), ('3006', '环控与氧气'),
    ]),
    ('40', '制造', [
        ('4001', '系统工艺'), ('4002', '冷工艺技术'), ('4003', '热工艺技术'),
        ('4004', '工艺装备'), ('4005', '增材制造'),
    ]),
    ('50', '复合材料', [('5001', '复合材料设计'), ('5002', '复合材料与工艺')]),
    ('60', '飞行', [
        ('6001', '试飞工程'), ('6002', '试飞测试'), ('6003', '试验飞行'),
        ('6004', '试飞运行与保障技术'), ('6005', '飞机运行安全'),
    ]),
    ('70', '运行支持', [
        ('7001', '运行支援'), ('7002', '维修工程'), ('7003', '飞行运行工程'),
        ('7004', '培训工程'), ('7005', '技术出版物'),
    ]),
    ('80', '通用基础', [
        ('8001', '市场技术'), ('8002', '质量工程'), ('8003', '情报档案'),
        ('8004', '标准化技术'), ('8005', '信息化'), ('8006', '工业工程'),
        ('8007', '5G与人工智能应用'),
    ]),
]
rows_major = []
for c1, n1, children in majors:
    for c2, n2 in children:
        rows_major.append(dict(
            一级专业=f'{c1}-{n1}', 一级编码=c1, 一级名称=n1,
            二级专业=f'{c2}-{n2}', 二级编码=c2, 二级名称=n2,
        ))
df_major = pd.DataFrame(rows_major)

df_other = pd.DataFrame([
    dict(字段='级别', 选项='国家级'), dict(字段='级别', 选项='地方级'), dict(字段='级别', 选项='公司级'),
    dict(字段='项目来源/渠道', 选项='工信部'), dict(字段='项目来源/渠道', 选项='市科委'),
    dict(字段='项目来源/渠道', 选项='发改委'), dict(字段='项目来源/渠道', 选项='ZGSF'),
    dict(字段='项目来源/渠道', 选项='科技部'),
    dict(字段='项目状态', 选项='已完成'), dict(字段='项目状态', 选项='进行中'), dict(字段='项目状态', 选项='延期'),
    dict(字段='验收状态', 选项='单位级验收'), dict(字段='验收状态', 选项='公司级验收'),
    dict(字段='验收状态', 选项='机关验收'), dict(字段='验收状态', 选项='未验收'),
])

df_impl = pd.DataFrame([
    dict(步骤=1, 规则='选「级别」后，过滤「项目来源/渠道」', 依据工作表='3-级别×项目来源',
         示例='国家级 → 工信部、科技部、发改委'),
    dict(步骤=2, 规则='选「级别」+「项目来源/渠道」后，过滤「项目类型」', 依据工作表='2-级别×来源×类型',
         示例='国家级+工信部 → MJKY、国家科技重大专项--04专项、1025'),
    dict(步骤=3, 规则='仅选「级别」时，「项目类型」展示该级别下全部类型', 依据工作表='2-级别×来源×类型',
         示例='地方级 → 揭榜挂帅、上海市科委经信委项目'),
    dict(步骤=4, 规则='切换上级选项时，若下级已选值不在新集合内则清空', 依据工作表='2-级别×来源×类型',
         示例='国家级→公司级 时清空已选的 MJKY'),
    dict(步骤=5, 规则='选「一级专业」后，二级仅保留前缀匹配项', 依据工作表='6-一级×二级专业',
         示例='10-总体气动 → 1001~1004'),
    dict(步骤=6, 规则='V19渠道名称与表头项目类型通过别名对齐', 依据工作表='4-V19与表头别名',
         示例='XX25专项 ↔ 1025'),
    dict(步骤=7, 规则='表头有而V19无的专项暂不进入正式级联，放入待归类', 依据工作表='5-待归类专项',
         示例='KT / XP / 实验室'),
])

df_summary = pd.DataFrame([
    dict(维度='V19渠道', 数量=len(v19_channels), 明细='国家级6 + 地方级2 + 公司级7'),
    dict(维度='表头项目来源/渠道', 数量=5, 明细='工信部、市科委、发改委、ZGSF、科技部'),
    dict(维度='已映射项目类型', 数量=len(df_cascade), 明细='含大飞机研究院8校拆分'),
    dict(维度='待归类项目类型', 数量=len(df_orphan), 明细='实验室/科技委课题/KT/新材料2030/高质量/XP'),
    dict(维度='一级专业', 数量=8, 明细='10~80'),
    dict(维度='二级专业', 数量=len(df_major), 明细='与表头二级专业表一致'),
])

with pd.ExcelWriter(out, engine='xlsxwriter') as writer:
    book = writer.book
    header_fmt = book.add_format({'bold': True, 'bg_color': '#1F4E79', 'font_color': 'white', 'border': 1})
    wrap = book.add_format({'text_wrap': True, 'valign': 'top'})

    sheets = [
        ('0-级联总览', overview),
        ('1-V19分类全表', df_v19),
        ('2-级别×来源×类型', df_cascade),
        ('3-级别×项目来源', df_src),
        ('4-V19与表头别名', df_alias),
        ('5-待归类专项', df_orphan),
        ('6-一级×二级专业', df_major),
        ('7-独立下拉字典', df_other),
        ('8-实现规则', df_impl),
        ('9-数据量汇总', df_summary),
    ]
    for name, df in sheets:
        df.to_excel(writer, sheet_name=name, index=False)
        ws = writer.sheets[name]
        for i, col in enumerate(df.columns):
            series = df[col].astype(str)
            width = min(52, max(12, int(series.map(len).max()) + 2, len(str(col)) + 2))
            ws.set_column(i, i, width, wrap)
        for col_idx, col_name in enumerate(df.columns):
            ws.write(0, col_idx, col_name, header_fmt)
        ws.freeze_panes(1, 0)
        if len(df):
            ws.autofilter(0, 0, len(df), len(df.columns) - 1)

print('OK ->', out)
print('\n【级别×来源】')
print(df_src.to_string(index=False))
print('\n已映射类型数:', len(df_cascade), '待归类:', len(df_orphan))
print(df_cascade.groupby('级别')['项目类型'].count().to_string())
