import { Fragment, useEffect, useState } from 'react'
import type { ListenerStatus, PermissionsInfo, Platform } from '../../../shared/types'
import { EMPTY_CHORD_STATE, chordToAccelerator, reduceChord, type Chord } from '../chord'
import { Tooltip } from '../components/Tooltip'

/** Renders a chord as keycaps, modifiers included, so a combination reads as
 *  one visual unit instead of "Command + Control + Shift +" as plain text. */
function ChordKeys({ chord, large = false }: { chord: Chord; large?: boolean }) {
  return (
    <span className={`chord ${large ? 'large' : ''}`}>
      {chord.keys.map((k, i) => (
        <Fragment key={`${k.keycode}-${i}`}>
          {i > 0 && <span className="chord-plus">+</span>}
          <kbd className={k.modifier ? 'mod' : ''}>
            {k.symbol && <span className="kbd-symbol">{k.symbol}</span>}
            {k.name}
          </kbd>
        </Fragment>
      ))}
    </span>
  )
}

export function ListenerView({
  platform,
  onOpenSettings,
  onCreateBinding
}: {
  platform: Platform
  onOpenSettings: () => void
  onCreateBinding: (accelerator: string) => void
}) {
  const [status, setStatus] = useState<ListenerStatus | null>(null)
  const [permissions, setPermissions] = useState<PermissionsInfo | null>(null)
  const [chords, setChords] = useState(EMPTY_CHORD_STATE)
  const [copied, setCopied] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  useEffect(() => {
    window.keebind.listenerStatus().then(setStatus)
    window.keebind.permissionsInfo().then(setPermissions)
    window.keebind
      .getSettings()
      .then((settings) => setShowTechnicalDetails(settings.showTechnicalDetails))
  }, [])

  // Re-subscribes if `platform` resolves after the first render, since the labels
  // baked into each chord depend on it.
  useEffect(
    () => window.keebind.onKeyEvent((e) => setChords((s) => reduceChord(s, e, platform))),
    [platform]
  )

  const toggle = async () => {
    if (!status) return
    setStatus(
      status.running ? await window.keebind.listenerStop() : await window.keebind.listenerStart()
    )
    setPermissions(await window.keebind.permissionsInfo())
  }

  // Full permission controls live in Settings; here we only say whether the
  // listener can actually work.
  const permissionsOk =
    permissions?.accessibility === 'granted' && permissions?.inputMonitoring !== 'denied'

  // While keys are down, show what's down; otherwise the last completed chord.
  const shown = chords.current ?? chords.last
  const accelerator = shown && chordToAccelerator(shown, platform)
  const hasHistory = chords.history.length > 0 || chords.last !== null

  const copy = async () => {
    if (!accelerator) return
    try {
      await navigator.clipboard.writeText(accelerator)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      // clipboard blocked, but the accelerator is on screen to copy by hand
    }
  }

  return (
    <div>
      <h1>Key Listener</h1>
      <p className="subtitle">
        Press any key on any connected keyboard or macropad, wired or wireless, and see exactly
        what KeeBind receives. Hold a combination and the whole chord is captured together, so you
        can read off a hotkey like ⌘⌃⇧F before binding it.
      </p>

      {platform === 'darwin' && permissions && (
        <div className={`perm-line ${permissionsOk ? 'ok' : 'missing'}`}>
          <span className="perm-dot" />
          <span>
            {permissionsOk
              ? 'macOS permissions granted.'
              : 'This needs Accessibility and Input Monitoring access before it can see your keys.'}
          </span>
          {!permissionsOk && (
            <>
              <div className="spacer" />
              <Tooltip tip="Go to Settings, where you can grant both permissions">
                <button className="btn small-btn" onClick={onOpenSettings}>
                  Fix in Settings
                </button>
              </Tooltip>
            </>
          )}
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
        <Tooltip tip="Clear the current key and the whole capture history">
          <button
            className="btn"
            disabled={!hasHistory}
            onClick={() => setChords(EMPTY_CHORD_STATE)}
          >
            Clear
          </button>
        </Tooltip>
        {status?.running && (
          <span className="muted small">Listening… press keys on any connected device.</span>
        )}
      </div>

      <div className="key-display">
        {shown ? (
          <>
            <ChordKeys chord={shown} large />
            {showTechnicalDetails && (
              <span className="muted small">
                {shown.keys
                  .filter((k) => !k.modifier)
                  .map((k) => `code ${k.keycode}`)
                  .join(', ')}
              </span>
            )}
            {accelerator && (
              <>
                {showTechnicalDetails && (
                  <Tooltip
                    tip={`Copy "${accelerator}" so you can paste it into a binding's hotkey field`}
                  >
                    <button className="btn small-btn" onClick={copy}>
                      {copied ? '✓ Copied' : 'Copy accelerator'}
                    </button>
                  </Tooltip>
                )}
                <Tooltip tip={`Create a new binding using "${accelerator}"`}>
                  <button
                    className="btn primary small-btn"
                    onClick={() => onCreateBinding(accelerator)}
                  >
                    + Create binding
                  </button>
                </Tooltip>
              </>
            )}
          </>
        ) : (
          <span className="muted">
            {status?.running ? 'Waiting for a key press…' : 'Start the listener, then press any key'}
          </span>
        )}
      </div>

      {chords.history.length > 0 && (
        <table className="key-history">
          <thead>
            <tr>
              <th>Combination</th>
              {showTechnicalDetails && <th>Accelerator</th>}
              {showTechnicalDetails && <th>Keycodes</th>}
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {chords.history.map((chord, i) => (
              <tr key={`${chord.ts}-${i}`}>
                <td>
                  <ChordKeys chord={chord} />
                </td>
                {showTechnicalDetails && (
                  <td className="muted mono">
                    {chordToAccelerator(chord, platform) ?? 'n/a'}
                  </td>
                )}
                {showTechnicalDetails && (
                  <td className="muted">
                    {chord.keys
                      .filter((k) => !k.modifier)
                      .map((k) => k.keycode)
                      .join(', ') || 'n/a'}
                  </td>
                )}
                <td className="muted">{new Date(chord.ts).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
