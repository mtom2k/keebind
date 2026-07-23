import { systemPreferences } from 'electron'
import { uIOhook, UiohookKey, type UiohookKeyboardEvent } from 'uiohook-napi'
import type { KeyEventPayload, ListenerStatus } from '../shared/types'

// Reverse map: uiohook keycode -> display name. Where multiple names share a
// code the first (nicer) name wins; platform-specific names applied below.
const keyNames: Record<number, string> = {}
for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code === 'number' && !(code in keyNames)) keyNames[code] = name
}

/** Keycodes for Shift/Control/Alt/Meta on both sides, used to tag events so
 *  the renderer can build chords out of held keys. */
const modifierCodes = new Set<number>(
  (
    ['Shift', 'ShiftRight', 'Ctrl', 'CtrlRight', 'Alt', 'AltRight', 'Meta', 'MetaRight'] as const
  ).flatMap((name) => {
    const code = UiohookKey[name]
    return typeof code === 'number' ? [code] : []
  })
)

function displayName(keycode: number): string {
  let name = keyNames[keycode] ?? `Keycode ${keycode}`
  if (name === 'Meta' || name === 'MetaRight') {
    name = process.platform === 'darwin' ? 'Command' : 'Windows'
  } else if (name === 'Alt' || name === 'AltRight') {
    name = process.platform === 'darwin' ? 'Option' : 'Alt'
  } else if (name === 'Ctrl' || name === 'CtrlRight') {
    name = 'Control'
  } else if (name === 'ShiftRight') {
    name = 'Shift'
  }
  return name
}

let running = false
let hooked = false
// uiohook listeners can only be attached once, so the current consumer lives in
// a variable the handlers read. Binding the first `onEvent` into the closure
// instead would mean any later startListener call was silently ignored.
let handler: ((e: KeyEventPayload) => void) | null = null

function attachOnce(): void {
  if (hooked) return
  const forward = (type: 'keydown' | 'keyup') => (e: UiohookKeyboardEvent) => {
    if (!running || !handler) return
    handler({
      type,
      keycode: e.keycode,
      keyName: displayName(e.keycode),
      modifier: modifierCodes.has(e.keycode),
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
      ts: Date.now()
    })
  }
  uIOhook.on('keydown', forward('keydown'))
  uIOhook.on('keyup', forward('keyup'))
  hooked = true
}

export function startListener(onEvent: (e: KeyEventPayload) => void): ListenerStatus {
  handler = onEvent
  if (!running) {
    attachOnce()
    // On macOS this is the call that makes the OS prompt for
    // Accessibility / Input Monitoring the first time.
    uIOhook.start()
    running = true
  }
  return listenerStatus()
}

export function stopListener(): ListenerStatus {
  if (running) {
    running = false
    uIOhook.stop()
  }
  return listenerStatus()
}

/**
 * Creates and immediately tears down the keyboard event tap. macOS gates that
 * on Input Monitoring, so the attempt is what registers KeeBind in the pane.
 * Used by permissions.ts when no HID keyboard is available to ask with. Does
 * nothing while a real listening session is running, so it can't disturb one.
 */
export function pokeEventTap(): void {
  if (running) return
  try {
    uIOhook.start()
    uIOhook.stop()
  } catch {
    // not permitted yet; the request itself is what mattered
  }
}

export function listenerStatus(): ListenerStatus {
  return {
    running,
    accessibilityGranted:
      process.platform === 'darwin'
        ? systemPreferences.isTrustedAccessibilityClient(false)
        : null
  }
}

/** Must run before quit or the uiohook thread keeps the process alive. */
export function shutdownListener(): void {
  try {
    if (running) uIOhook.stop()
  } catch {
    // already stopped
  }
  running = false
}
