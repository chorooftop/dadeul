import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { run } from '../lib/cli.mjs'
import { makeRepo, writeAtom, writeSpec, fullBody, tbdBody } from './helpers.mjs'

test('init: tom.yaml과 MANIFEST, 타입 디렉터리를 만든다', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tom-init-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const first = run(['init'], dir)
  assert.equal(first.code, 0)
  assert.ok(fs.existsSync(path.join(dir, 'tom.yaml')))
  assert.ok(fs.existsSync(path.join(dir, 'atoms/MANIFEST.md')))
  assert.ok(fs.existsSync(path.join(dir, 'atoms/action')))
  const second = run(['init'], dir)
  assert.ok(second.out.includes('유지'))
  const forced = run(['init', '--force'], dir)
  assert.ok(forced.out.includes('생성'))
})

test('create: 템플릿 생성, 검증 통과, 중복 ID 거부', (t) => {
  const dir = makeRepo(t)
  const created = run(['create', 'action', 'auth-sync'], dir)
  assert.equal(created.code, 0)
  const file = path.join(dir, 'atoms/action/auth-sync.md')
  const text = fs.readFileSync(file, 'utf8')
  assert.ok(text.includes('id: action-auth-sync'))
  assert.ok(text.includes('## DO NOT'))
  assert.ok(text.includes('<!-- TOM refs -->'))
  assert.equal(run(['validate'], dir).code, 0)
  assert.equal(run(['create', 'action', 'auth-sync', '--filename', 'other'], dir).code, 1)
  assert.equal(run(['create', 'action', 'Bad_Name'], dir).code, 1)
})

test('create: --filename으로 한국어 파일명을 쓸 수 있다', (t) => {
  const dir = makeRepo(t)
  const created = run(['create', 'term', 'cell-status', '--filename', '셀상태'], dir)
  assert.equal(created.code, 0)
  const text = fs.readFileSync(path.join(dir, 'atoms/term/셀상태.md'), 'utf8')
  assert.ok(text.includes('id: term-cell-status'))
})

test('promote: 게이트가 blocker를 계산해 미달이면 거부한다', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'empty', description: '', stage: '1', body: tbdBody('term') })
  writeAtom(dir, { type: 'term', name: 'ready', description: '설명 있음', stage: '1', body: fullBody('term') })

  const blocked = run(['promote', 'term-empty'], dir)
  assert.equal(blocked.code, 1)
  assert.ok(blocked.out.includes('description'))

  const dry = run(['promote', 'term-ready', '--dry-run'], dir)
  assert.equal(dry.code, 0)
  assert.ok(dry.out.includes('승격 가능'))
  assert.ok(fs.readFileSync(path.join(dir, 'atoms/term/ready.md'), 'utf8').includes('stage: 1'))

  const promoted = run(['promote', 'term-ready'], dir)
  assert.equal(promoted.code, 0)
  assert.ok(fs.readFileSync(path.join(dir, 'atoms/term/ready.md'), 'utf8').includes('stage: 2'))
})

test('promote: 2→3은 필수 섹션 누락이 blocker', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'rule', name: 'partial', description: '규칙', stage: '2', body: '## Rationale\n\n내용\n' })
  const blocked = run(['promote', 'rule-partial'], dir)
  assert.equal(blocked.code, 1)
  assert.ok(blocked.out.includes('DO NOT'))
})

test('stats/list/walk/show: 조회 명령이 동작한다', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'a', description: '용어', usedBy: ['action-b'] })
  writeAtom(dir, { type: 'action', name: 'b', description: '행위', refs: ['term-a'], usedBy: ['spec-c'] })
  writeAtom(dir, { type: 'entity', name: 'orphan', description: '고아' })
  writeSpec(dir, { name: 'c', description: '기능', refs: ['action-b'] })

  const stats = run(['stats'], dir)
  assert.ok(stats.out.includes('total: 3'))
  assert.ok(stats.out.includes('orphan atoms (no refs, no used_by): 1'))

  const list = run(['list', '--type', 'term'], dir)
  assert.ok(list.out.includes('term-a'))
  assert.ok(!list.out.includes('action-b'))

  const orphan = run(['list', '--orphan'], dir)
  assert.ok(orphan.out.includes('entity-orphan'))

  const walk = run(['walk', 'spec-c'], dir)
  assert.ok(walk.out.includes('action-b'))
  assert.ok(walk.out.includes('term-a'))

  const show = run(['show', 'term-a', '--frontmatter'], dir)
  assert.ok(show.out.includes('id: term-a'))
  assert.ok(!show.out.includes('# a'))
})

test('walk: 순환을 감지한다', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'a', refs: ['entity-b'], usedBy: ['entity-b'] })
  writeAtom(dir, { type: 'entity', name: 'b', refs: ['term-a'], usedBy: ['term-a'] })
  const walk = run(['walk', 'term-a'], dir)
  assert.equal(walk.code, 0)
  assert.ok(walk.out.includes('(순환)'))
})

test('validate --fix CLI: used_by를 채우고 exit code 0', (t) => {
  const dir = makeRepo(t)
  writeAtom(dir, { type: 'term', name: 'x', description: '용어' })
  writeSpec(dir, { name: 'y', description: '기능', refs: [] })
  run(['create', 'action', 'z'], dir)
  fs.writeFileSync(
    path.join(dir, 'atoms/action/z.md'),
    fs.readFileSync(path.join(dir, 'atoms/action/z.md'), 'utf8').replace('refs: []', 'refs: [term-x]'),
  )
  const fixed = run(['validate', '--fix'], dir)
  assert.equal(fixed.code, 0)
  assert.ok(fixed.out.includes('sync used_by: term-x'))
})
