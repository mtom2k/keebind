import { app, shell, systemPreferences } from 'electron'
import { spawnSync } from 'node:child_process'
import type { PermissionsInfo, PermissionState, Platform } from '../shared/types'
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
 * 3. **KeeBind does not require Input Monitoring.** libuiohook creates an
 *    active `kCGEventTapOptionDefault` tap and explicitly checks
 *    `AXIsProcessTrusted`. Apple documents Accessibility as granting both event
 *    listening and posting; Input Monitoring is the narrower alternative for
 *    passive listen-only taps. Asking for both created a second, nonfunctional
 *    permission flow without adding any capability.
 */

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

export function permissionsInfo(): PermissionsInfo {
  const access = accessibility()
  const identity = codeIdentity()
  const granted = store.permissionIdentity

  // We were granted Accessibility under a different build, and the OS now
  // says no. Its pane can still show that older entry as ticked.
  const staleGrant =
    process.platform === 'darwin' &&
    access === 'denied' &&
    Boolean(identity && granted && granted !== identity)

  const info: PermissionsInfo = {
    platform: process.platform as Platform,
    packaged: app.isPackaged,
    accessibility: access,
    tccIdentity: tccIdentity(),
    appPath: appBundlePath(),
    staleGrant,
    codeIdentity: identity,
    canReset: process.platform === 'darwin' && app.isPackaged
  }

  // Polling observes a grant made while System Settings is in front.
  if (identity && access === 'granted' && granted !== identity) {
    store.setPermissionIdentity(identity)
  }

  return info
}

/**
 * Prompts for Accessibility and registers KeeBind in the pane. Unlike the
 * passive check, `prompt: true` is what puts an entry in the list at all.
 */
export async function requestAccessibility(): Promise<PermissionsInfo> {
  if (process.platform === 'darwin') {
    // `prompt: true` presents macOS's own confirmation dialog. Its Open System
    // Settings button performs the navigation if the user accepts. Opening the
    // pane here as well races ahead of that choice and displays both at once.
    systemPreferences.isTrustedAccessibilityClient(true)
  }
  return permissionsInfo()
}

/**
 * Clears KeeBind's TCC records so the next request creates fresh ones bound to
 * the running build. This is the fix for a pane that shows a ticked entry the
 * app doesn't actually have. Scoped to our own bundle id, and the user simply
 * grants again afterwards. `tccutil reset` needs no special privileges.
 */
export function resetPermissions(): PermissionsInfo {
  if (process.platform === 'darwin') {
    try {
      spawnSync('tccutil', ['reset', 'Accessibility', 'com.keebind.app'], { timeout: 5000 })
    } catch {
      // tccutil refuses on some configurations; the UI falls back to the
      // manual "remove the row with the minus button" instructions.
    }
    store.clearPermissionIdentity()
  }
  return permissionsInfo()
}

/** Deep-links into the Accessibility pane in System Settings. */
export function openPermissionSettings(): Promise<void> {
  return shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
  )
}

/**
 * Reveals the app bundle in Finder so it can be dragged into a privacy pane
 * with the "+" button. This is the fallback when macOS refuses to list us.
 */
export function revealApp(): void {
  shell.showItemInFolder(appBundlePath())
}
