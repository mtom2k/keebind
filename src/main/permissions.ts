import { app, shell, systemPreferences } from 'electron'
import { spawnSync } from 'node:child_process'
import type { PermissionsInfo, PermissionState, Platform } from '../shared/types'
import { pokeEventTap } from './listener'
import { store } from './store'

/**
 * macOS privacy (TCC) plumbing. Three things bit us here, none of them
 * guessable from the Electron API surface:
 *
 * 1. **TCC identifies an app by its code signature, not its name.** With
 *    `identity: null` electron-builder left Electron's own linker signature on
 *    the bundle (`Identifier=Electron`, Info.plist unbound), so macOS could not
 *    attribute the request to KeeBind and fell back to the *responsible
 *    process*, the terminal or agent that launched it. Fixed by ad-hoc signing
 *    in `electron-builder.yml`.
 *
 * 2. **An ad-hoc signature is pinned to the binary's contents.** Run
 *    `codesign -d -r- KeeBind.app` and the designated requirement is bare:
 *    `cdhash H"9d5278..."`. No identifier, no certificate. TCC stores that
 *    requirement when you grant permission, so every rebuild invalidates the
 *    grant, *but the row stays in the privacy pane still ticked*. That is the
 *    "System Settings says granted, KeeBind says not granted" disparity, and
 *    it survives dragging the app to the Trash, because TCC records are keyed
 *    by bundle id and outlive the bundle. `staleGrant` below detects it by
 *    remembering the cdhash we were granted under, and `resetPermissions()`
 *    clears the dead record with `tccutil`.
 *
 * 3. **An app only appears under Input Monitoring once it asks for it.** The
 *    pane lists clients that have requested `kTCCServiceListenEvent`, and
 *    Electron exposes no API for it. Creating the keyboard CGEventTap used by
 *    the listener triggers that request, so the UI invokes it explicitly.
 */

// Electron does not expose an Input Monitoring status query. Keep the state
// unknown after requesting it rather than claiming the event tap was granted.
let inputMonitoring: PermissionState = 'unknown'
let cachedIdentity: string | null | undefined

/** The `.app` bundle (macOS) or executable (Windows) the OS grants access to. */
export function appBundlePath(): string {
  const exe = app.getPath('exe')
  if (process.platform !== 'darwin') return exe
  const marker = '.app/Contents/MacOS/'
  const i = exe.indexOf(marker)
  return i === -1 ? exe : exe.slice(0, i + 4)
}

/** The name macOS shows for us in the privacy panes. */
function tccIdentity(): string {
  const bundle = appBundlePath()
  const base = bundle.split('/').pop() ?? app.getName()
  return base.endsWith('.app') ? base.slice(0, -4) : base
}

/**
 * The running build's cdhash, which is the whole of our designated requirement
 * while we are ad-hoc signed. Read once: it cannot change while we run.
 */
function codeIdentity(): string | null {
  if (cachedIdentity !== undefined) return cachedIdentity
  cachedIdentity = null
  if (process.platform === 'darwin') {
    try {
      // codesign reports on stderr, so capture both streams.
      const out = spawnSync('codesign', ['-d', '--verbose=4', appBundlePath()], {
        encoding: 'utf8',
        timeout: 5000
      })
      const match = `${out.stderr ?? ''}${out.stdout ?? ''}`.match(/^CDHash=([0-9a-f]+)/m)
      if (match) cachedIdentity = match[1]
    } catch {
      // codesign missing or bundle unreadable; identity checks just go quiet
    }
  }
  return cachedIdentity
}

function accessibility(): PermissionState {
  if (process.platform !== 'darwin') return 'not-applicable'
  return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'denied'
}

/** Remembers which build a grant belongs to, so we can spot a stale one later. */
function rememberGrant(state: PermissionsInfo): void {
  if (state.accessibility === 'granted' || state.inputMonitoring === 'granted') {
    const id = codeIdentity()
    if (id) store.setPermissionIdentity(id)
  }
}

export function permissionsInfo(): PermissionsInfo {
  const access = accessibility()
  const identity = codeIdentity()
  const granted = store.permissionIdentity

  // We were granted something under a different build, and the OS now says no.
  // The pane will still be showing that older entry, ticked.
  const staleGrant =
    process.platform === 'darwin' &&
    access === 'denied' &&
    Boolean(granted && identity && granted !== identity)

  return {
    platform: process.platform as Platform,
    packaged: app.isPackaged,
    accessibility: access,
    inputMonitoring: process.platform === 'darwin' ? inputMonitoring : 'not-applicable',
    tccIdentity: tccIdentity(),
    appPath: appBundlePath(),
    staleGrant,
    codeIdentity: identity,
    canReset: process.platform === 'darwin' && app.isPackaged
  }
}

/**
 * Prompts for Accessibility and registers KeeBind in the pane. Unlike the
 * passive check, `prompt: true` is what puts an entry in the list at all.
 */
export function requestAccessibility(): PermissionsInfo {
  if (process.platform === 'darwin') systemPreferences.isTrustedAccessibilityClient(true)
  const info = permissionsInfo()
  rememberGrant(info)
  return info
}

/**
 * Registers KeeBind under Input Monitoring by briefly creating the keyboard
 * event tap used by the Key Listener. macOS does not expose a passive status
 * query, so the reported state remains unknown until the user verifies that
 * events arrive in the listener.
 */
export async function requestInputMonitoring(): Promise<PermissionsInfo> {
  if (process.platform !== 'darwin') return permissionsInfo()

  pokeEventTap()
  inputMonitoring = 'unknown'
  const info = permissionsInfo()
  rememberGrant(info)
  return info
}

/**
 * Clears KeeBind's TCC records so the next request creates fresh ones bound to
 * the running build. This is the fix for a pane that shows a ticked entry the
 * app doesn't actually have. Scoped to our own bundle id, and the user simply
 * grants again afterwards. `tccutil reset` needs no special privileges.
 */
export function resetPermissions(): PermissionsInfo {
  if (process.platform === 'darwin') {
    for (const service of ['Accessibility', 'ListenEvent']) {
      try {
        spawnSync('tccutil', ['reset', service, 'com.keebind.app'], { timeout: 5000 })
      } catch {
        // tccutil refuses on some configurations; the UI falls back to the
        // manual "remove the row with the minus button" instructions.
      }
    }
    inputMonitoring = 'unknown'
    store.setPermissionIdentity(undefined)
  }
  return permissionsInfo()
}

/** Deep-links into the relevant System Settings pane. */
export function openPermissionSettings(pane: 'accessibility' | 'inputMonitoring'): Promise<void> {
  const target =
    pane === 'accessibility'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
  return shell.openExternal(target)
}

/**
 * Reveals the app bundle in Finder so it can be dragged into a privacy pane
 * with the "+" button. This is the fallback when macOS refuses to list us.
 */
export function revealApp(): void {
  shell.showItemInFolder(appBundlePath())
}
