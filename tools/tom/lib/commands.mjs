// tom CLI 명령 구현 — 각 명령은 { code, out }을 반환한다 (테스트 용이성)
import fs from 'node:fs'
import path from 'node:path'
import {
  ATOM_TYPE_ORDER,
  STAGES,
  SPEC_STATUSES,
  NAME_RE,
  REQUIRED_SECTIONS,
  PLACEHOLDER,
  nextStage,
  arr,
  str,
} from './schema.mjs'
import { parseSections, isPlaceholder, replaceField } from './frontmatter.mjs'
import { DEFAULT_TOM_YAML, findConfigDir, loadConfig, buildIndex, relPath, findById } from './store.mjs'
import { validate, fixUsedBy } from './validate.mjs'
import { manifestContent } from './manifest.mjs'

function requireIndex(cwd) {
  const configDir = findConfigDir(cwd)
  if (!configDir) {
    throw new Error('tom.yaml을 찾을 수 없습니다. tom.yaml이 있는 디렉터리(예: specs/)에서 실행하거나 tom init을 먼저 실행하세요.')
  }
  return buildIndex(configDir)
}

function toYaml(items) {
  const lines = []
  for (const item of items) {
    const keys = Object.keys(item)
    keys.forEach((key, i) => {
      const value = item[key]
      const prefix = i === 0 ? '- ' : '  '
      if (Array.isArray(value)) {
        if (value.length === 0) lines.push(`${prefix}${key}: []`)
        else {
          lines.push(`${prefix}${key}:`)
          for (const v of value) lines.push(`    - ${v}`)
        }
      } else {
        lines.push(`${prefix}${key}: ${JSON.stringify(value)}`)
      }
    })
  }
  return lines.join('\n')
}

// --- init ---------------------------------------------------------------

export function cmdInit({ cwd, force = false }) {
  const out = []
  const tomYamlPath = path.join(cwd, 'tom.yaml')
  if (!fs.existsSync(tomYamlPath)) {
    fs.writeFileSync(tomYamlPath, DEFAULT_TOM_YAML)
    out.push(`생성: ${tomYamlPath}`)
  } else {
    out.push(`유지: ${tomYamlPath} (이미 존재)`)
  }
  const config = loadConfig(cwd)
  for (const store of config.stores) {
    const root = path.resolve(cwd, store.path)
    for (const type of ATOM_TYPE_ORDER) fs.mkdirSync(path.join(root, type), { recursive: true })
    const manifestPath = path.join(root, 'MANIFEST.md')
    if (!fs.existsSync(manifestPath) || force) {
      fs.writeFileSync(manifestPath, manifestContent())
      out.push(`생성: ${manifestPath}`)
    } else {
      out.push(`유지: ${manifestPath} (재생성은 --force)`)
    }
  }
  for (const specStore of config.specs) {
    fs.mkdirSync(path.resolve(cwd, specStore.path), { recursive: true })
  }
  return { code: 0, out: out.join('\n') }
}

// --- create -------------------------------------------------------------

function atomTemplate(type, id, title) {
  const sections = REQUIRED_SECTIONS[type].map((name) => `## ${name}\n\n${PLACEHOLDER}\n`).join('\n')
  return `---\ntype: ${type}\nid: ${id}\ndescription: ""\nstage: 1\nrefs: []\nused_by: []\n---\n\n# ${title}\n\n${sections}\n<!-- TOM refs -->\n`
}

function specTemplate(id, title) {
  const sections = [...REQUIRED_SECTIONS.spec, 'Ref Implementation Map']
    .map((name) => `## ${name}\n\n${PLACEHOLDER}\n`)
    .join('\n')
  return `---\nid: ${id}\ndescription: ""\nstatus: draft\nrefs: []\n---\n\n# ${title}\n\n${sections}\n<!-- TOM refs -->\n`
}

export function cmdCreate({ cwd, type, name, filename, storeIndex = 0, specIndex = 0 }) {
  if (type !== 'spec' && !ATOM_TYPE_ORDER.includes(type)) {
    return { code: 1, out: `허용되지 않는 타입: ${type} (entity|action|rule|term|spec)` }
  }
  if (!NAME_RE.test(name)) {
    return { code: 1, out: `이름 형식 위반: ${name} (영어 kebab-case: ^[a-z][a-z0-9]*(-[a-z0-9]+)*$)` }
  }
  const index = requireIndex(cwd)
  const id = type === 'spec' ? `spec-${name}` : `${type}-${name}`
  const existing = findById(index, id)
  if (existing) {
    return { code: 1, out: `ID '${id}'가 이미 존재합니다: ${relPath(index, existing.file)}` }
  }
  const base = `${filename ?? name}.md`
  const title = filename ?? name
  let target
  if (type === 'spec') {
    const specStore = index.config.specs[specIndex]
    if (!specStore) return { code: 1, out: `spec store index ${specIndex}가 없습니다` }
    target = path.resolve(index.configDir, specStore.path, base)
  } else {
    const store = index.config.stores[storeIndex]
    if (!store) return { code: 1, out: `store index ${storeIndex}가 없습니다` }
    target = path.resolve(index.configDir, store.path, type, base)
  }
  if (fs.existsSync(target)) return { code: 1, out: `파일이 이미 존재합니다: ${target}` }
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, type === 'spec' ? specTemplate(id, title) : atomTemplate(type, id, title))
  return { code: 0, out: `생성: ${relPath(index, target)} (id: ${id}, stage 1)` }
}

// --- validate -----------------------------------------------------------

export function cmdValidate({ cwd, fix = false, body = false, yaml = false }) {
  let index = requireIndex(cwd)
  const out = []
  if (fix) {
    const changes = fixUsedBy(index)
    for (const change of changes) {
      out.push(`sync used_by: ${change.id} ← [${change.used_by.join(', ')}]`)
    }
    if (changes.length > 0) index = buildIndex(index.configDir)
  }
  const result = validate(index, { body })
  if (yaml) {
    return { code: result.errors > 0 ? 1 : 0, out: toYaml(result.findings) }
  }
  for (const f of result.findings) {
    out.push(`[${f.level}] ${f.rule} ${f.file} — ${f.message}`)
  }
  const total = index.atoms.length + index.specs.length
  out.push(`검사 완료: error ${result.errors}, warning ${result.warnings}, info ${result.infos} (문서 ${total}개)`)
  return { code: result.errors > 0 ? 1 : 0, out: out.join('\n') }
}

// --- list ---------------------------------------------------------------

export function cmdList({ cwd, type, stage, orphan = false, yaml = false }) {
  const index = requireIndex(cwd)
  let atoms = index.atoms
  let specs = index.specs
  if (type === 'spec') atoms = []
  else if (type) {
    atoms = atoms.filter((a) => a.doc.fields?.type === type)
    specs = []
  }
  if (stage) {
    atoms = atoms.filter((a) => str(a.doc.fields?.stage) === String(stage))
    specs = []
  }
  if (orphan) {
    atoms = atoms.filter((a) => arr(a.doc.fields?.refs).length === 0 && arr(a.doc.fields?.used_by).length === 0)
    specs = []
  }
  if (yaml) {
    const items = [
      ...atoms.map((a) => ({ id: str(a.doc.fields?.id), kind: 'atom', stage: str(a.doc.fields?.stage), file: relPath(index, a.file) })),
      ...specs.map((s) => ({ id: str(s.doc.fields?.id), kind: 'spec', status: str(s.doc.fields?.status), file: relPath(index, s.file) })),
    ]
    return { code: 0, out: toYaml(items) }
  }
  const lines = [
    ...atoms.map((a) => {
      const f = a.doc.fields ?? {}
      return `[atom] ${str(f.id).padEnd(36)} stage:${str(f.stage).padEnd(11)} ${str(f.description)}`
    }),
    ...specs.map((s) => {
      const f = s.doc.fields ?? {}
      return `[spec] ${str(f.id).padEnd(36)} status:${str(f.status).padEnd(10)} ${str(f.description)}`
    }),
  ]
  lines.push(`합계: atom ${atoms.length}, spec ${specs.length}`)
  return { code: 0, out: lines.join('\n') }
}

// --- show ---------------------------------------------------------------

export function cmdShow({ cwd, ids, frontmatter = false }) {
  const index = requireIndex(cwd)
  const out = []
  let code = 0
  for (const id of ids) {
    const rec = findById(index, id)
    if (!rec) {
      out.push(`=== ${id} — 존재하지 않습니다 ===`)
      code = 1
      continue
    }
    out.push(`=== ${id} (${relPath(index, rec.file)}) ===`)
    if (frontmatter) {
      const lines = rec.text.split('\n')
      out.push(lines.slice(0, rec.doc.fmClose + 1).join('\n'))
    } else {
      out.push(rec.text)
    }
  }
  return { code, out: out.join('\n') }
}

// --- stats --------------------------------------------------------------

export function cmdStats({ cwd, yaml = false }) {
  const index = requireIndex(cwd)
  const out = []
  index.config.stores.forEach((store, storeIndex) => {
    const atoms = index.atoms.filter((a) => a.storeIndex === storeIndex)
    const byType = Object.fromEntries(
      ATOM_TYPE_ORDER.map((t) => [t, atoms.filter((a) => a.doc.fields?.type === t).length]),
    )
    const byStage = Object.fromEntries(
      STAGES.map((s) => [s, atoms.filter((a) => str(a.doc.fields?.stage) === s).length]),
    )
    out.push(`Store: ${path.resolve(index.configDir, store.path)}`)
    out.push(`  entity: ${byType.entity}  action: ${byType.action}  rule: ${byType.rule}  term: ${byType.term}  total: ${atoms.length}`)
    out.push(`  stage: 1:${byStage['1']}  2:${byStage['2']}  3:${byStage['3']}  4:${byStage['4']}  deprecated:${byStage.deprecated}`)
    out.push('')
  })
  const byStatus = Object.fromEntries(
    SPEC_STATUSES.map((s) => [s, index.specs.filter((x) => str(x.doc.fields?.status) === s).length]),
  )
  const totalRefs = index.specs.reduce((sum, s) => sum + arr(s.doc.fields?.refs).length, 0)
  const avgRefs = index.specs.length > 0 ? (totalRefs / index.specs.length).toFixed(1) : '0.0'
  out.push(`Specs: ${index.specs.length} (draft:${byStatus.draft}  in-progress:${byStatus['in-progress']}  complete:${byStatus.complete})`)
  out.push(`  avg refs/spec: ${avgRefs}`)
  out.push('')
  const orphans = index.atoms.filter(
    (a) => arr(a.doc.fields?.refs).length === 0 && arr(a.doc.fields?.used_by).length === 0,
  )
  const unlinked = index.atoms.filter(
    (a) => !arr(a.doc.fields?.used_by).some((id) => id.startsWith('spec-')),
  )
  out.push('Topology:')
  out.push(`  orphan atoms (no refs, no used_by): ${orphans.length}`)
  out.push(`  unlinked atoms (no spec refs): ${unlinked.length}`)
  if (yaml) {
    const item = {
      atoms: index.atoms.length,
      specs: index.specs.length,
      orphans: orphans.length,
      unlinked: unlinked.length,
    }
    return { code: 0, out: toYaml([item]) }
  }
  return { code: 0, out: out.join('\n') }
}

// --- walk ---------------------------------------------------------------

export function cmdWalk({ cwd, id, direction = 'refs', depth = Infinity }) {
  const index = requireIndex(cwd)
  const byId = new Map(
    [...index.atoms, ...index.specs].map((rec) => [rec.doc.fields?.id, rec]).filter(([key]) => key),
  )
  if (!byId.has(id)) return { code: 1, out: `ID '${id}'를 찾을 수 없습니다` }
  const out = []
  const visit = (currentId, level, trail) => {
    const indent = '  '.repeat(level)
    const rec = byId.get(currentId)
    if (!rec) {
      out.push(`${indent}- ${currentId} (존재하지 않음)`)
      return
    }
    if (trail.includes(currentId)) {
      out.push(`${indent}- ${currentId} (순환)`)
      return
    }
    const desc = str(rec.doc.fields?.description).trim()
    out.push(`${indent}- ${currentId}${desc ? ` — ${desc}` : ''}`)
    if (level >= depth) return
    const children = direction === 'used_by' ? arr(rec.doc.fields?.used_by) : arr(rec.doc.fields?.refs)
    for (const child of children) visit(child, level + 1, [...trail, currentId])
  }
  visit(id, 0, [])
  return { code: 0, out: out.join('\n') }
}

// --- promote ------------------------------------------------------------

export function promoteBlockers(rec) {
  const f = rec.doc.fields ?? {}
  const stage = str(f.stage)
  const required = REQUIRED_SECTIONS[f.type] ?? []
  const sections = new Map(parseSections(rec.doc.body).map((s) => [s.title, s]))
  const filled = (name) => sections.has(name) && !isPlaceholder(sections.get(name).content)
  const blockers = []
  if (stage === '1') {
    if (!str(f.description).trim()) blockers.push('description이 비어 있습니다')
    if (required.length > 0 && !required.some(filled)) blockers.push('모든 필수 섹션이 비어 있습니다 (전부 TBD)')
  } else if (stage === '2') {
    for (const name of required) {
      if (!sections.has(name)) blockers.push(`필수 섹션 누락: ## ${name}`)
    }
  } else if (stage === '3') {
    for (const name of required) {
      if (!sections.has(name)) blockers.push(`필수 섹션 누락: ## ${name}`)
      else if (!filled(name)) blockers.push(`placeholder 상태: ## ${name}`)
    }
  } else {
    blockers.push(`stage '${stage}'에서는 승격할 수 없습니다`)
  }
  return blockers
}

export function cmdPromote({ cwd, id, dryRun = false }) {
  const index = requireIndex(cwd)
  const rec = index.atoms.find((a) => a.doc.fields?.id === id)
  if (!rec) return { code: 1, out: `atom '${id}'를 찾을 수 없습니다 (promote는 atom 전용)` }
  const stage = str(rec.doc.fields?.stage)
  const next = nextStage(stage)
  if (!next) return { code: 1, out: `stage '${stage}'에서는 승격할 수 없습니다` }
  const blockers = promoteBlockers(rec)
  if (blockers.length > 0) {
    const lines = [`승격 거부: ${id} (${stage} → ${next})`, ...blockers.map((b) => `  - ${b}`)]
    return { code: 1, out: lines.join('\n') }
  }
  if (dryRun) return { code: 0, out: `승격 가능: ${id} (${stage} → ${next}) — blocker 없음` }
  fs.writeFileSync(rec.file, replaceField(rec.text, 'stage', next))
  return { code: 0, out: `승격 완료: ${id} (${stage} → ${next})` }
}
