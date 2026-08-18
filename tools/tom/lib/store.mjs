// tom.yaml 탐색·파싱과 atom/spec 색인 구축
import fs from 'node:fs'
import path from 'node:path'
import { parseDocument } from './frontmatter.mjs'
import { ATOM_TYPE_ORDER } from './schema.mjs'

export const DEFAULT_TOM_YAML = 'stores:\n  - path: ./atoms\nspecs:\n  - path: ./specs\n'

// 실행 위치: tom.yaml이 있는 디렉터리 또는 그 하위 (부록 A).
// 편의를 위해 <cwd>/specs/tom.yaml도 fallback으로 찾는다 (레포 루트 실행 지원).
export function findConfigDir(startDir) {
  let dir = path.resolve(startDir)
  for (;;) {
    if (fs.existsSync(path.join(dir, 'tom.yaml'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  const fallback = path.join(path.resolve(startDir), 'specs')
  if (fs.existsSync(path.join(fallback, 'tom.yaml'))) return fallback
  return null
}

export function parseTomYaml(text) {
  const config = { stores: [], specs: [] }
  let current = null
  for (const line of text.split('\n')) {
    const top = line.match(/^(stores|specs):\s*$/)
    if (top) {
      current = top[1]
      continue
    }
    const item = line.match(/^\s+-\s+path:\s*(.+?)\s*$/)
    if (item && current) config[current] = [...config[current], { path: item[1] }]
  }
  return config
}

export function loadConfig(configDir) {
  const text = fs.readFileSync(path.join(configDir, 'tom.yaml'), 'utf8')
  return parseTomYaml(text)
}

function listMdFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'MANIFEST.md')
    .sort()
    .map((name) => path.join(dir, name))
}

function walkMdFiles(root) {
  const results = []
  const entries = fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) results.push(...walkMdFiles(full))
    else if (entry.name.endsWith('.md') && entry.name !== 'MANIFEST.md') results.push(full)
  }
  return results
}

export function buildIndex(configDir) {
  const config = loadConfig(configDir)
  const atoms = []
  const specs = []

  config.stores.forEach((store, storeIndex) => {
    const root = path.resolve(configDir, store.path)
    for (const type of ATOM_TYPE_ORDER) {
      const typeDir = path.join(root, type)
      if (!fs.existsSync(typeDir)) continue
      for (const file of listMdFiles(typeDir)) {
        const text = fs.readFileSync(file, 'utf8')
        atoms.push({ kind: 'atom', file, dirType: type, storeIndex, storeRoot: root, text, doc: parseDocument(text) })
      }
    }
  })

  config.specs.forEach((specStore, specIndex) => {
    const root = path.resolve(configDir, specStore.path)
    if (!fs.existsSync(root)) return
    for (const file of walkMdFiles(root)) {
      const text = fs.readFileSync(file, 'utf8')
      specs.push({ kind: 'spec', file, specIndex, storeRoot: root, text, doc: parseDocument(text) })
    }
  })

  return { configDir, config, atoms, specs }
}

export function relPath(index, file) {
  return path.relative(index.configDir, file)
}

export function findById(index, id) {
  return [...index.atoms, ...index.specs].find((rec) => rec.doc.fields?.id === id) ?? null
}
