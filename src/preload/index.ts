import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  Binding,
  BindingStatus,
  ConflictHit,
  KeyEventPayload,
  ListenerStatus,
  Settings,
  ViaDeviceDetail,
  ViaDeviceSummary
} from '../shared/types'

export interface KeebindApi {
  appInfo(): Promise<AppInfo>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  listBindings(): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  saveBinding(binding: Binding): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  deleteBinding(id: string): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  checkConflicts(accelerator: string, excludeId?: string): Promise<ConflictHit[]>
  listenerStart(): Promise<ListenerStatus>
  listenerStop(): Promise<ListenerStatus>
  listenerStatus(): Promise<ListenerStatus>
  openPermissionSettings(pane: 'accessibility' | 'inputMonitoring'): Promise<void>
  onKeyEvent(cb: (payload: KeyEventPayload) => void): () => void
  viaList(): Promise<ViaDeviceSummary[]>
  viaOpen(path: string): Promise<ViaDeviceDetail>
  viaSetKeycode(args: {
    path: string
    layer: number
    row: number
    col: number
    keycode: number
  }): Promise<{ verified: number }>
  viaImportDefinition(jsonText: string): Promise<{ name: string }>
  viaKeycodes(): Promise<{ name: string; keycodes: { code: number; label: string }[] }[]>
  viaBundledCount(): Promise<number>
}

const api: KeebindApi = {
  appInfo: () => ipcRenderer.invoke('app:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  listBindings: () => ipcRenderer.invoke('bindings:list'),
  saveBinding: (binding) => ipcRenderer.invoke('bindings:save', binding),
  deleteBinding: (id) => ipcRenderer.invoke('bindings:delete', id),
  checkConflicts: (accelerator, excludeId) =>
    ipcRenderer.invoke('bindings:checkConflicts', { accelerator, excludeId }),
  listenerStart: () => ipcRenderer.invoke('listener:start'),
  listenerStop: () => ipcRenderer.invoke('listener:stop'),
  listenerStatus: () => ipcRenderer.invoke('listener:status'),
  openPermissionSettings: (pane) => ipcRenderer.invoke('permissions:open', pane),
  onKeyEvent: (cb) => {
    const handler = (_e: IpcRendererEvent, payload: KeyEventPayload) => cb(payload)
    ipcRenderer.on('listener:key', handler)
    return () => ipcRenderer.removeListener('listener:key', handler)
  },
  viaList: () => ipcRenderer.invoke('via:list'),
  viaOpen: (path) => ipcRenderer.invoke('via:open', path),
  viaSetKeycode: (args) => ipcRenderer.invoke('via:setKeycode', args),
  viaImportDefinition: (jsonText) => ipcRenderer.invoke('via:importDefinition', jsonText),
  viaKeycodes: () => ipcRenderer.invoke('via:keycodes'),
  viaBundledCount: () => ipcRenderer.invoke('via:bundledCount')
}

contextBridge.exposeInMainWorld('keebind', api)
