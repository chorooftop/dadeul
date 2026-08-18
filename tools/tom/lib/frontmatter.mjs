// frontmatter 전용 파서 — 두 번째 '---'에서 멈추고 본문은 lazy하게 다룬다 (§4 스캔 규약)
// 지원 YAML 부분집합: 스칼라, "quoted", 인라인 배열 [a, b], 대시 리스트
import { PLACEHOLDER } from './schema.mjs'

const KEY_RE = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/

function stripQuotes(s) {
  if (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return s.slice(1, -1)
    }
  }
  return s
}

export function parseDocument(text) {
  const lines = text.split('\n')
  const empty = { fields: null, order: [], keySpans: {}, fmClose: -1, body: text }
  if ((lines[0] ?? '').trim() !== '---') return empty

  let close = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      close = i
      break
    }
  }
  if (close === -1) return empty

  const fields = {}
  const order = []
  const keySpans = {}
  let i = 1
  while (i < close) {
    const m = lines[i].match(KEY_RE)
    if (!m) {
      i += 1
      continue
    }
    const key = m[1]
    const rest = m[2].trim()
    let end = i
    let value
    if (rest === '') {
      const items = []
      const rawLines = []
      let isArray = true
      let j = i + 1
      while (j < close && /^\s+\S/.test(lines[j])) {
        const im = lines[j].match(/^\s*-\s*(.*)$/)
        if (im) items.push(stripQuotes(im[1].trim()))
        else isArray = false
        rawLines.push(lines[j])
        j += 1
      }
      end = j - 1
      if (rawLines.length === 0) value = ''
      else value = isArray ? items : { raw: rawLines }
    } else if (rest === '[]') {
      value = []
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      value = rest
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter((s) => s.length > 0)
    } else {
      value = stripQuotes(rest)
    }
    fields[key] = value
    order.push(key)
    keySpans[key] = { start: i, end }
    i = end + 1
  }
  return { fields, order, keySpans, fmClose: close, body: lines.slice(close + 1).join('\n') }
}

export function fieldLines(key, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: []`]
    return [`${key}:`, ...value.map((v) => `  - ${v}`)]
  }
  if (key === 'description') return [`${key}: "${value}"`]
  return [`${key}: ${value}`]
}

// 파일 전체를 재직렬화하지 않고 frontmatter의 한 필드만 교체한다.
// 다른 필드·본문은 byte 단위로 보존된다 (interactive 같은 복합 값 파손 방지).
export function replaceField(text, key, value) {
  const lines = text.split('\n')
  const doc = parseDocument(text)
  if (doc.fmClose === -1) throw new Error('frontmatter가 없는 문서입니다')
  const newLines = fieldLines(key, value)
  const span = doc.keySpans[key]
  if (span) {
    return [...lines.slice(0, span.start), ...newLines, ...lines.slice(span.end + 1)].join('\n')
  }
  return [...lines.slice(0, doc.fmClose), ...newLines, ...lines.slice(doc.fmClose)].join('\n')
}

export function parseSections(body) {
  const sections = []
  let current = null
  for (const line of body.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      current = { title: m[1], lines: [] }
      sections.push(current)
      continue
    }
    if (/^#\s/.test(line)) {
      current = null
      continue
    }
    if (current) current.lines.push(line)
  }
  return sections.map((s) => ({ title: s.title, content: s.lines.join('\n') }))
}

// placeholder 판정: HTML 주석과 링크 정의(<!-- TOM refs --> footer)는 내용으로 치지 않는다
export function isPlaceholder(content) {
  const cleaned = content
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .filter((line) => !/^\[[^\]]+\]:\s+\S/.test(line))
    .join('\n')
    .trim()
  return cleaned === '' || cleaned === PLACEHOLDER
}
