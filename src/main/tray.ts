import { Tray, Menu, app, nativeImage } from 'electron'
import { store } from './store'
import { refreshBindings } from './bindings/engine'
import { trayIconPath } from './paths'
import { showAboutWindow, togglePopover } from './popover'
import { showMainWindow, setQuitting } from './window'

let tray: Tray | null = null

const TRAY_TOOLTIP = 'KeeBind — Click for pinned bindings; right-click for options.'

/**
 * Left-click opens the pinned-bindings popover (see popover.ts); right-click
 * gets this menu with the app-wide switches. On macOS we deliberately do not
 * call setContextMenu, because that would make left-click open the menu too
 * and there would be no way to reach the popover.
 */
function buildMenu(): Menu {
  const settings = store.settings
  return Menu.buildFromTemplate([
    {
      label: 'Open KeeBind',
      toolTip: 'Show the KeeBind window',
      click: () => showMainWindow()
    },
    {
      label: 'About KeeBind',
      toolTip: 'Version and app info',
      click: () => showAboutWindow()
    },
    { type: 'separator' },
    {
      label: 'Bindings enabled',
      type: 'checkbox',
      checked: settings.bindingsEnabled,
      toolTip: 'Turn every hotkey binding on or off at once',
      click: (item) => {
        store.patchSettings({ bindingsEnabled: item.checked })
        refreshBindings()
      }
    },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: settings.launchAtLogin,
      toolTip: 'Start KeeBind automatically when you log in',
      click: (item) => {
        store.patchSettings({ launchAtLogin: item.checked })
        try {
          app.setLoginItemSettings({ openAtLogin: item.checked })
        } catch {
          // only works in packaged/signed builds
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit KeeBind',
      toolTip: 'Stop all bindings and quit',
      click: () => {
        setQuitting(true)
        app.quit()
      }
    }
  ])
}

export function updateTrayMenu(): void {
  if (!tray) return
  // Windows binds right-click to the attached menu; macOS pops it manually.
  if (process.platform !== 'darwin') tray.setContextMenu(buildMenu())
}

export function createTray(): Tray {
  if (tray) return tray
  tray = new Tray(nativeImage.createFromPath(trayIconPath()))
  // Native hover text for the macOS menu-bar icon and Windows notification
  // area icon. Windows taskbar hover text for the main window comes from its
  // BrowserWindow title ("KeeBind").
  tray.setToolTip(TRAY_TOOLTIP)
  updateTrayMenu()

  tray.on('click', () => togglePopover(tray!))
  // Windows opens the menu attached by setContextMenu automatically. Register
  // the explicit right-click popup only on macOS, where no menu is attached
  // because doing so would hijack the left-click popover.
  if (process.platform === 'darwin') {
    tray.on('right-click', () => tray!.popUpContextMenu(buildMenu()))
  }

  return tray
}
