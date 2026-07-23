import { useEffect, useState } from 'react'
import type { KeyEventPayload, ListenerStatus, Platform } from '../../../shared/types'
import { Tooltip } from '../components/Tooltip'

const HISTORY_LIMIT = 50

export function ListenerView({ platform }: { platform: Platform }) {
  const [status, setStatus] = useState<ListenerStatus | null>(null)
  const [last, setLast] = useState<KeyEventPayload | null>(null)
  const [history, setHistory] = useState<KeyEventPayload[]>([])

  useEffect(() => {
    window.keebind.listenerStatus().then(setStatus)
    const unsubscribe = window.keebind.onKeyEvent((payload) => {
      if (payload.type !== 'keydown') return
      setLast(payload)
      setHistory((h) => [payload, ...h].slice(0, HISTORY_LIMIT))
    })
    return unsubscribe
  }, [])

  const toggle = async () => {
    if (!status) return
    setStatus(status.running ? await window.keebind.listenerStop() : await window.keebind.listenerStart())
  }

  const mods = (e: KeyEventPayload) =>
    [
      e.meta && (platform === 'darwin' ? 'Command' : 'Windows'),
      e.ctrl && 'Control',
      e.alt && (platform === 'darwin' ? 'Option' : 'Alt'),
      e.shift && 'Shift'
    ]
      .filter(Boolean)
      .join(' + ')

  return (
    <div>
      <h1>Key Listener</h1>
      <p className="subtitle">
        Press any key on any connected keyboard or macropad — wired, wireless, or Bluetooth — and
        see exactly what Keebind receives.
      </p>

      {platform === 'darwin' && status && status.accessibilityGranted === false && (
        <div className="alert warning">
          <strong>⚠ macOS permissions needed.</strong> Global key listening requires Accessibility
          and Input Monitoring access. Grant both to Keebind (or to Electron during development),
          then restart the listener.
          <div className="row" style={{ marginTop: 8 }}>
            <Tooltip tip="Open System Settings → Privacy & Security → Accessibility">
              <button
                className="btn"
                onClick={() => window.keebind.openPermissionSettings('accessibility')}
              >
                Accessibility settings
              </button>
            </Tooltip>
            <Tooltip tip="Open System Settings → Privacy & Security → Input Monitoring">
              <button
                className="btn"
                onClick={() => window.keebind.openPermissionSettings('inputMonitoring')}
              >
                Input Monitoring settings
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="row" style={{ marginBottom: 14 }}>
        <Tooltip
          tip={
            status?.running
              ? 'Stop listening to global key presses'
              : 'Start listening to global key presses (macOS will ask for permission the first time)'
          }
        >
          <button className={`btn ${status?.running ? '' : 'primary'}`} onClick={toggle}>
            {status?.running ? '■ Stop listening' : '▶ Start listening'}
          </button>
        </Tooltip>
        {status?.running && (
          <span className="muted small">Listening… press keys on any connected device.</span>
        )}
      </div>

      <div className="key-display">
        {last ? (
          <>
            {mods(last) && <span className="muted">{mods(last)} +</span>}
            <kbd>{last.keyName}</kbd>
            <span className="muted small">code {last.keycode}</span>
          </>
        ) : (
          <span className="muted">
            {status?.running ? 'Waiting for a key press…' : 'Start the listener, then press any key'}
          </span>
        )}
      </div>

      {history.length > 0 && (
        <table className="key-history">
          <thead>
            <tr>
              <th>Key</th>
              <th>Modifiers</th>
              <th>Keycode</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {history.map((e, i) => (
              <tr key={`${e.ts}-${i}`}>
                <td>
                  <kbd>{e.keyName}</kbd>
                </td>
                <td className="muted">{mods(e) || '—'}</td>
                <td className="muted">{e.keycode}</td>
                <td className="muted">{new Date(e.ts).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
