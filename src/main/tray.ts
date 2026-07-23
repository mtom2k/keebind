import { Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'node:path'
import { store } from './store'
import { refreshBindings } from './bindings/engine'
import { showMainWindow, setQuitting } from './window'

let tray: Tray | null = null

function resourcesDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'resources')
    : join(app.getAppPath(), 'resources')
}

function trayIconPath(): string {
  // macOS wants a black "Template" image it can recolor for light/dark menu
  // bars; Windows gets a white glyph for the (default dark) taskbar.
  return process.platform === 'darwin'
    ? join(resourcesDir(), 'icons', 'trayTemplate.png')
    : join(resourcesDir(), 'icons', 'tray-win.png')
}

export function updateTrayMenu(): void {
  if (!tray) return
  const settings = store.settings
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Keebind',
        toolTip: 'Show the Keebind window',
        click: () => showMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Bindings enabled',
        type: 'checkbox',
        checked: settings.bindingsEnabled,
        toolTip: 'Master switch: enable or disable every hotkey binding at once',
        click: (item) => {
          store.patchSettings({ bindingsEnabled: item.checked })
          refreshBindings()
        }
      },
      {
        label: 'Launch at login',
        type: 'checkbox',
        checked: settings.launchAtLogin,
        toolTip: 'Start Keebind automatically when you log in',
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
        label: 'Quit Keebind',
        toolTip: 'Stop all bindings and quit',
        click: () => {
          setQuitting(true)
          app.quit()
        }
      }
    ])
  )
}

export function createTray(): Tray {
  if (tray) return tray
  const image = nativeImage.createFromPath(trayIconPath())
  tray = new Tray(image)
  tray.setToolTip('Keebind — key bindings and remapping')
  updateTrayMenu()
  // On Windows the context menu is right-click; left-click opens the window.
  tray.on('click', () => {
    if (process.platform !== 'darwin') showMainWindow()
  })
  return tray
}
