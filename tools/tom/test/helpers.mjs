// 테스트 픽스처 헬퍼 — 임시 디렉터리에 최소 TOM 저장소를 만든다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ATOM_TYPE_ORDER, REQUIRED_SECTIONS } from '../lib/schema.mjs'

export function makeRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tom-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.writeFileSync(path.join(dir, 'tom.yaml'), 'stores:\n  - path: ./atoms\nspecs:\n  - path: ./specs\n')
  for (const type of ATOM_TYPE_ORDER) fs.mkdirSync(path.join(dir, 'atoms', type), { recursive: true })
  fs.mkdirSync(path.join(dir, 'specs'), { recursive: true })
  return dir
}

function arrayField(key, values) {
  if (values.length === 0) return `${key}: []`
  return [`${key}:`, ...values.map((v) => `  - ${v}`)].join('\n')
}

export function atomText({ type, name, description = '', stage = '1', refs = [], usedBy = [], body = '' }) {
  const id = `${type}-${name}`
  return [
    '---',
    `type: ${type}`,
    `id: ${id}`,
    `description: "${description}"`,
    `stage: ${stage}`,
    arrayField('refs', refs),
    arrayField('used_by', usedBy),
    '---',
    '',
    `# ${name}`,
    '',
    body,
  ].join('\n')
}

export function writeAtom(dir, options) {
  const id = `${options.type}-${options.name}`
  const file = path.join(dir, 'atoms', options.type, `${options.name}.md`)
  fs.writeFileSync(file, atomText(options))
  return { id, file }
}

export function writeSpec(dir, { name, description = '', status = 'draft', refs = [], body = '' }) {
  const id = `spec-${name}`
  const text = [
    '---',
    `id: ${id}`,
    `description: "${description}"`,
    `status: ${status}`,
    arrayField('refs', refs),
    '---',
    '',
    `# ${name}`,
    '',
    body,
  ].join('\n')
  const file = path.join(dir, 'specs', `${name}.md`)
  fs.writeFileSync(file, text)
  return { id, file }
}

export function fullBody(type) {
  return REQUIRED_SECTIONS[type].map((section) => `## ${section}\n\n내용이 채워져 있다.\n`).join('\n')
}

export function tbdBody(type) {
  return REQUIRED_SECTIONS[type].map((section) => `## ${section}\n\n_(TBD)_\n`).join('\n')
}
