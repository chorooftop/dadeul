import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { buildIndex } from '../lib/store.mjs'
import { validate, fixUsedBy } from '../lib/validate.mjs'
import { makeRepo, writeAtom, writeSpec, atomText, fullBody, tbdBody } from './helpers.mjs'

test('validate: 링크가 일관된 저장소는 위반 0건', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'cell-status', description: '셀 상태', usedBy: ['action-check-cell'] })
  writeAtom(dir, { type: 'action', name: 'check-cell', description: '셀 체크', refs: ['term-cell-status'], usedBy: ['spec-bingo-play'] })
  writeSpec(dir, { name: 'bingo-play', description: '빙고 플레이', refs: ['action-check-cell'] })
  const result = validate(buildIndex(dir))
  assert.deepEqual(result.findings, [])
})

test('validate: atom은 spec을 참조할 수 없다', (t) => {
  const dir = makeRepo(t)
  writeSpec(dir, { name: 'target', refs: [] })
  writeAtom(dir, { type: 'term', name: 'x', refs: ['spec-target'] })
  const result = validate(buildIndex(dir))
  assert.ok(result.findings.some((f) => f.rule === 'ref_consistency' && f.message.includes('atom은 spec을 참조할 수 없습니다')))
})

test('validate: 존재하지 않는 참조 대상과 spec_refs를 잡는다', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'x', refs: ['entity-ghost'] })
  writeSpec(dir, { name: 'y', refs: ['action-ghost'] })
  const result = validate(buildIndex(dir))
  assert.ok(result.findings.some((f) => f.rule === 'ref_consistency' && f.message.includes('entity-ghost')))
  assert.ok(result.findings.some((f) => f.rule === 'spec_refs' && f.message.includes('action-ghost')))
})

test('validate+fix: used_by 불일치를 검출하고 --fix가 동기화한다', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'status', description: '상태' })
  writeAtom(dir, { type: 'action', name: 'sync', description: '동기화', refs: ['term-status'] })
  writeSpec(dir, { name: 'flow', description: '흐름', refs: ['action-sync'] })

  const before = validate(buildIndex(dir))
  assert.ok(before.errors >= 2)

  const changes = fixUsedBy(buildIndex(dir))
  assert.equal(changes.length, 2)
  const after = validate(buildIndex(dir))
  assert.equal(after.errors, 0)

  const statusText = fs.readFileSync(path.join(dir, 'atoms/term/status.md'), 'utf8')
  assert.ok(statusText.includes('- action-sync'))
})

test('validate: severity 매트릭스 — stage 1 검사 없음, 2는 warning, 3은 error', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 's1', description: 'a', stage: '1' })
  writeAtom(dir, { type: 'term', name: 's2', description: 'b', stage: '2' })
  writeAtom(dir, { type: 'term', name: 's3', description: 'c', stage: '3' })
  const result = validate(buildIndex(dir), { body: true })
  const forFile = (name) => result.findings.filter((f) => f.file.endsWith(`${name}.md`))
  assert.equal(forFile('s1').length, 0)
  assert.ok(forFile('s2').every((f) => f.level === 'warning'))
  assert.ok(forFile('s3').every((f) => f.level === 'error'))
  assert.ok(forFile('s3').length > 0)
})

test('validate: placeholder는 stage 3에서 warning, 채워진 본문은 통과', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'tbd', description: 'x', stage: '3', body: tbdBody('term') })
  writeAtom(dir, { type: 'term', name: 'full', description: 'y', stage: '3', body: fullBody('term') })
  const result = validate(buildIndex(dir), { body: true })
  const tbd = result.findings.filter((f) => f.file.endsWith('tbd.md'))
  assert.ok(tbd.length > 0)
  assert.ok(tbd.every((f) => f.rule === 'body_placeholder' && f.level === 'warning'))
  assert.equal(result.findings.filter((f) => f.file.endsWith('full.md')).length, 0)
})

test('validate: ID 중복과 type-디렉터리 불일치를 잡는다', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'dup', description: 'a' })
  fs.writeFileSync(path.join(dir, 'atoms/entity/dup2.md'), atomText({ type: 'term', name: 'dup' }))
  const result = validate(buildIndex(dir))
  assert.ok(result.findings.some((f) => f.rule === 'id_uniqueness'))
  assert.ok(result.findings.some((f) => f.rule === 'id_convention' && f.message.includes('디렉터리')))
})

test('validate: ID 형식과 stage enum을 강제한다', (t) => {
  const dir = makeRepo(t)
  fs.writeFileSync(
    path.join(dir, 'atoms/term/bad.md'),
    '---\ntype: term\nid: term-Bad_Name\ndescription: "x"\nstage: 9\nrefs: []\nused_by: []\n---\n',
  )
  const result = validate(buildIndex(dir))
  assert.ok(result.findings.some((f) => f.rule === 'id_convention' && f.message.includes('ID 형식 위반')))
  assert.ok(result.findings.some((f) => f.rule === 'schema' && f.message.includes('stage')))
})
