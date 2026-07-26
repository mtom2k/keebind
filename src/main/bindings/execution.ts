import { BrowserWindow, dialog } from 'electron'
import { bindingDisplayName, describeAction } from '../../shared/action-summary'
import type { Binding, BindingRunResult } from '../../shared/types'
import { isPopoverWindow, setPopoverDialogActive } from '../popover'
import { store } from '../store'
import { getMainWindow, showMainWindow } from '../window'
import { notifyActionError, runAction } from './actions'

/** One in-flight execution per binding prevents hotkey repeat or rapid clicks
 * from stacking confirmations or running the action more than once. */
const inFlight = new Map<string, Promise<BindingRunResult>>()

/** Native dialogs are serialized so two different bindings cannot stack
 * prompts on top of one another. */
let confirmationQueue: Promise<void> = Promise.resolve()

async function confirmRun(binding: Binding, parent?: BrowserWindow): Promise<boolean> {
  const previous = confirmationQueue
  let release!: () => void
  confirmationQueue = new Promise<void>((resolve) => {
    release = resolve
  })

  await previous
  try {
    const name = bindingDisplayName(binding)
    const description = binding.description.trim()
    const options: Electron.MessageBoxOptions = {
      type: 'question',
      title: 'Confirm binding',
      message: `Run “${name}”?`,
      detail: [
        `Binding / hotkey: ${binding.accelerator}`,
        `Name: ${name}`,
        `Description: ${description || 'None'}`,
        'Action to perform:',
        describeAction(binding.action)
      ].join('\n'),
      buttons: ['Deny', 'Run binding'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    }

    let owner = parent && !parent.isDestroyed() && parent.isVisible() ? parent : getMainWindow()
    if (!owner || owner.isDestroyed()) {
      showMainWindow()
      owner = getMainWindow()
    }

    const ownerWasVisible = owner?.isVisible() ?? false
    const ownerWasMinimized = owner?.isMinimized() ?? false
    const popoverOwner = isPopoverWindow(owner)

    if (owner) {
      if (ownerWasMinimized) owner.restore()
      if (!ownerWasVisible) owner.show()
      owner.focus()
    }
    if (popoverOwner) setPopoverDialogActive(true)

    try {
      const result = owner
        ? await dialog.showMessageBox(owner, options)
        : await dialog.showMessageBox(options)
      return result.response === 1
    } finally {
      if (popoverOwner) setPopoverDialogActive(false)
      if (owner && !owner.isDestroyed()) {
        if (ownerWasMinimized) owner.minimize()
        else if (!ownerWasVisible) owner.hide()
      }
    }
  } finally {
    release()
  }
}

function bindingRevision(binding: Binding): string {
  return JSON.stringify({
    accelerator: binding.accelerator,
    name: binding.name?.trim() ?? '',
    description: binding.description,
    enabled: binding.enabled,
    confirmBeforeRun: binding.confirmBeforeRun ?? false,
    action: binding.action
  })
}

/** Do not execute an obsolete snapshot if the binding was edited, disabled or
 * deleted while its confirmation was waiting for the user. */
function isCurrentBinding(snapshot: Binding): boolean {
  const current = store.bindings.find((binding) => binding.id === snapshot.id)
  return Boolean(current && bindingRevision(current) === bindingRevision(snapshot))
}

async function executeOnce(binding: Binding, parent?: BrowserWindow): Promise<BindingRunResult> {
  if (binding.confirmBeforeRun && !(await confirmRun(binding, parent))) {
    return { outcome: 'denied' }
  }

  if (!isCurrentBinding(binding)) return { outcome: 'denied' }

  try {
    await runAction(binding.action)
    return { outcome: 'ran' }
  } catch (error) {
    notifyActionError(bindingDisplayName(binding), error)
    throw error
  }
}

/** The sole execution boundary for saved bindings. Every global and manual
 * run path must pass through here so confirmation cannot be bypassed. */
export function executeBinding(
  binding: Binding,
  parent?: BrowserWindow
): Promise<BindingRunResult> {
  const existing = inFlight.get(binding.id)
  if (existing) return existing

  // Keep the exact snapshot shown in the prompt: a concurrent edit cannot
  // replace the action after the user has approved it.
  const snapshot = structuredClone(binding)
  const task = executeOnce(snapshot, parent)
  inFlight.set(binding.id, task)
  void task.then(
    () => inFlight.delete(binding.id),
    () => inFlight.delete(binding.id)
  )
  return task
}
