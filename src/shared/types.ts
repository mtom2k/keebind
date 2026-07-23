// Shared type contract between main, preload and renderer.
// docs/ARCHITECTURE.md documents how these flow across IPC.

export type Platform = 'darwin' | 'win32' | 'linux'

export type StepType = 'launchApp' | 'openUrl' | 'openPath' | 'shellCommand'
export type ActionType = StepType | 'workflow'

export interface ActionStep {
  type: StepType
  /** App path/name, URL, file path or shell command depending on type */
  target: string
  /** Extra CLI arguments (launchApp only) */
  args?: string
  /** Pause before running this step, in milliseconds */
  delayMs?: number
}

export interface ActionSpec {
  type: ActionType
  target?: string
  args?: string
  steps?: ActionStep[]
}

export interface Binding {
  id: string
  /** Electron accelerator string, e.g. "F13" or "CommandOrControl+Shift+K" */
  accelerator: string
  description: string
  enabled: boolean
  action: ActionSpec
}

/** Result of trying to register a binding with the OS */
export interface BindingStatus {
  id: string
  registered: boolean
}

export interface ConflictHit {
  severity: 'warning' | 'info'
  /** The combo or key that matched, e.g. "Command+Space" or "F13" */
  combo: string
  label: string
  note?: string
  source: 'os' | 'app'
}

export interface KeyEventPayload {
  type: 'keydown' | 'keyup'
  keycode: number
  keyName: string
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
  ts: number
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  launchAtLogin: boolean
  /** Master switch for all hotkey bindings */
  bindingsEnabled: boolean
}

export interface ListenerStatus {
  running: boolean
  /** macOS only: whether the app is a trusted Accessibility client */
  accessibilityGranted: boolean | null
}

export interface ViaDeviceSummary {
  path: string
  name: string
  manufacturer: string
  vendorId: number
  productId: number
  hasDefinition: boolean
}

export interface ViaKeyLayout {
  row: number
  col: number
  x: number
  y: number
  w: number
  h: number
}

export interface ViaDeviceDetail extends ViaDeviceSummary {
  protocolVersion: number
  layerCount: number
  matrix: { rows: number; cols: number }
  keys: ViaKeyLayout[]
  /** keymap[layer][row][col] = QMK keycode */
  keymap: number[][][]
}

export interface AppInfo {
  version: string
  platform: Platform
}
