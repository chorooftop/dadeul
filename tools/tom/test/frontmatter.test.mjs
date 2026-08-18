import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDocument, replaceField, parseSections, isPlaceholder } from '../lib/frontmatter.mjs'

test('frontmatter: 인라인 배열·대시 리스트·quoted 스칼라를 파싱한다', () => {
  const text = [
    '---',
    'type: action',
    'id: action-x',
    'description: "한 줄 요약"',
    'stage: 1',
    'refs: [term-a, entity-b]',
    'used_by:',
    '  - spec-c',
    '---',
    '',
    '# 본문',
  ].join('\n')
  const doc = parseDocument(text)
  assert.equal(doc.fields.type, 'action')
  assert.equal(doc.fields.description, '한 줄 요약')
  assert.equal(doc.fields.stage, '1')
  assert.deepEqual(doc.fields.refs, ['term-a', 'entity-b'])
  assert.deepEqual(doc.fields.used_by, ['spec-c'])
  assert.equal(doc.body.includes('# 본문'), true)
})

test('frontmatter: 빈 배열과 frontmatter 없는 문서를 처리한다', () => {
  const doc = parseDocument('---\nrefs: []\n---\nbody')
  assert.deepEqual(doc.fields.refs, [])
  const none = parseDocument('# frontmatter 없음')
  assert.equal(none.fields, null)
})

test('replaceField: 대상 필드만 바꾸고 나머지는 byte 단위로 보존한다', () => {
  const text = [
    '---',
    'type: term',
    'id: term-x',
    'description: "설명"',
    'stage: 1',
    'refs: []',
    'used_by: []',
    '---',
    '',
    '## Rationale',
    '',
    '본문 내용',
  ].join('\n')
  const next = replaceField(text, 'used_by', ['action-a', 'spec-b'])
  const doc = parseDocument(next)
  assert.deepEqual(doc.fields.used_by, ['action-a', 'spec-b'])
  assert.equal(doc.fields.description, '설명')
  assert.equal(next.includes('본문 내용'), true)
  const scalar = replaceField(next, 'stage', '2')
  assert.equal(parseDocument(scalar).fields.stage, '2')
})

test('replaceField: 없는 필드는 frontmatter 끝에 삽입한다', () => {
  const text = '---\ntype: term\nid: term-x\n---\nbody'
  const next = replaceField(text, 'refs', ['term-y'])
  assert.deepEqual(parseDocument(next).fields.refs, ['term-y'])
})

test('parseSections/isPlaceholder: TBD와 TOM refs footer를 판정한다', () => {
  const body = [
    '# 제목',
    '',
    '## Rationale',
    '',
    '실제 내용이 있다.',
    '',
    '## DO NOT',
    '',
    '_(TBD)_',
    '',
    '<!-- TOM refs -->',
    '[term-x]: ../term/x.md',
  ].join('\n')
  const sections = parseSections(body)
  const byTitle = new Map(sections.map((s) => [s.title, s]))
  assert.equal(isPlaceholder(byTitle.get('Rationale').content), false)
  assert.equal(isPlaceholder(byTitle.get('DO NOT').content), true)
})
