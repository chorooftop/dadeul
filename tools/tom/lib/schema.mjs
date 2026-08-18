// TOM 데이터 규격 상수 — 플레이북 §3 기준
export const ATOM_TYPE_ORDER = ['term', 'entity', 'rule', 'action']
export const STAGES = ['1', '2', '3', '4', 'deprecated']
export const SPEC_STATUSES = ['draft', 'in-progress', 'complete']
export const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
export const PLACEHOLDER = '_(TBD)_'

export const REQUIRED_SECTIONS = {
  entity: ['Rationale', 'Fields', 'Relationships', 'Cross Map'],
  action: [
    'Rationale',
    'Auth & Permissions',
    'Execution Order',
    'Input / Output',
    'DO NOT',
    'Error Handling',
  ],
  rule: ['Rationale', 'Applicability', 'Specification', 'DO NOT'],
  term: ['Rationale', 'Definition', 'Usage Context'],
  spec: [
    'Problem & Motivation',
    'Scope',
    'User Flow',
    'Core Requirements',
    'Scenarios',
    'Out of Scope',
  ],
}

export const ATOM_REQUIRED_FIELDS = ['type', 'id', 'description', 'stage', 'refs', 'used_by']
export const SPEC_REQUIRED_FIELDS = ['id', 'description', 'status', 'refs']

// Severity 매트릭스 — 성숙도에 비례하는 엄격도 (§4)
// stage 1·deprecated는 본문 검사를 하지 않는다.
export function atomBodySeverity(stage) {
  if (stage === '1' || stage === 'deprecated') return null
  if (stage === '2') return { missing: 'warning', placeholder: 'info' }
  return { missing: 'error', placeholder: 'warning' }
}

export function specBodySeverity(status) {
  if (status === 'draft') return { missing: 'warning', placeholder: 'info' }
  return { missing: 'error', placeholder: 'warning' }
}

export function nextStage(stage) {
  const map = { 1: '2', 2: '3', 3: '4' }
  return map[stage] ?? null
}

export function arr(value) {
  return Array.isArray(value) ? value : []
}

export function str(value) {
  return typeof value === 'string' ? value : ''
}
