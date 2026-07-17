import type { TransitionCascade } from '../api/types'

export type CascadePartial = {
  level?: string
  sourceChannel?: string
  orgOffice?: string
  projectType?: string
}

export type CascadeResolveResult = {
  next: Required<CascadePartial>
  options: {
    levels: string[]
    sources: string[]
    offices: string[]
    types: string[]
  }
  valid: boolean
  issues: string[]
}

type CascadePath = {
  level: string
  sourceChannel: string
  orgOffice: string
  projectType: string
}

function unique(list: string[]) {
  return [...new Set(list.filter(Boolean))]
}

/** 从 cascade 索引展开为路径表（优先用服务端 paths） */
export function flattenCascadePaths(cascade: TransitionCascade): CascadePath[] {
  if (cascade.paths?.length) {
    return cascade.paths.filter((p) => p.level && p.sourceChannel && p.projectType)
  }
  const out: CascadePath[] = []
  const treeLevels = cascade.levels || []
  for (const level of treeLevels) {
    const bySource = cascade.typesByLevelSourceOffice?.[level] || {}
    for (const [sourceChannel, byOffice] of Object.entries(bySource)) {
      for (const [orgOffice, types] of Object.entries(byOffice || {})) {
        for (const projectType of types || []) {
          out.push({ level, sourceChannel, orgOffice, projectType })
        }
      }
    }
  }
  return out
}

function pathByTypeMap(cascade: TransitionCascade, paths: CascadePath[]) {
  const map: Record<string, CascadePath> = { ...(cascade.pathByType || {}) }
  for (const p of paths) {
    if (!map[p.projectType]) map[p.projectType] = p
  }
  return map
}

/**
 * 双向级联：
 * - 正向：改上层时，不兼容的下游立即清空（即使当前交集为空）
 * - 反向：改类型时唯一路径满回填；渠道/司局仅在上层为空时回填
 */
export function resolveCascade(
  cascade: TransitionCascade,
  partial: CascadePartial,
  opts?: {
    mode?: 'filter' | 'edit'
    driver?: 'level' | 'sourceChannel' | 'orgOffice' | 'projectType' | ''
    reverseBackfill?: boolean
    forwardClear?: boolean
    allSources?: string[]
    allTypes?: string[]
  },
): CascadeResolveResult {
  const reverseBackfill = opts?.reverseBackfill !== false
  const forwardClear = opts?.forwardClear !== false
  const driver = opts?.driver || ''
  const paths = flattenCascadePaths(cascade)
  const byType = pathByTypeMap(cascade, paths)
  const issues: string[] = []

  let level = partial.level || ''
  let sourceChannel = partial.sourceChannel || ''
  let orgOffice = partial.orgOffice || ''
  let projectType = partial.projectType || ''

  // 1) 类型驱动：强制按唯一路径回填上层
  if (driver === 'projectType' && reverseBackfill && projectType && byType[projectType]) {
    const hit = byType[projectType]
    level = hit.level
    sourceChannel = hit.sourceChannel
    orgOffice = hit.orgOffice
  }

  // 2) 正向：按「层级 → 渠道 → 司局 → 类型」逐级校验，不兼容则清空下游
  //    关键点：交集为空时也必须清空非法下游（修复「再选国家级无效」）
  if (forwardClear || driver === 'level' || driver === 'sourceChannel' || driver === 'orgOffice') {
    if (level && !paths.some((p) => p.level === level)) {
      level = ''
      issues.push('层级不在级联配置中，已清空')
    }

    if (sourceChannel) {
      const channelOk = paths.some((p) => (!level || p.level === level) && p.sourceChannel === sourceChannel)
      if (!channelOk) {
        sourceChannel = ''
        orgOffice = ''
        projectType = ''
        issues.push('渠道与当前层级不兼容，已清空下游')
      }
    }

    if (orgOffice) {
      const officeOk = paths.some((p) =>
        (!level || p.level === level)
        && (!sourceChannel || p.sourceChannel === sourceChannel)
        && p.orgOffice === orgOffice)
      if (!officeOk) {
        orgOffice = ''
        projectType = ''
        issues.push('司局/处室与当前层级·渠道不兼容，已清空类型')
      }
    }

    if (projectType && driver !== 'projectType') {
      const typeOk = paths.some((p) =>
        (!level || p.level === level)
        && (!sourceChannel || p.sourceChannel === sourceChannel)
        && (!orgOffice || p.orgOffice === orgOffice)
        && p.projectType === projectType)
      if (!typeOk) {
        projectType = ''
        issues.push('项目类型与当前上层选择不兼容，已清空')
      }
    }
  }

  // 3) 非类型驱动时：若类型与上层兼容可做弱回填；冲突则保留上层（上面已清类型）
  if (driver !== 'projectType' && reverseBackfill && projectType && byType[projectType]) {
    const hit = byType[projectType]
    const conflict =
      (level && level !== hit.level)
      || (sourceChannel && sourceChannel !== hit.sourceChannel)
      || (orgOffice && orgOffice !== hit.orgOffice)
    if (!conflict) {
      if (!level) level = hit.level
      if (!sourceChannel) sourceChannel = hit.sourceChannel
      if (!orgOffice) orgOffice = hit.orgOffice
    }
  }

  // 4) 空上层时：由渠道/司局唯一反推
  if (reverseBackfill && sourceChannel && !level) {
    const levels = unique(paths.filter((p) => p.sourceChannel === sourceChannel).map((p) => p.level))
    if (levels.length === 1) level = levels[0]
  }
  if (reverseBackfill && orgOffice && (!sourceChannel || !level)) {
    const pool = paths.filter((p) =>
      p.orgOffice === orgOffice
      && (!level || p.level === level)
      && (!sourceChannel || p.sourceChannel === sourceChannel))
    const levels = unique(pool.map((p) => p.level))
    const sources = unique(pool.map((p) => p.sourceChannel))
    if (!level && levels.length === 1) level = levels[0]
    if (!sourceChannel && sources.length === 1) sourceChannel = sources[0]
  }

  // 5) 选项投影
  const allLevels = cascade.levels?.length ? cascade.levels : unique(paths.map((p) => p.level))
  const sourcePool = level ? paths.filter((p) => p.level === level) : paths
  let sources = unique(sourcePool.map((p) => p.sourceChannel))
  if (opts?.allSources?.length) {
    sources = sources.filter((s) => opts.allSources!.includes(s))
    // 配置有但字典暂无时仍保留配置渠道，避免选项为空
    if (!sources.length) sources = unique(sourcePool.map((p) => p.sourceChannel))
  }

  const officePool = paths.filter((p) => {
    if (level && p.level !== level) return false
    if (sourceChannel && p.sourceChannel !== sourceChannel) return false
    return true
  })
  const offices = unique(officePool.map((p) => p.orgOffice))

  const typePool = paths.filter((p) => {
    if (level && p.level !== level) return false
    if (sourceChannel && p.sourceChannel !== sourceChannel) return false
    if (orgOffice && p.orgOffice !== orgOffice) return false
    return true
  })
  let types = unique(typePool.map((p) => p.projectType))
  if (!types.length && opts?.allTypes?.length) {
    types = level && cascade.typesByLevel?.[level]?.length
      ? cascade.typesByLevel[level]
      : opts.allTypes
  }

  // 编辑态：上层收窄后仅剩唯一类型时可回填
  if (opts?.mode === 'edit' && reverseBackfill && !projectType && types.length === 1) {
    projectType = types[0]
    const hit = byType[projectType]
    if (hit) {
      if (!orgOffice) orgOffice = hit.orgOffice
      if (!sourceChannel) sourceChannel = hit.sourceChannel
      if (!level) level = hit.level
    }
  }

  const next = { level, sourceChannel, orgOffice, projectType }
  const valid = !level && !sourceChannel && !orgOffice && !projectType
    ? true
    : paths.some((p) =>
      (!level || p.level === level)
      && (!sourceChannel || p.sourceChannel === sourceChannel)
      && (!orgOffice || p.orgOffice === orgOffice)
      && (!projectType || p.projectType === projectType))

  return {
    next,
    options: {
      levels: allLevels,
      sources,
      offices,
      types,
    },
    valid,
    issues,
  }
}

export function resolveOrgOfficeFromCascade(
  cascade: TransitionCascade,
  row: { orgOffice?: string; projectType?: string; sourceSheet?: string },
) {
  if (row.orgOffice) return row.orgOffice
  const type = row.projectType || row.sourceSheet || ''
  return cascade.pathByType?.[type]?.orgOffice || cascade.officeByType?.[type]?.office || ''
}
