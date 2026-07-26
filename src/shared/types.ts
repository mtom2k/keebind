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
  /** Shows up in the menu bar / tray popover for one-click running */
  pinned?: boolean
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
  /** True for Shift/Control/Alt/Meta (either side). The renderer builds
   *  chords from held keys and needs to know which ones are modifiers. */
  modifier: boolean
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
  /** macOS Dock / Windows taskbar presence. Off = tray-only. */
  showDockIcon: boolean
  /** Show accelerator strings and numeric keycodes in the Key Listener. */
  showTechnicalDetails: boolean
}

export interface ListenerStatus {
  running: boolean
  /** macOS only: whether the app is a trusted Accessibility client */
  accessibilityGranted: boolean | null
}

export type PermissionState = 'granted' | 'denied' | 'unknown' | 'not-applicable'

/** macOS privacy state. See src/main/permissions.ts for why this is subtle. */
export interface PermissionsInfo {
  platform: Platform
  /** False under `npm run dev`, where macOS grants to Electron, not KeeBind */
  packaged: boolean
  accessibility: PermissionState
  /** macOS exposes no passive query, so this can remain unknown after a request */
  inputMonitoring: PermissionState
  /** The name macOS lists in the privacy panes for this process */
  tccIdentity: string
  /** The bundle/executable the OS actually grants access to */
  appPath: string
  /**
   * True when macOS still lists a KeeBind entry from an older build. Ad-hoc
   * signatures are pinned to the binary's cdhash, so an update invalidates the
   * grant while the pane keeps showing it as enabled. This is the "it says
   * granted but the app disagrees" case.
   */
  staleGrant: boolean
  /** cdhash of the running build, or null when it can't be read */
  codeIdentity: string | null
  /** Whether `tccutil reset` is available to clear stale entries */
  canReset: boolean
}

export interface AppInfo {
  version: string
  platform: Platform
  /** Runtime versions, shown in About */
  electron: string
  chrome: string
  node: string
  /** e.g. "macOS 15.2 (arm64)" */
  os: string
}

/** Which view the main window should show, pushed from the main process. */
export interface NavigateRequest {
  view: 'bindings' | 'listener' | 'settings' | 'about'
  /** Open this binding for editing once the Bindings view is showing */
  bindingId?: string
}

/** What a Browse button should let the user pick. */
export type PickKind = 'app' | 'file' | 'folder'
