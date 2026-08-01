import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AppInfo,
  Binding,
  BindingConfirmationDetails,
  BindingRunResult,
  BindingStatus,
  ConflictHit,
  KeyEventPayload,
  ListenerStatus,
  NavigateRequest,
  PermissionsInfo,
  PickKind,
  Settings
} from '../shared/types'

export interface KeeBindApi {
  appInfo(): Promise<AppInfo>
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  listBindings(): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  saveBinding(binding: Binding): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  deleteBinding(id: string): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  /** Persists the Bindings-tab order; pinned bindings inherit the same order */
  reorderBindings(ids: string[]): Promise<{ bindings: Binding[]; statuses: BindingStatus[] }>
  /** Runs a binding now, returning denied when its confirmation is declined */
  runBinding(id: string): Promise<BindingRunResult>
  /** Dedicated confirmation-window contract. Null outside an active prompt. */
  getBindingConfirmation(): Promise<BindingConfirmationDetails | null>
  respondBindingConfirmation(approved: boolean): Promise<void>
  checkConflicts(accelerator: string, excludeId?: string): Promise<ConflictHit[]>
  listenerStart(): Promise<ListenerStatus>
  listenerStop(): Promise<ListenerStatus>
  listenerStatus(): Promise<ListenerStatus>
  openPermissionSettings(): Promise<void>
  permissionsInfo(): Promise<PermissionsInfo>
  /** Prompts and registers KeeBind in the pane. See src/main/permissions.ts */
  requestPermission(): Promise<PermissionsInfo>
  revealApp(): Promise<void>
  /** Clears KeeBind's macOS privacy records so a fresh grant can be made */
  resetPermissions(): Promise<PermissionsInfo>
  /** Opens a native file picker; resolves to null if the user cancels */
  pickPath(kind: PickKind): Promise<string | null>
  showAbout(): Promise<void>
  navigate(request: NavigateRequest): Promise<void>
  quit(): Promise<void>
  /** Tray popover: report the height the content needs, and dismiss */
  resizePopover(height: number): Promise<void>
  hidePopover(): Promise<void>
  onKeyEvent(cb: (payload: KeyEventPayload) => void): () => void
  onNavigate(cb: (request: NavigateRequest) => void): () => void
  /** Fires when the popover is shown or its binding list changes */
  onPopoverRefresh(cb: () => void): () => void
}

const api: KeeBindApi = {
  appInfo: () => ipcRenderer.invoke('app:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  listBindings: () => ipcRenderer.invoke('bindings:list'),
  saveBinding: (binding) => ipcRenderer.invoke('bindings:save', binding),
  deleteBinding: (id) => ipcRenderer.invoke('bindings:delete', id),
  reorderBindings: (ids) => ipcRenderer.invoke('bindings:reorder', ids),
  runBinding: (id) => ipcRenderer.invoke('bindings:run', id),
  getBindingConfirmation: () => ipcRenderer.invoke('confirmation:get'),
  respondBindingConfirmation: (approved) =>
    ipcRenderer.invoke('confirmation:respond', approved),
  checkConflicts: (accelerator, excludeId) =>
    ipcRenderer.invoke('bindings:checkConflicts', { accelerator, excludeId }),
  listenerStart: () => ipcRenderer.invoke('listener:start'),
  listenerStop: () => ipcRenderer.invoke('listener:stop'),
  listenerStatus: () => ipcRenderer.invoke('listener:status'),
  openPermissionSettings: () => ipcRenderer.invoke('permissions:open'),
  permissionsInfo: () => ipcRenderer.invoke('permissions:info'),
  requestPermission: () => ipcRenderer.invoke('permissions:request'),
  revealApp: () => ipcRenderer.invoke('permissions:reveal'),
  resetPermissions: () => ipcRenderer.invoke('permissions:reset'),
  pickPath: (kind) => ipcRenderer.invoke('dialog:pick', kind),
  showAbout: () => ipcRenderer.invoke('app:showAbout'),
  navigate: (request) => ipcRenderer.invoke('app:navigate', request),
  quit: () => ipcRenderer.invoke('app:quit'),
  resizePopover: (height) => ipcRenderer.invoke('popover:resize', height),
  hidePopover: () => ipcRenderer.invoke('popover:hide'),
  onKeyEvent: (cb) => {
    const handler = (_e: IpcRendererEvent, payload: KeyEventPayload) => cb(payload)
    ipcRenderer.on('listener:key', handler)
    return () => ipcRenderer.removeListener('listener:key', handler)
  },
  onNavigate: (cb) => {
    const handler = (_e: IpcRendererEvent, request: NavigateRequest) => cb(request)
    ipcRenderer.on('app:navigate', handler)
    return () => ipcRenderer.removeListener('app:navigate', handler)
  },
  onPopoverRefresh: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('popover:refresh', handler)
    return () => ipcRenderer.removeListener('popover:refresh', handler)
  }
}

contextBridge.exposeInMainWorld('keebind', api)
