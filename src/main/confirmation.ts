import { BrowserWindow, app, nativeTheme, screen, type WebContents } from 'electron'
import { join } from 'node:path'
import { bindingDisplayName, describeAction } from '../shared/action-summary'
import type { Binding, BindingConfirmationDetails } from '../shared/types'
import { hidePopover, isPopoverWindow } from './popover'

const WIDTH = 500
const HEIGHT = 410

let confirmationWindow: BrowserWindow | null = null
let activeDetails: BindingConfirmationDetails | null = null
let activeResolve: ((approved: boolean) => void) | null = null

function loadRoute(win: BrowserWindow): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#confirmation`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'confirmation' })
  }
}

function centerWindow(win: BrowserWindow, parent?: BrowserWindow): void {
  const area = parent
    ? parent.getBounds()
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const [width, height] = win.getSize()
  win.setPosition(
    Math.round(area.x + (area.width - width) / 2),
    Math.round(area.y + (area.height - height) / 2)
  )
}

function finish(approved: boolean): void {
  const resolve = activeResolve
  activeResolve = null
  activeDetails = null

  const win = confirmationWindow
  confirmationWindow = null
  if (win && !win.isDestroyed()) win.destroy()

  resolve?.(approved)
}

/**
 * Shows a KeeBind-rendered confirmation without revealing the hidden main
 * window. A visible invoking window owns the prompt; global-hotkey prompts are
 * standalone, centered on the display containing the pointer, and kept above
 * other windows until the user answers.
 */
export function showBindingConfirmation(
  binding: Binding,
  requestedParent?: BrowserWindow
): Promise<boolean> {
  // Replace the tray panel with the confirmation instead of leaving two
  // floating KeeBind surfaces on screen. The main Bindings window remains
  // visible when its own Run button initiated the request.
  const parent =
    requestedParent &&
    !requestedParent.isDestroyed() &&
    requestedParent.isVisible() &&
    !isPopoverWindow(requestedParent)
      ? requestedParent
      : undefined
  if (isPopoverWindow(requestedParent)) hidePopover()

  activeDetails = {
    accelerator: binding.accelerator,
    displayName: bindingDisplayName(binding),
    name: binding.name?.trim() || bindingDisplayName(binding),
    description: binding.description.trim(),
    actionDescription: describeAction(binding.action)
  }

  return new Promise<boolean>((resolve) => {
    activeResolve = resolve

    const win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: !parent,
      parent,
      modal: Boolean(parent),
      title: 'Confirm binding',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#242429' : '#ffffff',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js')
      }
    })
    confirmationWindow = win
    centerWindow(win, parent)

    win.on('ready-to-show', () => {
      if (win.isDestroyed()) return
      win.show()
      win.focus()
    })
    win.webContents.on('did-fail-load', () => finish(false))
    win.on('closed', () => {
      if (confirmationWindow === win) finish(false)
    })

    loadRoute(win)
  })
}

/** Only the active confirmation renderer may read its prompt. */
export function confirmationDetails(sender: WebContents): BindingConfirmationDetails | null {
  return confirmationWindow?.webContents === sender ? activeDetails : null
}

/** Only the active confirmation renderer may approve or deny its prompt. */
export function respondToConfirmation(sender: WebContents, approved: boolean): void {
  if (confirmationWindow?.webContents !== sender) return
  // Let ipcRenderer.invoke receive its reply before destroying the renderer
  // that made the request.
  setImmediate(() => finish(approved))
}

export function destroyConfirmation(): void {
  finish(false)
}

/** On macOS, application activation while a standalone prompt is open should
 * focus that prompt rather than revealing the main window behind it. */
export function focusConfirmation(): boolean {
  if (!confirmationWindow || confirmationWindow.isDestroyed()) return false
  confirmationWindow.show()
  confirmationWindow.focus()
  return true
}
