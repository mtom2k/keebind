import { useEffect, useState } from 'react'
import type { Platform } from '../../../shared/types'
import { Tooltip } from './Tooltip'

const CODE_MAP: Record<string, string> = {
  Space: 'Space',
  Enter: 'Return',
  NumpadEnter: 'Return',
  Backspace: 'Backspace',
  Tab: 'Tab',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  Delete: 'Delete',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  NumpadAdd: 'numadd',
  NumpadSubtract: 'numsub',
  NumpadMultiply: 'nummult',
  NumpadDivide: 'numdiv',
  NumpadDecimal: 'numdec',
  PrintScreen: 'PrintScreen',
  ScrollLock: 'Scrolllock',
  Pause: 'Pause'
}

function keyFromEvent(e: KeyboardEvent): string | null {
  const code = e.code
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F\d{1,2}$/.test(code)) return code
  if (/^Numpad\d$/.test(code)) return 'num' + code.slice(6)
  return CODE_MAP[code] ?? null
}

export function acceleratorFromEvent(e: KeyboardEvent, platform: Platform): string | null {
  const key = keyFromEvent(e)
  if (!key) return null // modifier-only press: keep capturing
  const mods: string[] = []
  if (e.metaKey) mods.push(platform === 'darwin' ? 'Command' : 'Super')
  if (e.ctrlKey) mods.push('Control')
  if (e.altKey) mods.push('Alt')
  if (e.shiftKey) mods.push('Shift')
  return [...mods, key].join('+')
}

interface Props {
  value: string
  platform: Platform
  onChange: (accelerator: string) => void
}

/**
 * Click "Capture", press the desired combo, and the accelerator fills in.
 * Escape cancels the capture; the text field allows manual entry for keys the
 * focused window can't see (Escape itself, or exotic macropad keys).
 *
 * The button has a fixed width because its label changes while capturing, and
 * a wider label used to push the row around.
 */
export function KeyCaptureField({ value, platform, onChange }: Props) {
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!capturing) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        setCapturing(false)
        return
      }
      const acc = acceleratorFromEvent(e, platform)
      if (acc) {
        onChange(acc)
        setCapturing(false)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturing, platform, onChange])

  return (
    <div className="row">
      <input
        type="text"
        value={value}
        placeholder="e.g. F13 or CommandOrControl+Shift+K"
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
      <Tooltip
        tip={
          capturing
            ? 'Press the key or combo you want. Escape cancels.'
            : 'Capture the hotkey by pressing it, instead of typing it out'
        }
      >
        <button
          type="button"
          className={`btn capture-btn ${capturing ? 'primary' : ''}`}
          onClick={() => setCapturing(!capturing)}
        >
          {capturing ? 'Press a key' : 'Capture'}
        </button>
      </Tooltip>
    </div>
  )
}
