import { systemPreferences } from 'electron'
import { uIOhook, UiohookKey, type UiohookKeyboardEvent } from 'uiohook-napi'
import type { KeyEventPayload, ListenerStatus } from '../shared/types'

// Reverse map: uiohook keycode -> display name. Where multiple names share a
// code the first (nicer) name wins; platform-specific names applied below.
const keyNames: Record<number, string> = {}
for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code === 'number' && !(code in keyNames)) keyNames[code] = name
}

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

export function startListener(onEvent: (e: KeyEventPayload) => void): ListenerStatus {
  if (!running) {
    if (!hooked) {
      const forward = (type: 'keydown' | 'keyup') => (e: UiohookKeyboardEvent) => {
        if (!running) return
        onEvent({
          type,
          keycode: e.keycode,
          keyName: displayName(e.keycode),
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
