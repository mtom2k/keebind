// QMK basic keycodes (== USB HID usage ids for the basic range) that the
// remap picker offers. Anything else can be entered as raw hex, so advanced
// QMK codes (layers, macros, custom) pass straight through to the firmware.

export interface KeycodeDef {
  code: number
  label: string
}

export interface KeycodeCategory {
  name: string
  keycodes: KeycodeDef[]
}

const letters: KeycodeDef[] = Array.from({ length: 26 }, (_, i) => ({
  code: 0x04 + i,
  label: String.fromCharCode(65 + i)
}))

const numbers: KeycodeDef[] = [
  ...Array.from({ length: 9 }, (_, i) => ({ code: 0x1e + i, label: String(i + 1) })),
  { code: 0x27, label: '0' }
]

const functionKeys: KeycodeDef[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ code: 0x3a + i, label: `F${i + 1}` })),
  ...Array.from({ length: 12 }, (_, i) => ({ code: 0x68 + i, label: `F${i + 13}` }))
]

export const KEYCODE_CATEGORIES: KeycodeCategory[] = [
  {
    name: 'Special',
    keycodes: [
      { code: 0x0000, label: 'None' },
      { code: 0x0001, label: '▽ Transparent' }
    ]
  },
  { name: 'Letters', keycodes: letters },
  { name: 'Numbers', keycodes: numbers },
  { name: 'Function (F1–F24)', keycodes: functionKeys },
  {
    name: 'Editing',
    keycodes: [
      { code: 0x28, label: 'Enter' },
      { code: 0x29, label: 'Esc' },
      { code: 0x2a, label: 'Backspace' },
      { code: 0x2b, label: 'Tab' },
      { code: 0x2c, label: 'Space' },
      { code: 0x49, label: 'Insert' },
      { code: 0x4c, label: 'Delete' }
    ]
  },
  {
    name: 'Symbols',
    keycodes: [
      { code: 0x2d, label: '- _' },
      { code: 0x2e, label: '= +' },
      { code: 0x2f, label: '[ {' },
      { code: 0x30, label: '] }' },
      { code: 0x31, label: '\\ |' },
      { code: 0x33, label: '; :' },
      { code: 0x34, label: "' \"" },
      { code: 0x35, label: '` ~' },
      { code: 0x36, label: ', <' },
      { code: 0x37, label: '. >' },
      { code: 0x38, label: '/ ?' }
    ]
  },
  {
    name: 'Navigation',
    keycodes: [
      { code: 0x4a, label: 'Home' },
      { code: 0x4d, label: 'End' },
      { code: 0x4b, label: 'Page Up' },
      { code: 0x4e, label: 'Page Down' },
      { code: 0x50, label: '←' },
      { code: 0x4f, label: '→' },
      { code: 0x52, label: '↑' },
      { code: 0x51, label: '↓' }
    ]
  },
  {
    name: 'Modifiers',
    keycodes: [
      { code: 0xe0, label: 'L Ctrl' },
      { code: 0xe1, label: 'L Shift' },
      { code: 0xe2, label: 'L Alt' },
      { code: 0xe3, label: 'L GUI (Cmd/Win)' },
      { code: 0xe4, label: 'R Ctrl' },
      { code: 0xe5, label: 'R Shift' },
      { code: 0xe6, label: 'R Alt' },
      { code: 0xe7, label: 'R GUI (Cmd/Win)' },
      { code: 0x39, label: 'Caps Lock' },
      { code: 0x65, label: 'Menu/App' }
    ]
  },
  {
    name: 'System',
    keycodes: [
      { code: 0x46, label: 'Print Screen' },
      { code: 0x47, label: 'Scroll Lock' },
      { code: 0x48, label: 'Pause' },
      { code: 0x53, label: 'Num Lock' }
    ]
  },
  {
    name: 'Numpad',
    keycodes: [
      ...Array.from({ length: 9 }, (_, i) => ({ code: 0x59 + i, label: `Num ${i + 1}` })),
      { code: 0x62, label: 'Num 0' },
      { code: 0x63, label: 'Num .' },
      { code: 0x54, label: 'Num /' },
      { code: 0x55, label: 'Num *' },
      { code: 0x56, label: 'Num -' },
      { code: 0x57, label: 'Num +' },
      { code: 0x58, label: 'Num Enter' },
      { code: 0x67, label: 'Num =' }
    ]
  }
]

const labelByCode = new Map<number, string>()
for (const cat of KEYCODE_CATEGORIES) {
  for (const kc of cat.keycodes) {
    if (!labelByCode.has(kc.code)) labelByCode.set(kc.code, kc.label)
  }
}

export function keycodeLabel(code: number): string {
  return labelByCode.get(code) ?? '0x' + code.toString(16).padStart(4, '0')
}
