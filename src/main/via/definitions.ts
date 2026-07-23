import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ViaKeyLayout } from '../../shared/types'

export interface ViaDefinition {
  name: string
  vendorId: string
  productId: string
  matrix: { rows: number; cols: number }
  layouts: { keymap: unknown[] }
}

function hexKey(vendorId: number, productId: number): string {
  const h = (n: number) => '0x' + n.toString(16).padStart(4, '0')
  return `${h(vendorId)}:${h(productId)}`
}

function bundledIndexPath(): string {
  const dir = app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
  return join(dir, 'via-definitions.json')
}

function customDir(): string {
  return join(app.getPath('userData'), 'via-definitions')
}

let bundled: Record<string, ViaDefinition> | null = null

function bundledIndex(): Record<string, ViaDefinition> {
  if (bundled) return bundled
  try {
    bundled = JSON.parse(readFileSync(bundledIndexPath(), 'utf8'))
  } catch {
    bundled = {}
  }
  return bundled!
}

function loadCustom(vendorId: number, productId: number): ViaDefinition | null {
  const file = join(customDir(), hexKey(vendorId, productId).replace(':', '_') + '.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** Custom (user-imported) definitions take precedence over the bundled set. */
export function findDefinition(vendorId: number, productId: number): ViaDefinition | null {
  return loadCustom(vendorId, productId) ?? bundledIndex()[hexKey(vendorId, productId)] ?? null
}

export function hasDefinition(vendorId: number, productId: number): boolean {
  return findDefinition(vendorId, productId) !== null
}

export function countBundledDefinitions(): number {
  return Object.keys(bundledIndex()).length
}

function parseIdField(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 16) : typeof value === 'number' ? value : NaN
  return Number.isInteger(n) ? n : null
}

/** Validates and stores a user-supplied VIA definition JSON. */
export function importDefinition(jsonText: string): { name: string } {
  const def = JSON.parse(jsonText)
  const vid = parseIdField(def.vendorId)
  const pid = parseIdField(def.productId)
  if (vid === null || pid === null) throw new Error('Definition is missing vendorId/productId')
  if (!def.matrix?.rows || !def.matrix?.cols) throw new Error('Definition is missing matrix.rows/cols')
  if (!Array.isArray(def.layouts?.keymap)) throw new Error('Definition is missing layouts.keymap')
  const normalized: ViaDefinition = {
    name: def.name ?? 'Custom keyboard',
    vendorId: '0x' + vid.toString(16).padStart(4, '0'),
    productId: '0x' + pid.toString(16).padStart(4, '0'),
    matrix: { rows: def.matrix.rows, cols: def.matrix.cols },
    layouts: { keymap: def.layouts.keymap }
  }
  mkdirSync(customDir(), { recursive: true })
  writeFileSync(
    join(customDir(), `${normalized.vendorId}_${normalized.productId}.json`),
    JSON.stringify(normalized)
  )
  return { name: normalized.name }
}

export function listCustomDefinitions(): string[] {
  try {
    return readdirSync(customDir()).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
}

/**
 * Walks a VIA/KLE keymap and produces positioned keys. Key legends in VIA
 * definitions are "row,col" matrix coordinates. Rotation (ergo boards) is
 * ignored for now: rotated keys render at their x/y anchor.
 */
export function parseKleKeymap(rows: unknown[]): ViaKeyLayout[] {
  const keys: ViaKeyLayout[] = []
  let y = 0
  for (const row of rows) {
    if (!Array.isArray(row)) continue // skip KLE metadata objects
    let x = 0
    let w = 1
    let h = 1
    let decal = false
    for (const item of row) {
      if (item && typeof item === 'object') {
        const p = item as Record<string, unknown>
        if (typeof p.x === 'number') x += p.x
        if (typeof p.y === 'number') y += p.y
        if (typeof p.w === 'number') w = p.w
        if (typeof p.h === 'number') h = p.h
        if (typeof p.d === 'boolean') decal = p.d
        continue
      }
      if (typeof item === 'string') {
        const m = /^(\d+),(\d+)/.exec(item)
        if (m && !decal) {
          keys.push({ row: Number(m[1]), col: Number(m[2]), x, y, w, h })
        }
        x += w
        w = 1
        h = 1
        decal = false
      }
    }
    y += 1
  }
  return keys
}
