// 검증 엔진 — 플레이북 §4 규칙 전체 목록 구현
import fs from 'node:fs'
import {
  ATOM_REQUIRED_FIELDS,
  SPEC_REQUIRED_FIELDS,
  ATOM_TYPE_ORDER,
  STAGES,
  SPEC_STATUSES,
  NAME_RE,
  REQUIRED_SECTIONS,
  atomBodySeverity,
  specBodySeverity,
  arr,
  str,
} from './schema.mjs'
import { parseSections, isPlaceholder, replaceField } from './frontmatter.mjs'
import { relPath } from './store.mjs'

// A.refs에 B가 있으면 ⟺ B.used_by에 A가 있어야 한다 — 이 불변식이 시스템의 척추
export function buildReferrers(index) {
  const referrers = new Map()
  for (const rec of [...index.atoms, ...index.specs]) {
    const id = rec.doc.fields?.id
    if (!id) continue
    for (const ref of arr(rec.doc.fields?.refs)) {
      const set = referrers.get(ref) ?? new Set()
      set.add(id)
      referrers.set(ref, set)
    }
  }
  return referrers
}

function checkBody(rec, requiredSections, severity, add, file) {
  if (!severity) return
  const byTitle = new Map(parseSections(rec.doc.body).map((s) => [s.title, s]))
  for (const name of requiredSections) {
    const rule = name === 'DO NOT' ? 'body_donot' : 'body_section'
    const section = byTitle.get(name)
    if (!section) add(severity.missing, rule, file, `필수 섹션 누락: ## ${name}`)
    else if (isPlaceholder(section.content)) {
      add(severity.placeholder, 'body_placeholder', file, `섹션이 placeholder 상태: ## ${name}`)
    }
  }
}

export function validate(index, { body = false } = {}) {
  const findings = []
  const add = (level, rule, file, message) => findings.push({ level, rule, file, message })

  const atomIds = new Set(index.atoms.map((a) => a.doc.fields?.id).filter(Boolean))
  const specIds = new Set(index.specs.map((s) => s.doc.fields?.id).filter(Boolean))

  // schema + id_convention — atoms
  for (const a of index.atoms) {
    const file = relPath(index, a.file)
    const f = a.doc.fields
    if (!f) {
      add('error', 'schema', file, 'frontmatter가 없습니다')
      continue
    }
    for (const key of ATOM_REQUIRED_FIELDS) {
      if (!(key in f)) add('error', 'schema', file, `필수 필드 누락: ${key}`)
    }
    if ('stage' in f && !STAGES.includes(str(f.stage))) {
      add('error', 'schema', file, `stage 값이 올바르지 않습니다: ${f.stage} (1|2|3|4|deprecated)`)
    }
    if ('type' in f) {
      if (!ATOM_TYPE_ORDER.includes(f.type)) {
        add('error', 'id_convention', file, `허용되지 않는 type: ${f.type}`)
      } else if (f.type !== a.dirType) {
        add('error', 'id_convention', file, `type '${f.type}'이 디렉터리 '${a.dirType}/'와 일치하지 않습니다`)
      }
    }
    const id = str(f.id)
    if (id) {
      const prefix = `${str(f.type) || a.dirType}-`
      if (!id.startsWith(prefix) || !NAME_RE.test(id.slice(prefix.length))) {
        add('error', 'id_convention', file, `ID 형식 위반: ${id} (형식: ${prefix}{kebab-case-name})`)
      }
    }
  }

  // schema + id_convention — specs
  for (const s of index.specs) {
    const file = relPath(index, s.file)
    const f = s.doc.fields
    if (!f) {
      add('error', 'schema', file, 'frontmatter가 없습니다')
      continue
    }
    for (const key of SPEC_REQUIRED_FIELDS) {
      if (!(key in f)) add('error', 'schema', file, `필수 필드 누락: ${key}`)
    }
    if ('status' in f && !SPEC_STATUSES.includes(str(f.status))) {
      add('error', 'schema', file, `status 값이 올바르지 않습니다: ${f.status} (draft|in-progress|complete)`)
    }
    const id = str(f.id)
    if (id && (!id.startsWith('spec-') || !NAME_RE.test(id.slice('spec-'.length)))) {
      add('error', 'id_convention', file, `ID 형식 위반: ${id} (형식: spec-{kebab-case-name})`)
    }
  }

  // id_uniqueness — atom/spec 전역
  const seen = new Map()
  for (const rec of [...index.atoms, ...index.specs]) {
    const id = rec.doc.fields?.id
    if (!id) continue
    const prev = seen.get(id)
    if (prev) {
      add('error', 'id_uniqueness', relPath(index, rec.file), `ID '${id}' 중복: ${relPath(index, prev.file)} ↔ ${relPath(index, rec.file)}`)
    } else {
      seen.set(id, rec)
    }
  }

  // ref_consistency — atom은 spec을 참조할 수 없다 + 대상 실재
  for (const a of index.atoms) {
    const file = relPath(index, a.file)
    for (const ref of arr(a.doc.fields?.refs)) {
      if (specIds.has(ref)) add('error', 'ref_consistency', file, `atom은 spec을 참조할 수 없습니다: ${ref}`)
      else if (!atomIds.has(ref)) add('error', 'ref_consistency', file, `참조 대상이 존재하지 않습니다: ${ref}`)
    }
  }

  // ref_consistency — refs ↔ used_by 양방향 일치 (집합 비교)
  const referrers = buildReferrers(index)
  for (const a of index.atoms) {
    const id = a.doc.fields?.id
    if (!id) continue
    const file = relPath(index, a.file)
    const expected = referrers.get(id) ?? new Set()
    const actual = new Set(arr(a.doc.fields?.used_by))
    for (const missing of [...expected].filter((x) => !actual.has(x))) {
      add('error', 'ref_consistency', file, `used_by 누락: ${missing} (tom validate --fix로 동기화)`)
    }
    for (const stale of [...actual].filter((x) => !expected.has(x))) {
      add('error', 'ref_consistency', file, `used_by의 '${stale}'가 이 atom을 참조하지 않습니다 (tom validate --fix로 동기화)`)
    }
  }

  // spec_refs — 대상 실재 (atom/spec 모두 허용)
  for (const s of index.specs) {
    const file = relPath(index, s.file)
    for (const ref of arr(s.doc.fields?.refs)) {
      if (!atomIds.has(ref) && !specIds.has(ref)) {
        add('error', 'spec_refs', file, `참조 대상이 존재하지 않습니다: ${ref}`)
      }
    }
  }

  // body_section / body_placeholder / body_donot — severity 매트릭스 적용
  if (body) {
    for (const a of index.atoms) {
      const f = a.doc.fields
      if (!f || !ATOM_TYPE_ORDER.includes(f.type)) continue
      checkBody(a, REQUIRED_SECTIONS[f.type], atomBodySeverity(str(f.stage)), add, relPath(index, a.file))
    }
    for (const s of index.specs) {
      const f = s.doc.fields
      if (!f) continue
      checkBody(s, REQUIRED_SECTIONS.spec, specBodySeverity(str(f.status)), add, relPath(index, s.file))
    }
  }

  const count = (level) => findings.filter((x) => x.level === level).length
  return { findings, errors: count('error'), warnings: count('warning'), infos: count('info') }
}

// used_by 자동 동기화 — 작성자는 refs만 신경 쓰고 used_by는 기계가 채운다
export function fixUsedBy(index) {
  const referrers = buildReferrers(index)
  const changes = []
  for (const a of index.atoms) {
    const id = a.doc.fields?.id
    if (!id) continue
    const expected = [...(referrers.get(id) ?? new Set())].sort()
    const actual = [...new Set(arr(a.doc.fields?.used_by))].sort()
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      const next = replaceField(a.text, 'used_by', expected)
      fs.writeFileSync(a.file, next)
      changes.push({ file: a.file, id, used_by: expected })
    }
  }
  return changes
}
