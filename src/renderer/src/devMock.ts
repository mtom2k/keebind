// In-browser development mock. When the renderer runs outside Electron
// (plain `vite` browser tab, where the preload bridge is absent) this
// installs an in-memory `window.keebind` so the UI can be developed and
// exercised — including a fake 3×3 VIA macropad. Never active inside the
// real app: there the preload bridge exists before this module runs.
import type { Binding, KeyEventPayload, Settings } from '../../shared/types'

export function installDevMock(): void {
  const settings: Settings = { theme: 'system', launchAtLogin: false, bindingsEnabled: true }
  let bindings: Binding[] = []
  const listeners = new Set<(p: KeyEventPayload) => void>()
  let listening = false

  // fake 3×3 macropad: keycodes for Num 1..9
  const keymap = [
    [
      [0x59, 0x5a, 0x5b],
      [0x5c, 0x5d, 0x5e],
      [0x5f, 0x60, 0x61]
    ],
    [
      [0x3a, 0x3b, 0x3c],
      [0x01, 0x01, 0x01],
      [0x01, 0x01, 0x01]
    ]
  ]

  window.addEventListener('keydown', (e) => {
    if (!listening) return
    for (const cb of listeners) {
      cb({
        type: 'keydown',
        keycode: e.keyCode,
        keyName: e.code || e.key,
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
        ts: Date.now()
      })
    }
  })

  const statuses = () => bindings.map((b) => ({ id: b.id, registered: b.enabled }))

  window.keebind = {
    appInfo: async () => ({ version: '0.0.0-browser-mock', platform: 'darwin' }),
    getSettings: async () => settings,
    setSettings: async (patch) => Object.assign(settings, patch),
    listBindings: async () => ({ bindings, statuses: statuses() }),
    saveBinding: async (binding) => {
      const i = bindings.findIndex((b) => b.id === binding.id)
      if (i >= 0) bindings[i] = binding
      else bindings.push(binding)
      return { bindings, statuses: statuses() }
    },
    deleteBinding: async (id) => {
      bindings = bindings.filter((b) => b.id !== id)
      return { bindings, statuses: statuses() }
    },
    checkConflicts: async (accelerator) =>
      accelerator.toLowerCase() === 'command+space'
        ? [
            {
              severity: 'warning',
              combo: 'Command+Space',
              label: 'Spotlight search (mock)',
              note: 'Mock conflict shown for browser development.',
              source: 'os'
            }
          ]
        : [],
    listenerStart: async () => {
      listening = true
      return { running: true, accessibilityGranted: true }
    },
    listenerStop: async () => {
      listening = false
      return { running: false, accessibilityGranted: true }
    },
    listenerStatus: async () => ({ running: listening, accessibilityGranted: true }),
    openPermissionSettings: async () => {},
    onKeyEvent: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    viaList: async () => [
      {
        path: 'mock-device',
        name: 'Mock Macropad 3×3',
        manufacturer: 'Keebind Dev',
        vendorId: 0xfeed,
        productId: 0x0001,
        hasDefinition: true
      }
    ],
    viaOpen: async (path) => ({
      path,
      name: 'Mock Macropad 3×3',
      manufacturer: 'Keebind Dev',
      vendorId: 0xfeed,
      productId: 0x0001,
      hasDefinition: true,
      protocolVersion: 12,
      layerCount: keymap.length,
      matrix: { rows: 3, cols: 3 },
      keys: Array.from({ length: 9 }, (_, i) => ({
        row: Math.floor(i / 3),
        col: i % 3,
        x: i % 3,
        y: Math.floor(i / 3),
        w: 1,
        h: 1
      })),
      keymap: keymap.map((l) => l.map((r) => [...r]))
    }),
    viaSetKeycode: async ({ layer, row, col, keycode }) => {
      keymap[layer][row][col] = keycode
      return { verified: keycode }
    },
    viaImportDefinition: async () => ({ name: 'Mock import' }),
    viaKeycodes: async () => [
      {
        name: 'Numpad',
        keycodes: Array.from({ length: 9 }, (_, i) => ({ code: 0x59 + i, label: `Num ${i + 1}` }))
      },
      {
        name: 'Function',
        keycodes: Array.from({ length: 12 }, (_, i) => ({ code: 0x3a + i, label: `F${i + 1}` }))
      }
    ],
    viaBundledCount: async () => 0
  }
}
