// Turns the raw keydown/keyup stream from the listener into chords: the
// whole combination the user held down, not one row per key. Kept out of the
// view so the rules below are readable in one place.
import type { KeyEventPayload, Platform } from '../../shared/types'

export type ModId = 'meta' | 'ctrl' | 'alt' | 'shift'

/** Display order. Matches `acceleratorFromEvent` so the keycaps read in the
 *  same order as the accelerator string we copy out. */
const MOD_ORDER: ModId[] = ['meta', 'ctrl', 'alt', 'shift']

// Modifiers are derived from the event's flags rather than from a real key, so
// they need stable ids for React keys and de-duplication.
const MOD_KEYCODE: Record<ModId, number> = { meta: -1, ctrl: -2, alt: -3, shift: -4 }

export interface ChordKey {
  keycode: number
  /** e.g. "Command", "Shift", "F13" */
  name: string
  /** macOS modifier glyph (⌘ ⌥ ⌃ ⇧), undefined when there isn't one */
  symbol?: string
  modifier: boolean
  mod?: ModId
}

export interface Chord {
  keys: ChordKey[]
  ts: number
}

export interface ChordState {
  /** Non-modifier keys physically down, in press order */
  held: { keycode: number; name: string }[]
  /** What is held right now. Drives the live display. */
  current: Chord | null
  /** Largest chord seen in the current press; committed when it shrinks */
  peak: Chord | null
  /** Last committed chord, which the display falls back to */
  last: Chord | null
  history: Chord[]
}

export const EMPTY_CHORD_STATE: ChordState = {
  held: [],
  current: null,
  peak: null,
  last: null,
  history: []
}

const HISTORY_LIMIT = 50

function modLabel(id: ModId, platform: Platform): { name: string; symbol?: string } {
  const mac = platform === 'darwin'
  switch (id) {
    case 'meta':
      return mac ? { name: 'Command', symbol: '⌘' } : { name: 'Windows', symbol: '⊞' }
    case 'ctrl':
      return { name: 'Control', symbol: mac ? '⌃' : undefined }
    case 'alt':
      return mac ? { name: 'Option', symbol: '⌥' } : { name: 'Alt' }
    case 'shift':
      return { name: 'Shift', symbol: mac ? '⇧' : undefined }
  }
}

/** Maps the listener's display name for a modifier key back to its family. */
function modIdFromName(name: string): ModId | null {
  if (name === 'Command' || name === 'Windows') return 'meta'
  if (name === 'Control') return 'ctrl'
  if (name === 'Option' || name === 'Alt') return 'alt'
  if (name === 'Shift') return 'shift'
  return null
}

/**
 * Folds one key event into the chord state.
 *
 * Two rules make this behave:
 *
 * - **Modifiers come from the event's flags**, not from tracking their own
 *   keydown/keyup. Flags can't get stuck when a keyup is missed: the listener
 *   being started mid-press, or another app grabbing focus during Cmd+Tab.
 * - **A chord is committed when it shrinks below its peak**, and the peak only
 *   grows on keydown. Releasing Cmd+Ctrl+Shift+F therefore records the full
 *   four-key chord once, instead of the four shrinking chords on the way down.
 *
 * Without a modifier held, each key stands alone: key rollover during ordinary
 * typing should read as "A" then "B", never "A + B".
 */
export function reduceChord(
  state: ChordState,
  e: KeyEventPayload,
  platform: Platform
): ChordState {
  const mods = new Set<ModId>()
  if (e.meta) mods.add('meta')
  if (e.ctrl) mods.add('ctrl')
  if (e.alt) mods.add('alt')
  if (e.shift) mods.add('shift')
  // A modifier's own press doesn't always set its flag on that same event, so
  // fold the event itself in. Otherwise pressing Shift alone shows nothing.
  const self = e.modifier ? modIdFromName(e.keyName) : null
  if (self) {
    if (e.type === 'keydown') mods.add(self)
    else mods.delete(self)
  }

  let held = state.held
  if (!e.modifier) {
    held =
      e.type === 'keydown'
        ? held.some((k) => k.keycode === e.keycode)
          ? held
          : [...held, { keycode: e.keycode, name: e.keyName }]
        : held.filter((k) => k.keycode !== e.keycode)
  }

  const active = MOD_ORDER.filter((m) => mods.has(m))
  const grouped = active.length > 0
  const regular = grouped ? held : held.slice(-1)

  const keys: ChordKey[] = [
    ...active.map((m) => ({
      ...modLabel(m, platform),
      keycode: MOD_KEYCODE[m],
      modifier: true,
      mod: m
    })),
    ...regular.map((k) => ({ keycode: k.keycode, name: k.name, modifier: false }))
  ]

  const current = keys.length > 0 ? { keys, ts: e.ts } : null
  const peakLen = state.peak?.keys.length ?? 0
  let { peak, last, history } = state

  const commit = (chord: Chord) => {
    last = chord
    history = [chord, ...history].slice(0, HISTORY_LIMIT)
  }

  if (e.type === 'keydown' && current) {
    if (keys.length > peakLen) {
      peak = current
    } else if (!grouped) {
      // A fresh unmodified key while another is still down: the previous one
      // was its own press.
      if (peak) commit(peak)
      peak = current
    }
  } else if (e.type === 'keyup' && peak && keys.length < peak.keys.length) {
    commit(peak)
    peak = null
  }

  return { held, current, peak, last, history }
}

/* ------------------------------------------------- accelerator export */

const KEY_TOKENS: Record<string, string> = {
  Enter: 'Return',
  NumpadEnter: 'Return',
  Escape: 'Escape',
  Space: 'Space',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Semicolon: ';',
  Equal: '=',
  Comma: ',',
  Minus: '-',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  BracketLeft: '[',
  Backslash: '\\',
  BracketRight: ']',
  Quote: "'",
  NumpadAdd: 'numadd',
  NumpadSubtract: 'numsub',
  NumpadMultiply: 'nummult',
  NumpadDivide: 'numdiv',
  NumpadDecimal: 'numdec',
  PrintScreen: 'PrintScreen',
  ScrollLock: 'Scrolllock',
  NumLock: 'Numlock',
  CapsLock: 'Capslock'
}

function keyToken(name: string): string | null {
  if (/^[A-Z0-9]$/.test(name)) return name
  if (/^F\d{1,2}$/.test(name)) return name
  if (/^Numpad\d$/.test(name)) return `num${name.slice(6)}`
  return KEY_TOKENS[name] ?? null
}

const MOD_TOKEN: Record<ModId, (p: Platform) => string> = {
  meta: (p) => (p === 'darwin' ? 'Command' : 'Super'),
  ctrl: () => 'Control',
  alt: () => 'Alt',
  shift: () => 'Shift'
}

/**
 * Renders a chord as an Electron accelerator that can be pasted straight into
 * the Bindings hotkey field. Null when it isn't expressible as one: an
 * accelerator needs exactly one non-modifier key.
 */
export function chordToAccelerator(chord: Chord, platform: Platform): string | null {
  const regular = chord.keys.filter((k) => !k.modifier)
  if (regular.length !== 1) return null
  const token = keyToken(regular[0].name)
  if (!token) return null
  const mods = chord.keys.filter((k) => k.mod).map((k) => MOD_TOKEN[k.mod!](platform))
  return [...mods, token].join('+')
}
