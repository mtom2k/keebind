// In-browser development mock. When the renderer runs outside Electron
// (plain `vite` browser tab, where the preload bridge is absent) this
// installs an in-memory `window.keebind` so the UI can be developed and
// exercised without Electron. Never active inside the real app: there the
// preload bridge exists before this module runs.
import type {
  Binding,
  KeyEventPayload,
  NavigateRequest,
  PermissionsInfo,
  Settings
} from '../../shared/types'
import { bindingDisplayName, describeAction } from '../../shared/action-summary'

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight'
])

/** Browser KeyboardEvent.code → the names the real listener reports. */
function mockKeyName(code: string, key: string): string {
  if (code.startsWith('Meta')) return 'Command'
  if (code.startsWith('Alt')) return 'Option'
  if (code.startsWith('Control')) return 'Control'
  if (code.startsWith('Shift')) return 'Shift'
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  return code || key
}

export function installDevMock(): void {
  let settings: Settings = {
    theme: 'system',
    launchAtLogin: false,
    bindingsEnabled: true,
    showDockIcon: true,
    showTechnicalDetails: false
  }
  let permissions: PermissionsInfo = {
    platform: 'darwin',
    packaged: false,
    accessibility: 'granted',
    tccIdentity: 'Browser dev mock',
    appPath: '/dev/null',
    staleGrant: false,
    codeIdentity: 'devmockcdhash',
    canReset: false
  }
  let bindings: Binding[] = [
    {
      id: 'mock-1',
      accelerator: 'F13',
      name: 'Open my notes',
      description: 'Open the folder where I keep working notes.',
      enabled: true,
      pinned: true,
      action: { type: 'openPath', target: '/Users/you/Documents/notes' }
    },
    {
      id: 'mock-2',
      accelerator: 'CommandOrControl+Shift+K',
      name: 'Start a work session',
      description: 'Open the apps and website used at the start of work.',
      enabled: true,
      pinned: true,
      action: {
        type: 'workflow',
        steps: [
          { type: 'launchApp', target: 'Safari' },
          { type: 'openUrl', target: 'https://example.com', delayMs: 500 }
        ]
      }
    }
  ]
  const listeners = new Set<(p: KeyEventPayload) => void>()
  const navHandlers = new Set<(r: NavigateRequest) => void>()
  let listening = false

  // Both edges are forwarded: the Key Listener builds chords from held keys and
  // needs keyup to know when a combo ended.
  const forward = (type: 'keydown' | 'keyup') => (e: KeyboardEvent) => {
    if (!listening) return
    e.preventDefault()
    for (const cb of listeners) {
      cb({
        type,
        keycode: e.keyCode,
        keyName: mockKeyName(e.code, e.key),
        modifier: MODIFIER_CODES.has(e.code),
        shift: e.shiftKey,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
        ts: Date.now()
      })
    }
  }
  window.addEventListener('keydown', forward('keydown'))
  window.addEventListener('keyup', forward('keyup'))

  const statuses = () => bindings.map((b) => ({ id: b.id, registered: b.enabled }))

  window.keebind = {
    appInfo: async () => ({
      version: '0.0.0-browser-mock',
      platform: 'darwin',
      electron: '43.2.0',
      chrome: '134.0.0.0',
      node: '22.0.0',
      os: 'macOS 25.2.0 (arm64)'
    }),
    getSettings: async () => settings,
    setSettings: async (patch) => (settings = { ...settings, ...patch }),
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
    reorderBindings: async (ids) => {
      const byId = new Map(bindings.map((binding) => [binding.id, binding]))
      const seen = new Set<string>()
      bindings = [
        ...ids.flatMap((id) => {
          const binding = byId.get(id)
          if (!binding || seen.has(id)) return []
          seen.add(id)
          return [binding]
        }),
        ...bindings.filter((binding) => !seen.has(binding.id))
      ]
      return { bindings, statuses: statuses() }
    },
    runBinding: async (id) => {
      const binding = bindings.find((b) => b.id === id)
      if (!binding) throw new Error('That binding no longer exists.')
      if (
        binding.confirmBeforeRun &&
        !window.confirm(
          [
            `Run “${bindingDisplayName(binding)}”?`,
            '',
            `Binding / hotkey: ${binding.accelerator}`,
            `Name: ${bindingDisplayName(binding)}`,
            `Description: ${binding.description || 'None'}`,
            'Action to perform:',
            describeAction(binding.action)
          ].join('\n')
        )
      ) {
        return { outcome: 'denied' }
      }
      console.info('[dev mock] would run', bindingDisplayName(binding))
      return { outcome: 'ran' }
    },
    getBindingConfirmation: async () =>
      window.location.hash === '#confirmation'
        ? {
            accelerator: 'CommandOrControl+Shift+K',
            displayName: 'Start a work session',
            name: 'Start a work session',
            description: 'Open the apps and website used at the start of work.',
            actionDescription:
              'Workflow with 2 steps:\n1. Launch app: Safari\n2. Open URL: https://example.com (after 500 ms)'
          }
        : null,
    respondBindingConfirmation: async () => {},
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
      return {
        running: true,
        accessibilityGranted: true
      }
    },
    listenerStop: async () => {
      listening = false
      return {
        running: false,
        accessibilityGranted: true
      }
    },
    listenerStatus: async () => ({
      running: listening,
      accessibilityGranted: true
    }),
    openPermissionSettings: async () => {},
    permissionsInfo: async () => permissions,
    requestPermission: async () => permissions,
    revealApp: async () => {},
    resetPermissions: async () => {
      permissions = { ...permissions, staleGrant: false, accessibility: 'denied' }
      return permissions
    },
    // No native dialog in a browser tab, so hand back a believable path.
    pickPath: async (kind) =>
      kind === 'app'
        ? '/Applications/Safari.app'
        : kind === 'folder'
          ? '/Users/you/Documents'
          : '/Users/you/Documents/example.pdf',
    showAbout: async () => {
      window.location.hash = 'about'
      window.location.reload()
    },
    navigate: async (request) => {
      for (const cb of navHandlers) cb(request)
    },
    quit: async () => {
      console.info('[dev mock] would quit KeeBind')
    },
    resizePopover: async () => {},
    hidePopover: async () => {},
    onKeyEvent: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    onNavigate: (cb) => {
      navHandlers.add(cb)
      return () => navHandlers.delete(cb)
    },
    onPopoverRefresh: () => () => {}
  }
}
