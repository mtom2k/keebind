// Captures the README screenshots from the real renderer bundle.
//
// Run with `npm run screenshots` (which builds first). It loads
// out/renderer/index.html in a plain Electron window: with no preload bridge
// present, devMock.ts installs itself, so every shot is the actual UI driven by
// in-memory sample data — no permissions, no hardware, no user config.
//
// Writes docs/screenshots/*.png. Re-run after any visual change so the README
// never shows a stale interface.

import { BrowserWindow, app, nativeTheme } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'docs', 'screenshots')
const pageFile = join(root, 'out', 'renderer', 'index.html')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Sample data for the shots. The two pinned records keep the ids devMock
 * already uses, so the popover window (which mounts before this runs) shows the
 * same pinned pair as the Bindings tab.
 */
const SEED = `
(() => {
  const info = {
    platform: 'darwin',
    packaged: true,
    accessibility: 'granted',
    tccIdentity: 'KeeBind',
    appPath: '/Applications/KeeBind.app',
    staleGrant: false,
    codeIdentity: 'screenshotbuild',
    canReset: true
  }
  window.keebind.permissionsInfo = async () => info
  window.keebind.requestPermission = async () => info
  window.keebind.appInfo = async () => ({
    version: '0.2.9',
    platform: 'darwin',
    electron: '43.2.0',
    chrome: '134.0.0.0',
    node: '22.0.0',
    os: 'macOS 15.2 (arm64)'
  })

  const extra = [
    {
      id: 'shot-3',
      accelerator: 'F16',
      name: 'Deploy staging',
      description: 'Ship the current branch to the staging environment.',
      enabled: true,
      pinned: false,
      confirmBeforeRun: true,
      action: { type: 'shellCommand', target: 'cd ~/work/api && ./deploy staging' }
    },
    {
      id: 'shot-4',
      accelerator: 'Control+Option+D',
      name: 'Open dashboard',
      description: 'Jump straight to the metrics dashboard.',
      enabled: true,
      pinned: false,
      action: { type: 'openUrl', target: 'https://dashboard.example.com' }
    }
  ]
  return Promise.all(extra.map((b) => window.keebind.saveBinding(b)))
})()
`

/**
 * Runs a snippet in the page with the UI helpers in scope. Every injection is
 * wrapped in its own function scope, or a second call would redeclare them.
 *
 * `setValue` exists because React owns input state: assigning `.value`
 * directly never reaches the component, so go through the native setter and
 * let the resulting event bubble.
 */
function run(win, body) {
  return win.webContents.executeJavaScript(`(async () => {
    const setValue = (el, value) => {
      const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
      el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
    }
    const nav = (label) =>
      [...document.querySelectorAll('.nav-item')].find((b) => b.textContent.trim() === label).click()
    const byText = (selector, text) =>
      [...document.querySelectorAll(selector)].find((el) => el.textContent.trim().includes(text))
    // Feeds the dev mock's key listeners the way a real keyboard would.
    const send = (type, code, keyCode, mods = {}) =>
      window.dispatchEvent(new KeyboardEvent(type, { code, keyCode, bubbles: true, ...mods }))
    const holdChord = () => {
      send('keydown', 'MetaLeft', 91, { metaKey: true })
      send('keydown', 'ControlLeft', 17, { metaKey: true, ctrlKey: true })
      send('keydown', 'ShiftLeft', 16, { metaKey: true, ctrlKey: true, shiftKey: true })
      send('keydown', 'KeyF', 70, { metaKey: true, ctrlKey: true, shiftKey: true })
    }
    const releaseChord = () => {
      send('keyup', 'KeyF', 70, { metaKey: true, ctrlKey: true, shiftKey: true })
      send('keyup', 'ShiftLeft', 16, { metaKey: true, ctrlKey: true })
      send('keyup', 'ControlLeft', 17, { metaKey: true })
      send('keyup', 'MetaLeft', 91, {})
    }
    ${body}
  })()`)
}

const SHOTS = [
  {
    file: 'bindings.png',
    theme: 'light',
    width: 1000,
    height: 640,
    async prepare(win) {
      // The view only refetches on mount, so leave the tab and come back.
      await run(win, `nav('Settings')`)
      await wait(300)
      await run(win, `nav('Bindings')`)
    }
  },
  {
    file: 'binding-editor.png',
    theme: 'light',
    width: 1000,
    height: 680,
    async prepare(win) {
      await run(win, `nav('Bindings'); byText('button.btn.primary', 'Add binding').click()`)
      await wait(400)
      await run(
        win,
        `const fields = document.querySelectorAll('.editor-grid input[type=text]')
         setValue(fields[0], 'F17')
         setValue(fields[1], 'Start work session')
         setValue(fields[2], 'Open the apps I always start the day with.')
         setValue(document.querySelector('.editor-action select'), 'workflow')`
      )
      await wait(300)
      await run(
        win,
        `setValue(document.querySelector('.step-fields input[type=text]'), 'Slack')
         byText('button.btn', '+ Add step').click()`
      )
      await wait(300)
      await run(
        win,
        `setValue(document.querySelectorAll('.step-row')[1].querySelector('select'), 'openUrl')`
      )
      await wait(300)
      await run(
        win,
        `const second = document.querySelectorAll('.step-row')[1]
         setValue(second.querySelector('input[type=text]'), 'https://dashboard.example.com')
         setValue(second.querySelector('input[type=number]'), '500')
         document.querySelector('.content').scrollTop = 9999`
      )
    }
  },
  {
    file: 'listener.png',
    theme: 'light',
    width: 1000,
    height: 620,
    async prepare(win) {
      await run(win, `nav('Key Listener')`)
      await wait(400)
      await run(win, `byText('button.btn', 'Start listening').click()`)
      await wait(400)
      // Two completed chords fill the history, then a third is held down for
      // the large live display.
      await run(
        win,
        `holdChord(); releaseChord()
         send('keydown', 'F13', 124, {}); send('keyup', 'F13', 124, {})
         holdChord()`
      )
    }
  },
  {
    file: 'settings.png',
    theme: 'dark',
    width: 1000,
    height: 620,
    async prepare(win) {
      await run(win, `nav('Settings')`)
    }
  },
  {
    file: 'popover.png',
    theme: 'light',
    hash: 'popover',
    width: 320,
    height: 320,
    transparent: true,
    seed: false,
    async prepare(win) {
      // The row's Run / Manage buttons only appear on hover; focusing one hits
      // the same :focus-within rule, so the shot shows the real affordance.
      await win.webContents.executeJavaScript(`
        document.querySelector('.popover-item .icon-btn')?.focus()
      `)
      const height = await win.webContents.executeJavaScript(
        `document.querySelector('.popover').offsetHeight`
      )
      const [x, y] = win.getPosition()
      win.setBounds({ x, y, width: 320, height: Math.ceil(height) })
      await wait(300)
    }
  }
]

async function capture(shot) {
  nativeTheme.themeSource = shot.theme

  const win = new BrowserWindow({
    width: shot.width,
    height: shot.height,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: Boolean(shot.transparent),
    backgroundColor: shot.transparent ? '#00000000' : undefined
  })

  // Chromium occasionally fails a file:// load right after another window was
  // torn down; one retry is enough.
  const options = shot.hash ? { hash: shot.hash } : {}
  try {
    await win.loadFile(pageFile, options)
  } catch {
    await wait(500)
    await win.loadFile(pageFile, options)
  }
  await wait(700)
  if (shot.seed !== false) {
    await win.webContents.executeJavaScript(SEED)
    await wait(400)
  }
  await shot.prepare?.(win)
  await wait(600)

  const image = await win.webContents.capturePage()
  writeFileSync(join(outDir, shot.file), image.toPNG())
  console.log(`${shot.file}  ${image.getSize().width}x${image.getSize().height}`)
  win.destroy()
  await wait(400)
}

// Each shot destroys its window before the next one opens, and Electron's
// default behavior would quit the app at that point.
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  app.dock?.hide()
  mkdirSync(outDir, { recursive: true })
  for (const shot of SHOTS) {
    try {
      await capture(shot)
    } catch (error) {
      console.error(`${shot.file} FAILED:`, error)
    }
  }
  app.quit()
})
