import { BrowserWindow, Tray, app, screen } from 'electron'
import { join } from 'node:path'

/**
 * The menu-bar / tray popover: the panel that drops down when you click the
 * KeeBind icon, listing pinned bindings with Run and Edit buttons.
 *
 * It is a real frameless window rather than a native Tray menu because a
 * native menu item is a single click target with no hover state of its own,
 * so it cannot show two separate buttons per row. The native menu is still
 * there on right-click for the app-wide toggles.
 */

const WIDTH = 320
const MIN_HEIGHT = 120
const MAX_HEIGHT = 520
/** Gap between the menu bar / taskbar and the panel. */
const MARGIN = 6

let popover: BrowserWindow | null = null

function loadRoute(win: BrowserWindow, hash: string): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function create(): BrowserWindow {
  if (popover && !popover.isDestroyed()) return popover

  popover = new BrowserWindow({
    width: WIDTH,
    height: MIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    // Menu-bar panels shouldn't take focus away from the app the user is in
    // any longer than the click itself.
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })

  loadRoute(popover, 'popover')

  // Clicking anywhere else dismisses it, the way a menu does.
  popover.on('blur', () => hidePopover())
  popover.on('closed', () => {
    popover = null
  })

  return popover
}

/** Places the panel under the tray icon, kept fully on the display it's on. */
function position(win: BrowserWindow, tray: Tray): void {
  const trayBounds = tray.getBounds()
  const winBounds = win.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x + trayBounds.width / 2,
    y: trayBounds.y + trayBounds.height / 2
  })
  const area = display.workArea

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
  x = Math.min(Math.max(x, area.x + MARGIN), area.x + area.width - winBounds.width - MARGIN)

  // Taskbar at the bottom (Windows) means the panel goes above the icon.
  const below = trayBounds.y <= area.y + area.height / 2
  const y = below
    ? Math.round(trayBounds.y + trayBounds.height + MARGIN)
    : Math.round(trayBounds.y - winBounds.height - MARGIN)

  win.setPosition(x, Math.min(Math.max(y, area.y + MARGIN), area.y + area.height - winBounds.height))
}

export function showPopover(tray: Tray): void {
  const win = create()
  win.webContents.send('popover:refresh')
  position(win, tray)
  win.show()
  win.focus()
}

export function hidePopover(): void {
  if (popover && !popover.isDestroyed() && popover.isVisible()) popover.hide()
}

export function togglePopover(tray: Tray): void {
  if (popover && !popover.isDestroyed() && popover.isVisible()) hidePopover()
  else showPopover(tray)
}

/** The panel grows to fit its content; the renderer reports what it needs. */
export function resizePopover(height: number): void {
  if (!popover || popover.isDestroyed()) return
  const clamped = Math.round(Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT))
  const [x, y] = popover.getPosition()
  const wasVisible = popover.isVisible()
  popover.setBounds({ x, y, width: WIDTH, height: clamped })
  if (wasVisible) popover.show()
}

/** Tells the panel its list changed (a binding was pinned, renamed, deleted). */
export function refreshPopover(): void {
  if (popover && !popover.isDestroyed()) popover.webContents.send('popover:refresh')
}

export function destroyPopover(): void {
  if (popover && !popover.isDestroyed()) popover.destroy()
  popover = null
}

/* ------------------------------------------------------------ About window */

let aboutWindow: BrowserWindow | null = null

/** Small standalone About panel, opened from the tray menu. */
export function showAboutWindow(): void {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show()
    aboutWindow.focus()
    return
  }
  aboutWindow = new BrowserWindow({
    // Sized to the content at 420px wide; the blurb and the fact table need
    // this much room before the buttons get clipped.
    width: 420,
    height: 540,
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'About KeeBind',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js')
    }
  })
  loadRoute(aboutWindow, 'about')
  aboutWindow.on('ready-to-show', () => aboutWindow?.show())
  aboutWindow.on('closed', () => {
    aboutWindow = null
  })
}
