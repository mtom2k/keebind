import { globalShortcut } from 'electron'
import type { BindingStatus } from '../../shared/types'
import { store } from '../store'
import { executeBinding } from './execution'

let lastStatuses: BindingStatus[] = []

/**
 * Re-registers every enabled binding as an OS global shortcut. Called on
 * startup and after any binding/setting change; registration failures are
 * reported per-binding so the UI can badge them.
 */
export function refreshBindings(): BindingStatus[] {
  globalShortcut.unregisterAll()
  const { settings, bindings } = store
  lastStatuses = bindings.map((binding) => {
    if (!binding.enabled || !settings.bindingsEnabled) {
      return { id: binding.id, registered: false }
    }
    let registered = false
    try {
      registered = globalShortcut.register(binding.accelerator, () => {
        // executeBinding owns confirmation and error notification. The
        // shortcut callback has nowhere to surface a rejected Promise.
        void executeBinding(binding).catch(() => {})
      })
    } catch {
      registered = false
    }
    return { id: binding.id, registered }
  })
  return lastStatuses
}

export function bindingStatuses(): BindingStatus[] {
  return lastStatuses
}
