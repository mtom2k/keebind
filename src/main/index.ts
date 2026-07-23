import { app, globalShortcut } from 'electron'
import { refreshBindings } from './bindings/engine'
import { applySettings, registerIpc } from './ipc'
import { shutdownListener } from './listener'
import { store } from './store'
import { createTray } from './tray'
import { createMainWindow, setQuitting, showMainWindow } from './window'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    // Menu-bar/tray app: no Dock icon on macOS (packaged builds also set
    // LSUIElement via electron-builder).
    if (process.platform === 'darwin') app.dock?.hide()

    registerIpc()
    applySettings(store.settings)
    createMainWindow()
    createTray()
    refreshBindings()
  })

  // Tray app: keep running when the window is closed.
  app.on('window-all-closed', () => {})

  app.on('activate', () => showMainWindow())

  app.on('before-quit', () => setQuitting(true))

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    // uiohook's thread would otherwise keep the process alive
    shutdownListener()
  })
}
