import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANDIDATE_PATHS = [
  join(__dirname, '..', 'config', 'cascade-level-channel-office-type.json'),
  join(__dirname, '..', '..', 'doc', 'cascade-level-channel-office-type.json'),
];

function unique(list) {
  return [...new Set((list || []).filter(Boolean))];
}

function treeToPaths(tree, levels) {
  const paths = [];
  for (const level of levels) {
    const sources = tree?.[level] || {};
    for (const [sourceChannel, offices] of Object.entries(sources)) {
      for (const [orgOffice, types] of Object.entries(offices || {})) {
        for (const projectType of types || []) {
          paths.push({ level, sourceChannel, orgOffice, projectType });
        }
      }
    }
  }
  return paths;
}

function pathsToTree(paths) {
  const tree = {};
  for (const p of paths) {
    if (!p?.level || !p?.sourceChannel || !p?.orgOffice || !p?.projectType) continue;
    tree[p.level] ||= {};
    tree[p.level][p.sourceChannel] ||= {};
    tree[p.level][p.sourceChannel][p.orgOffice] ||= [];
    if (!tree[p.level][p.sourceChannel][p.orgOffice].includes(p.projectType)) {
      tree[p.level][p.sourceChannel][p.orgOffice].push(p.projectType);
    }
  }
  return tree;
}

function loadCascadeFile() {
  for (const file of CANDIDATE_PATHS) {
    if (!existsSync(file)) continue;
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const levels = Array.isArray(raw.levels) && raw.levels.length
      ? raw.levels
      : ['国家级', '地方级', '公司级'];
    let paths = Array.isArray(raw.paths) ? raw.paths.filter((p) => p?.projectType) : [];
    let tree = raw.tree && typeof raw.tree === 'object' ? raw.tree : null;
    if (!paths.length && tree) paths = treeToPaths(tree, levels);
    if (!tree && paths.length) tree = pathsToTree(paths);
    if (!paths.length) throw new Error(`级联配置无有效 paths/tree: ${file}`);
    return {
      file,
      version: raw.version || '1.0.0',
      updated: raw.updated || '',
      rules: raw.rules || {},
      levels,
      tree,
      paths,
    };
  }
  throw new Error(`未找到级联配置文件，已尝试：${CANDIDATE_PATHS.join(' | ')}`);
}

/** 构建运行时索引（可被 api / 前端 cascade 契约复用） */
export function buildCascadeIndexes(config) {
  const levels = config.levels.slice();
  const tree = config.tree || pathsToTree(config.paths);
  const paths = config.paths?.length ? config.paths : treeToPaths(tree, levels);

  const sourcesByLevel = {};
  const typesByLevel = {};
  const typesByLevelSource = {};
  const officesByLevelSource = {};
  const typesByLevelSourceOffice = {};
  const officeByType = {};
  const pathByType = {};

  for (const level of levels) {
    const sourceMap = tree[level] || {};
    const sources = Object.keys(sourceMap);
    sourcesByLevel[level] = sources;
    typesByLevel[level] = [];
    typesByLevelSource[level] = {};
    officesByLevelSource[level] = {};
    typesByLevelSourceOffice[level] = {};

    for (const source of sources) {
      const officeMap = sourceMap[source] || {};
      const offices = Object.keys(officeMap);
      officesByLevelSource[level][source] = offices;
      typesByLevelSourceOffice[level][source] = {};
      const sourceTypes = [];
      for (const office of offices) {
        const types = unique(officeMap[office]);
        typesByLevelSourceOffice[level][source][office] = types;
        for (const t of types) {
          if (!sourceTypes.includes(t)) sourceTypes.push(t);
          if (!typesByLevel[level].includes(t)) typesByLevel[level].push(t);
          if (!officeByType[t]) officeByType[t] = { level, source, office };
          if (!pathByType[t]) {
            pathByType[t] = {
              level,
              sourceChannel: source,
              orgOffice: office,
              projectType: t,
            };
          }
        }
      }
      typesByLevelSource[level][source] = sourceTypes;
    }
  }

  return {
    version: config.version,
    updated: config.updated,
    rules: config.rules,
    sourceFile: config.file,
    levels,
    tree,
    paths,
    sourcesByLevel,
    typesByLevel,
    typesByLevelSource,
    officesByLevelSource,
    typesByLevelSourceOffice,
    officeByType,
    pathByType,
  };
}

let cached = null;

export function getCascadeConfig(forceReload = false) {
  if (!cached || forceReload) {
    cached = buildCascadeIndexes(loadCascadeFile());
  }
  return cached;
}

export function getOfficeTree() {
  return getCascadeConfig().tree;
}

export function resolveOfficeByProjectType(projectType) {
  const key = String(projectType || '').trim();
  if (!key) return null;
  const hit = getCascadeConfig().pathByType[key];
  if (!hit) return null;
  return { level: hit.level, source: hit.sourceChannel, office: hit.orgOffice };
}
