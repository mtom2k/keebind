import { BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { appIconPath } from './paths'

let mainWindow: BrowserWindow | null = null
let quitting = false

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
 * macOS only. Packaged builds omit LSUIElement so the Dock icon is present by
 * default; turning "Show in Dock" off hides it at runtime, which is what makes
 * KeeBind a menu-bar-only app without a separate build flavour.
 */
export function applyDockVisibility(show: boolean): void {
  if (process.platform !== 'darwin' || !app.dock) return
  if (show) {
    app.dock.setIcon(nativeImage.createFromPath(appIconPath()))
    app.dock.show()
  } else {
    app.dock.hide()
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
