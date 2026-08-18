// PreToolUse(Write|Edit) 가드 본체 — stdin JSON payload를 읽어 경고만 출력한다 (비차단).
import fs from 'node:fs'

let input = {}
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const toolInput = input.tool_input ?? {}
const filePath = toolInput.file_path ?? ''
if (!/specs\/(atoms|specs)\/.*\.md$/.test(filePath)) process.exit(0)

if (/MANIFEST\.md$/.test(filePath)) {
  console.log(
    '경고: MANIFEST.md는 수동 편집 금지 — tools/tom/lib/manifest.mjs 수정 후 `tom init --force`로 재생성하세요.',
  )
  process.exit(0)
}

const content = toolInput.content ?? toolInput.new_string ?? ''
if (!content) process.exit(0)

// used_by 수동 편집 경고 (Write/Edit 공통) — 다음 --fix가 덮어쓴다 (플레이북 §10-E)
if (/used_by:\s*(\[[^\]]|\n\s+-\s)/.test(content)) {
  console.log(
    '참고: used_by는 `tom validate --fix`가 자동 동기화합니다 — 수동으로 넣은 값은 덮어써집니다. refs만 편집하세요.',
  )
}

// 필수 필드 검사는 문서 전체가 오는 Write(content)일 때만 의미가 있다
if (!('content' in toolInput)) process.exit(0)

const isAtom = /specs\/atoms\//.test(filePath)
const required = isAtom
  ? ['type:', 'id:', 'description:', 'stage:', 'refs:', 'used_by:']
  : ['id:', 'description:', 'status:', 'refs:']
const missing = required.filter((key) => !content.includes(key))
if (missing.length > 0) {
  console.log(
    `경고: frontmatter 필수 필드 누락 가능성 — ${missing.join(' ')} (저장 후 \`tom validate\`로 확인하세요)`,
  )
}
