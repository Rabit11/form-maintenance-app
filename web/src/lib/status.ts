export type Four = 'red' | 'yellow' | 'blue' | 'green'

export const FOUR_HEX: Record<Four, string> = {
  red: '#F87171',
  yellow: '#FBBF24',
  blue: '#38BDF8',
  green: '#34D399',
}

export const FOUR_LABEL: Record<Four, string> = {
  red: '逾期告警',
  yellow: '临期预警',
  blue: '正常推进',
  green: '已完成',
}

export const FOUR_SHORT: Record<Four, string> = { red: '红', yellow: '黄', blue: '蓝', green: '绿' }

export const PROJ_STATUS_COLOR: Record<string, string> = {
  申报中: '#A78BFA',
  立项中: '#38BDF8',
  实施中: '#38BDF8',
  验收中: '#FBBF24',
  已验收: '#34D399',
  已终止: '#64748B',
}

export const LEVEL_ORDER = ['国家级', '地方级', '公司级']
