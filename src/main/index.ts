import { app, globalShortcut } from 'electron'
import { refreshBindings } from './bindings/engine'
import { applySettings, registerIpc } from './ipc'
import { shutdownListener } from './listener'
import { destroyPopover } from './popover'
import { store } from './store'
import { createTray } from './tray'
import { applyShellVisibility, createMainWindow, setQuitting, showMainWindow } from './window'

// Before anything reads it: fixes the process name in dev (packaged builds get
// it from Info.plist / productName) so menus, dialogs and the macOS privacy
// panes say "KeeBind". Case-only change from "Keebind", so the existing
// userData directory is reused on macOS and Windows.
app.setName('KeeBind')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    // Dock/taskbar presence follows the shared "Show in Dock/taskbar" setting; applySettings
    // calls applyShellVisibility. Apply it up front so there is no flicker
    // before the settings round-trip.
    applyShellVisibility(store.settings.showDockIcon)

    registerIpc()
    applySettings(store.settings)
    createMainWindow()
    createTray()
    refreshBindings()
  })

  // Tray app: keep running when the window is closed.
  app.on('window-all-closed', () => {})

  app.on('activate', () => showMainWindow())

  app.on('before-quit', () => {
    setQuitting(true)
    // The popover is frameless and hides on blur, so it would otherwise sit
    // there invisible and keep the app alive.
    destroyPopover()
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    // uiohook's thread would otherwise keep the process alive
    shutdownListener()
  })
}
