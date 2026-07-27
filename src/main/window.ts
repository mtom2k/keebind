import { BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { appIconPath } from './paths'

let mainWindow: BrowserWindow | null = null
let quitting = false
let showInDockOrTaskbar = true

// The renderer is designed around a 190px sidebar and a two-column editor.
// Keep enough room for that layout while still allowing a useful, bounded
// amount of user resizing.
export const MAIN_WINDOW_BOUNDS = {
  width: 1000,
  height: 680,
  minWidth: 940,
  minHeight: 600,
  maxWidth: 1200,
  maxHeight: 800
} as const

export function setQuitting(value: boolean): void {
  quitting = value
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

/**
 * Applies the shared "Show in Dock/taskbar" setting to the platform shell.
 * This is called before the main window is created and again for live setting
 * changes, so keep the desired value even when there is no window yet.
 */
export function applyShellVisibility(show: boolean): void {
  showInDockOrTaskbar = show

  if (process.platform === 'darwin' && app.dock) {
    if (show) {
      app.dock.setIcon(nativeImage.createFromPath(appIconPath()))
      app.dock.show()
    } else {
      app.dock.hide()
    }
  } else if (process.platform === 'win32' && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(!show)
  }
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow

  mainWindow = new BrowserWindow({
    ...MAIN_WINDOW_BOUNDS,
    resizable: true,
    // Keep OS maximize/full-screen actions from bypassing the size ceiling.
    maximizable: false,
    fullscreenable: false,
    // Windows has no Dock API: tray-only mode is the BrowserWindow's
    // skipTaskbar flag. The value may have been applied before construction.
    skipTaskbar: process.platform === 'win32' ? !showInDockOrTaskbar : false,
    show: false,
    autoHideMenuBar: true,
    title: 'KeeBind',
    // Windows/Linux take the taskbar + title-bar icon from here; macOS uses the
    // bundle icon (and app.dock.setIcon above).
    icon: nativeImage.createFromPath(appIconPath()),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Closing the window hides it; the app lives in the tray/menu bar.
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function showMainWindow(): void {
  const win = createMainWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
