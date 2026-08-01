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
/** Windows can briefly blur and immediately refocus a window while focus is
 * transferred from the notification area. Coalesce that transient pair so the
 * popover is not visibly hidden between the two native events. */
const BLUR_DISMISS_DELAY_MS = 150

let popover: BrowserWindow | null = null
let activeTray: Tray | null = null
/** A show request remains pending until the renderer has refreshed and
 * reported the content height for that opening. */
let showPending = false
let showScheduled = false
let showScheduleToken = 0
let blurTimer: ReturnType<typeof setTimeout> | undefined

function clearBlurTimer(): void {
  if (blurTimer) clearTimeout(blurTimer)
  blurTimer = undefined
}

function loadRoute(win: BrowserWindow, hash: string): void {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
  }
}

function create(): BrowserWindow {
  if (popover && !popover.isDestroyed()) return popover

  const win = new BrowserWindow({
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
  popover = win

  loadRoute(win, 'popover')

  // Clicking anywhere else dismisses it, the way a menu does. Windows may
  // emit a transient blur/focus pair as the notification-area click finishes;
  // delaying dismissal lets the matching focus cancel that native handoff.
  win.on('focus', clearBlurTimer)
  win.on('blur', () => {
    clearBlurTimer()
    blurTimer = setTimeout(() => {
      blurTimer = undefined
      if (popover === win && !win.isDestroyed() && !win.isFocused()) hidePopover()
    }, BLUR_DISMISS_DELAY_MS)
  })
  win.on('closed', () => {
    if (popover !== win) return
    clearBlurTimer()
    popover = null
    activeTray = null
    showPending = false
    showScheduled = false
    showScheduleToken++
  })

  return win
}

/** Defer presentation until the tray click has completed. On Windows, showing
 * and focusing synchronously inside the Tray click callback can immediately
 * hand focus back to the notification area, producing a visible flash. */
function scheduleShow(): void {
  if (showScheduled) return
  showScheduled = true
  const token = ++showScheduleToken
  const win = popover
  const tray = activeTray
  setImmediate(() => {
    if (token !== showScheduleToken) return
    showScheduled = false
    if (!win || win.isDestroyed() || popover !== win || !showPending || !tray || activeTray !== tray) {
      return
    }
    position(win, tray)
    win.show()
    win.focus()
  })
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
  clearBlurTimer()
  activeTray = tray
  const win = create()
  showPending = true
  win.webContents.send('popover:refresh')
  // Every opening waits for PopoverView to reload its bindings and report the
  // resulting height. Reusing the previous measurement made later openings
  // show stale content immediately and then visibly rebuild/reposition.
}

export function hidePopover(): void {
  // Re-showing a previously hidden transparent BrowserWindow causes a native
  // Windows compositor flash. The first creation is stable, so dispose the
  // panel on dismissal and make every later click use that same fresh path.
  destroyPopover()
}

export function isPopoverWindow(candidate?: BrowserWindow | null): boolean {
  return Boolean(candidate && popover && !popover.isDestroyed() && candidate === popover)
}

export function togglePopover(tray: Tray): void {
  if (popover && !popover.isDestroyed() && popover.isVisible()) hidePopover()
  else showPopover(tray)
}

/** The panel grows to fit its content; the renderer reports what it needs. */
export function resizePopover(height: number): void {
  if (!popover || popover.isDestroyed()) return
  const clamped = Math.round(Math.min(Math.max(height, MIN_HEIGHT), MAX_HEIGHT))
  const bounds = popover.getBounds()
  if (bounds.height !== clamped || bounds.width !== WIDTH) {
    popover.setBounds({ x: bounds.x, y: bounds.y, width: WIDTH, height: clamped })
  }
  // Filtering can grow or shrink the window. Re-anchor after every resize so
  // a bottom Windows taskbar grows upward instead of covering the taskbar.
  if (activeTray) position(popover, activeTray)
  if (showPending && !popover.isVisible()) scheduleShow()
}

/** Tells the panel its list changed (a binding was pinned, renamed, deleted). */
export function refreshPopover(): void {
  if (popover && !popover.isDestroyed()) popover.webContents.send('popover:refresh')
}

export function destroyPopover(): void {
  clearBlurTimer()
  const win = popover
  popover = null
  activeTray = null
  showPending = false
  showScheduled = false
  showScheduleToken++
  if (win && !win.isDestroyed()) win.destroy()
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
