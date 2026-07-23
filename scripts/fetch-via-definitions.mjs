// Downloads the official VIA keyboard definitions (github.com/the-via/keyboards)
// and packs the ones Keebind can use into resources/via-definitions.json,
// indexed by "vendorId:productId" (lowercase hex, e.g. "0x445a:0x1421").
//
// Run on demand with: npm run via:definitions
// The app works without this file (devices then require a custom definition
// import), so this script is optional and needs network access.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync, createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARBALL = 'https://codeload.github.com/the-via/keyboards/tar.gz/refs/heads/master'

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (name.endsWith('.json')) yield p
  }
}

function normHex(v) {
  const n = typeof v === 'string' ? parseInt(v, 16) : v
  if (!Number.isInteger(n)) return null
  return '0x' + n.toString(16).padStart(4, '0')
}

const tmp = mkdtempSync(join(tmpdir(), 'via-defs-'))
try {
  console.log('Downloading the-via/keyboards ...')
  const res = await fetch(TARBALL)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`)
  const tarPath = join(tmp, 'keyboards.tar.gz')
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tarPath))
  execFileSync('tar', ['xzf', tarPath, '-C', tmp])

  const repoDir = readdirSync(tmp).find((n) => n.startsWith('keyboards-'))
  if (!repoDir) throw new Error('Unexpected tarball layout')

  const index = {}
  let total = 0
  let usable = 0
  for (const file of walk(join(tmp, repoDir))) {
    total++
    let def
    try {
      def = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    const vid = normHex(def.vendorId)
    const pid = normHex(def.productId)
    const keymap = def.layouts?.keymap
    const matrix = def.matrix
    if (!vid || !pid || !Array.isArray(keymap) || !matrix?.rows || !matrix?.cols) continue
    index[`${vid}:${pid}`] = {
      name: def.name ?? 'Unknown keyboard',
      vendorId: vid,
      productId: pid,
      matrix: { rows: matrix.rows, cols: matrix.cols },
      layouts: { keymap }
    }
    usable++
  }

  const outPath = join(root, 'resources', 'via-definitions.json')
  writeFileSync(outPath, JSON.stringify(index))
  console.log(`Scanned ${total} JSON files, packed ${usable} definitions -> ${outPath}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
