import type { Binding, ConflictHit } from '../../shared/types'
import darwinDbJson from '../data/conflicts/darwin.json'
import win32DbJson from '../data/conflicts/win32.json'

interface ConflictDb {
  combos: { combo: string; label: string; severity: 'warning' | 'info'; note?: string }[]
  keyNotes: { key: string; label: string; severity: 'warning' | 'info'; note: string }[]
}

// TS widens JSON string literals, so re-assert the severity union here.
const darwinDb = darwinDbJson as ConflictDb
const win32Db = win32DbJson as ConflictDb

const MODIFIERS: Record<string, string> = {
  cmd: 'Command',
  command: 'Command',
  ctrl: 'Control',
  control: 'Control',
  alt: 'Alt',
  option: 'Alt',
  altgr: 'AltGr',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
  win: 'Super',
  windows: 'Super'
}

const MODIFIER_ORDER = ['Command', 'Control', 'Super', 'Alt', 'AltGr', 'Shift']

export interface NormalizedAccelerator {
  modifiers: string[]
  key: string
  canonical: string
}

/**
 * Canonicalizes an Electron accelerator so equivalent spellings compare equal:
 * "CmdOrCtrl+shift+k" -> "Command+Shift+K" (macOS) / "Control+Shift+K" (Windows).
 * On macOS the Super/Meta modifier is the Command key; on Windows the Win key.
 */
export function normalizeAccelerator(accelerator: string, platform: string): NormalizedAccelerator {
  const primary = platform === 'darwin' ? 'Command' : 'Control'
  const superKey = platform === 'darwin' ? 'Command' : 'Super'
  const mods = new Set<string>()
  let key = ''
  for (const rawToken of accelerator.split('+')) {
    const token = rawToken.trim()
    const lower = token.toLowerCase()
    if (lower === 'commandorcontrol' || lower === 'cmdorctrl') {
      mods.add(primary)
    } else if (lower in MODIFIERS) {
      const mapped = MODIFIERS[lower]
      mods.add(mapped === 'Super' ? superKey : mapped)
    } else if (token) {
      key = token.length === 1 ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1)
    }
  }
  const modifiers = MODIFIER_ORDER.filter((m) => mods.has(m))
  return { modifiers, key, canonical: [...modifiers, key].join('+') }
}

export function checkConflicts(
  accelerator: string,
  platform: string,
  bindings: Binding[],
  excludeId?: string
): ConflictHit[] {
  const hits: ConflictHit[] = []
  const target = normalizeAccelerator(accelerator, platform)
  if (!target.key) return hits

  const db: ConflictDb = platform === 'darwin' ? darwinDb : win32Db

  for (const entry of db.combos) {
    if (normalizeAccelerator(entry.combo, platform).canonical === target.canonical) {
      hits.push({
        severity: entry.severity,
        combo: entry.combo,
        label: entry.label,
        note: entry.note,
        source: 'os'
      })
    }
  }

  // Key-level notes (e.g. F13–F24 guidance) apply to the bare, unmodified key.
  if (target.modifiers.length === 0) {
    for (const entry of db.keyNotes) {
      if (entry.key.toLowerCase() === target.key.toLowerCase()) {
        hits.push({
          severity: entry.severity,
          combo: entry.key,
          label: entry.label,
          note: entry.note,
          source: 'os'
        })
      }
    }
  }

  for (const other of bindings) {
    if (other.id === excludeId) continue
    if (normalizeAccelerator(other.accelerator, platform).canonical === target.canonical) {
      hits.push({
        severity: 'warning',
        combo: other.accelerator,
        label: `Already bound in KeeBind: "${other.description || other.accelerator}"`,
        source: 'app'
      })
    }
  }

  return hits
}
