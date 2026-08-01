import { BrowserWindow, app, dialog, ipcMain, nativeTheme } from 'electron'
import { release } from 'node:os'
import type {
  Binding,
  KeyEventPayload,
  NavigateRequest,
  PickKind,
  Platform,
  Settings
} from '../shared/types'
import { checkConflicts } from './bindings/conflicts'
import { bindingStatuses, refreshBindings } from './bindings/engine'
import { executeBinding } from './bindings/execution'
import { confirmationDetails, respondToConfirmation } from './confirmation'
import { listenerStatus, startListener, stopListener } from './listener'
import {
  openPermissionSettings,
  permissionsInfo,
  requestAccessibility,
  resetPermissions,
  revealApp
} from './permissions'
import { hidePopover, refreshPopover, resizePopover, showAboutWindow } from './popover'
import { store } from './store'
import { updateTrayMenu } from './tray'
import { applyShellVisibility, getMainWindow, setQuitting, showMainWindow } from './window'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function applySettings(settings: Settings): void {
  nativeTheme.themeSource = settings.theme
  applyShellVisibility(settings.showDockIcon)
  try {
    // Only touch login items on a real change: macOS rejects the call for
    // unsigned dev builds, and startup shouldn't spam that error.
    if (app.getLoginItemSettings().openAtLogin !== settings.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin })
    }
  } catch {
    // dev build or restricted environment; the setting only works when packaged
  }
  updateTrayMenu()
}

const OS_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

/** Shows the main window and tells the renderer which view to open. */
export function navigateMainWindow(request: NavigateRequest): void {
  showMainWindow()
  getMainWindow()?.webContents.send('app:navigate', request)
}

export function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform as Platform,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    os: `${OS_NAMES[process.platform] ?? process.platform} ${release()} (${process.arch})`
  }))

  ipcMain.handle('settings:get', () => store.settings)

  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const settings = store.patchSettings(patch)
    applySettings(settings)
    refreshBindings()
    return settings
  })

  ipcMain.handle('bindings:list', () => ({
    bindings: store.bindings,
    statuses: bindingStatuses()
  }))

  ipcMain.handle('bindings:save', (_e, binding: Binding) => {
    const bindings = store.upsertBinding(binding)
    const statuses = refreshBindings()
    refreshPopover()
    return { bindings, statuses }
  })

  ipcMain.handle('bindings:delete', (_e, id: string) => {
    const bindings = store.deleteBinding(id)
    const statuses = refreshBindings()
    refreshPopover()
    return { bindings, statuses }
  })

  ipcMain.handle('bindings:reorder', (_e, ids: string[]) => {
    const bindings = store.reorderBindings(ids)
    // Order does not affect shortcut registration, so preserve the current
    // registrations and only refresh the pinned presentation.
    const statuses = bindingStatuses()
    refreshPopover()
    return { bindings, statuses }
  })

  // Manual and global runs share executeBinding, so confirmation and duplicate
  // suppression apply consistently to every entry point.
  ipcMain.handle('bindings:run', async (event, id: string) => {
    const binding = store.bindings.find((b) => b.id === id)
    if (!binding) throw new Error('That binding no longer exists.')
    const source = BrowserWindow.fromWebContents(event.sender)
    return executeBinding(binding, source ?? undefined)
  })

  ipcMain.handle('confirmation:get', (event) => confirmationDetails(event.sender))
  ipcMain.handle('confirmation:respond', (event, approved: boolean) => {
    respondToConfirmation(event.sender, approved === true)
  })

  ipcMain.handle('bindings:checkConflicts', (_e, args: { accelerator: string; excludeId?: string }) =>
    checkConflicts(args.accelerator, process.platform, store.bindings, args.excludeId)
  )

  ipcMain.handle('listener:start', () =>
    startListener((payload: KeyEventPayload) => broadcast('listener:key', payload))
  )
  ipcMain.handle('listener:stop', () => stopListener())
  ipcMain.handle('listener:status', () => listenerStatus())

  ipcMain.handle('permissions:open', () => openPermissionSettings())
  ipcMain.handle('permissions:info', () => permissionsInfo())
  ipcMain.handle('permissions:request', () => requestAccessibility())
  ipcMain.handle('permissions:reveal', () => revealApp())
  ipcMain.handle('permissions:reset', () => resetPermissions())

  // Browse buttons next to app / file / folder targets. Most people don't
  // know full paths off the top of their head.
  ipcMain.handle('dialog:pick', async (_e, kind: PickKind) => {
    const win = getMainWindow()
    const mac = process.platform === 'darwin'
    const options: Electron.OpenDialogOptions =
      kind === 'folder'
        ? { title: 'Choose a folder', properties: ['openDirectory'] }
        : kind === 'app'
          ? {
              title: 'Choose an application',
              // A .app bundle is really a folder, but macOS dialogs treat
              // packages as files by default, so openFile selects the bundle.
              properties: ['openFile'],
              defaultPath: mac ? '/Applications' : process.env['ProgramFiles'],
              filters: mac
                ? [{ name: 'Applications', extensions: ['app'] }]
                : [{ name: 'Programs', extensions: ['exe', 'bat', 'cmd', 'lnk'] }]
            }
          : { title: 'Choose a file', properties: ['openFile'] }

    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle('popover:resize', (_e, height: number) => resizePopover(height))
  ipcMain.handle('popover:hide', () => {
    // Reply to the invoking renderer before its popover window is destroyed.
    setImmediate(() => hidePopover())
  })
  ipcMain.handle('app:showAbout', () => showAboutWindow())
  ipcMain.handle('app:navigate', (_e, request: NavigateRequest) => navigateMainWindow(request))
  ipcMain.handle('app:quit', () => {
    setQuitting(true)
    app.quit()
  })
}
