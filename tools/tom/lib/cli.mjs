// tom CLI 진입점 — 인자 파싱과 명령 디스패치
import {
  cmdInit,
  cmdCreate,
  cmdValidate,
  cmdList,
  cmdShow,
  cmdStats,
  cmdWalk,
  cmdPromote,
} from './commands.mjs'

const VALUE_FLAGS = new Set(['type', 'stage', 'depth', 'filename', 'store-index', 'spec-index'])

const USAGE = `사용법: tom <command> [options]

  tom init [--force]                    TOM 프로젝트 초기화 (tom.yaml + MANIFEST.md)
  tom create <type> <name>              atom/spec 템플릿 생성
                                        (--filename F, --store-index N, --spec-index N)
  tom validate [--fix] [--body] [--yaml]
                                        토폴로지 일관성 검사
                                        --fix   used_by 자동 동기화
                                        --body  섹션 완성도 검사
  tom list [--type T] [--stage S] [--orphan] [--yaml]
  tom show <id...> [--frontmatter]
  tom stats [--yaml]
  tom walk <id> [--refs|--used-by] [--depth N]
  tom promote <id> [--dry-run]

실행 위치: tom.yaml이 발견되는 디렉터리 또는 그 하위 (레포 루트에서는 specs/tom.yaml을 자동 탐색)`

function parseArgs(argv) {
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      if (VALUE_FLAGS.has(key)) {
        flags[key] = argv[i + 1]
        i += 1
      } else {
        flags[key] = true
      }
    } else {
      positional.push(token)
    }
  }
  return { flags, positional }
}

export function run(argv, cwd) {
  const [command, ...rest] = argv
  const { flags, positional } = parseArgs(rest)

  switch (command) {
    case 'init':
      return cmdInit({ cwd, force: Boolean(flags.force) })
    case 'create': {
      const [type, name] = positional
      if (!type || !name) return { code: 1, out: '사용법: tom create <type> <name>' }
      return cmdCreate({
        cwd,
        type,
        name,
        filename: flags.filename,
        storeIndex: flags['store-index'] ? Number(flags['store-index']) : 0,
        specIndex: flags['spec-index'] ? Number(flags['spec-index']) : 0,
      })
    }
    case 'validate':
      return cmdValidate({
        cwd,
        fix: Boolean(flags.fix),
        body: Boolean(flags.body),
        yaml: Boolean(flags.yaml),
      })
    case 'list':
      return cmdList({
        cwd,
        type: flags.type,
        stage: flags.stage,
        orphan: Boolean(flags.orphan),
        yaml: Boolean(flags.yaml),
      })
    case 'show': {
      if (positional.length === 0) return { code: 1, out: '사용법: tom show <id...>' }
      return cmdShow({ cwd, ids: positional, frontmatter: Boolean(flags.frontmatter) })
    }
    case 'stats':
      return cmdStats({ cwd, yaml: Boolean(flags.yaml) })
    case 'walk': {
      const [id] = positional
      if (!id) return { code: 1, out: '사용법: tom walk <id> [--refs|--used-by] [--depth N]' }
      return cmdWalk({
        cwd,
        id,
        direction: flags['used-by'] ? 'used_by' : 'refs',
        depth: flags.depth ? Number(flags.depth) : Infinity,
      })
    }
    case 'promote': {
      const [id] = positional
      if (!id) return { code: 1, out: '사용법: tom promote <id> [--dry-run]' }
      return cmdPromote({ cwd, id, dryRun: Boolean(flags['dry-run']) })
    }
    case undefined:
    case 'help':
    case '--help':
      return { code: command === undefined ? 1 : 0, out: USAGE }
    default:
      return { code: 1, out: `알 수 없는 명령: ${command}\n\n${USAGE}` }
  }
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())
if (isDirectRun) {
  try {
    const result = run(process.argv.slice(2), process.cwd())
    if (result.out) process.stdout.write(`${result.out}\n`)
    process.exit(result.code)
  } catch (error) {
    process.stderr.write(`오류: ${error.message}\n`)
    process.exit(1)
  }
}
