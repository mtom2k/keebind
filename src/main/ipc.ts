import { BrowserWindow, app, ipcMain, nativeTheme, shell } from 'electron'
import type { Binding, KeyEventPayload, Platform, Settings } from '../shared/types'
import { checkConflicts } from './bindings/conflicts'
import { bindingStatuses, refreshBindings } from './bindings/engine'
import { listenerStatus, startListener, stopListener } from './listener'
import { store } from './store'
import { updateTrayMenu } from './tray'
import { countBundledDefinitions, importDefinition } from './via/definitions'
import { listViaDevices, openViaDevice, setViaKeycode } from './via/hid'
import { KEYCODE_CATEGORIES } from './via/keycodes'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function applySettings(settings: Settings): void {
  nativeTheme.themeSource = settings.theme
  try {
    // Only touch login items on a real change: macOS rejects the call for
    // unsigned dev builds, and startup shouldn't spam that error.
    if (app.getLoginItemSettings().openAtLogin !== settings.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin })
    }
  } catch {
    // dev build or restricted environment — setting only works when packaged
  }
  updateTrayMenu()
}

export function registerIpc(): void {
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform as Platform
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
    return { bindings, statuses }
  })

  ipcMain.handle('bindings:delete', (_e, id: string) => {
    const bindings = store.deleteBinding(id)
    const statuses = refreshBindings()
    return { bindings, statuses }
  })

  ipcMain.handle('bindings:checkConflicts', (_e, args: { accelerator: string; excludeId?: string }) =>
    checkConflicts(args.accelerator, process.platform, store.bindings, args.excludeId)
  )

  ipcMain.handle('listener:start', () =>
    startListener((payload: KeyEventPayload) => broadcast('listener:key', payload))
  )
  ipcMain.handle('listener:stop', () => stopListener())
  ipcMain.handle('listener:status', () => listenerStatus())

  ipcMain.handle('permissions:open', (_e, pane: 'accessibility' | 'inputMonitoring') => {
    const target =
      pane === 'accessibility'
        ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        : 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
    return shell.openExternal(target)
  })

  ipcMain.handle('via:list', () => listViaDevices())
  ipcMain.handle('via:open', (_e, path: string) => openViaDevice(path))
  ipcMain.handle(
    'via:setKeycode',
    (_e, args: { path: string; layer: number; row: number; col: number; keycode: number }) =>
      setViaKeycode(args)
  )
  ipcMain.handle('via:importDefinition', (_e, jsonText: string) => importDefinition(jsonText))
  ipcMain.handle('via:keycodes', () => KEYCODE_CATEGORIES)
  ipcMain.handle('via:bundledCount', () => countBundledDefinitions())
}
