import { useEffect, useState } from 'react'
import type { AppInfo } from '../../../shared/types'
import { Logo } from '../components/Logo'
import { Tooltip } from '../components/Tooltip'

const PLATFORM_LABEL: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux'
}

/**
 * Shown two ways: as the About tab inside the main window, and on its own in
 * the small window the tray menu opens (`standalone`). Same content either
 * way, so there's only one place to update.
 */
export function AboutView({ standalone = false }: { standalone?: boolean }) {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.keebind.appInfo().then(setInfo)
  }, [])

  const rows: [string, string][] = info
    ? [
        ['Version', info.version],
        ['Platform', `${PLATFORM_LABEL[info.platform] ?? info.platform}`],
        ['System', info.os],
        ['Electron', info.electron],
        ['Chromium', info.chrome],
        ['Node', info.node]
      ]
    : []

  return (
    <div className={standalone ? 'about standalone' : 'about'}>
      <div className="about-head">
        <Logo size={standalone ? 64 : 56} />
        <div>
          <h1 className="about-name">KeeBind</h1>
          <div className="muted">Version {info?.version ?? '…'}</div>
        </div>
      </div>

      <p className="about-blurb">
        A keybinder and remapper for keyboards and macropads. KeeBind lives in your{' '}
        {info?.platform === 'win32' ? 'system tray' : 'menu bar'} and does four things: it shows you
        exactly what keys your hardware sends, binds hotkeys to actions like launching an app or
        running a workflow, warns you when a hotkey clashes with something the OS already owns, and
        remaps VIA keyboards in their own memory so the change travels with the board.
      </p>

      <dl className="about-facts">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <p className="muted small about-note">
        Pin any binding to reach it from the {info?.platform === 'win32' ? 'tray' : 'menu bar'}.
        Hotkeys keep working while the window is closed. Quitting from the tray menu stops them.
      </p>

      {standalone && (
        <div className="row about-buttons">
          <div className="spacer" />
          <Tooltip tip="Open the main KeeBind window">
            <button
              className="btn"
              onClick={() => window.keebind.navigate({ view: 'bindings' })}
            >
              Open KeeBind
            </button>
          </Tooltip>
          <button className="btn primary" onClick={() => window.close()}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
