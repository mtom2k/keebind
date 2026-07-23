import { app } from 'electron'
import { join } from 'node:path'

/** `resources/` ships via electron-builder extraResources; in dev it's in-repo. */
export function resourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

/** Full-colour KeeBind mark: Dock, taskbar, window, Alt-Tab, Windows tray. */
export function appIconPath(): string {
  return join(resourcesDir(), 'icons', 'app-icon.png')
}

/**
 * Tray/menu-bar icon. macOS needs a black-plus-alpha *template* image it
 * recolours for light/dark menu bars, so it gets the stencil lockup of the same
 * mark; Windows renders colour icons in the notification area, so it gets the
 * real logo and matches the taskbar.
 */
export function trayIconPath(): string {
  return process.platform === 'darwin'
    ? join(resourcesDir(), 'icons', 'trayTemplate.png')
    : join(resourcesDir(), 'icons', 'tray-win.png')
}
