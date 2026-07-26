import { useState } from 'react'
import type { PermissionsInfo, PermissionState } from '../../../shared/types'
import { Tooltip } from './Tooltip'

const LABELS: Record<PermissionState, string> = {
  granted: 'granted',
  denied: 'not granted',
  unknown: 'not checked yet',
  'not-applicable': 'not needed'
}

function Badge({ label, state }: { label: string; state: PermissionState }) {
  return (
    <span className={`badge ${state === 'granted' ? 'ok' : state === 'unknown' ? 'neutral' : ''}`}>
      {label}: {LABELS[state]}
    </span>
  )
}

type Pane = 'accessibility' | 'inputMonitoring'

/**
 * macOS privacy controls. One button per permission on purpose: "Request" is
 * the only action that does anything useful on its own, because macOS will not
 * list an app in a privacy pane until the app has asked. Opening the pane and
 * clearing stale records are recovery steps, so they sit in the help block
 * below and only get attention when something is actually wrong.
 */
export function PermissionPanel({
  info,
  onChange
}: {
  info: PermissionsInfo
  onChange: (info: PermissionsInfo) => void
}) {
  const [busy, setBusy] = useState<Pane | 'reset' | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const request = async (pane: Pane) => {
    setBusy(pane)
    try {
      onChange(await window.keebind.requestPermission(pane))
    } finally {
      setBusy(null)
    }
  }

  const reset = async () => {
    setBusy('reset')
    try {
      onChange(await window.keebind.resetPermissions())
    } finally {
      setBusy(null)
    }
  }

  const allGranted =
    info.accessibility === 'granted' && info.inputMonitoring !== 'denied'
  const somethingWrong = info.accessibility === 'denied' || info.inputMonitoring === 'denied'

  const row = (pane: Pane, label: string, state: PermissionState, tip: string) => (
    <div className="row perm-row">
      <Badge label={label} state={state} />
      <div className="spacer" />
      <Tooltip tip={tip}>
        <button className="btn" disabled={busy !== null} onClick={() => request(pane)}>
          {busy === pane ? 'Asking macOS…' : 'Request permission'}
        </button>
      </Tooltip>
    </div>
  )

  return (
    <div className={`panel ${allGranted ? '' : 'alert warning'}`}>
      <strong>{allGranted ? 'macOS permissions' : '⚠ macOS permissions needed'}</strong>
      <div className="small" style={{ margin: '4px 0 12px' }}>
        The Key Listener needs Accessibility and Input Monitoring. Hotkey bindings work without
        either.
      </div>

      {row(
        'accessibility',
        'Accessibility',
        info.accessibility,
        'Ask macOS for Accessibility access. This is also what puts KeeBind in the list.'
      )}
      {row(
        'inputMonitoring',
        'Input Monitoring',
        info.inputMonitoring,
        'Ask macOS for Input Monitoring. KeeBind only shows up in that pane once it has asked.'
      )}

      {info.staleGrant && (
        <div className="perm-stale">
          <strong>System Settings is showing an old entry.</strong> KeeBind was granted access as a
          previous version, and macOS ties that grant to the exact copy of the app it was given to.
          The row you see ticked belongs to that older build, which is why KeeBind still reports no
          access. Clearing the old record and asking again fixes it.
          <div className="row" style={{ marginTop: 8 }}>
            <Tooltip tip="Removes KeeBind's saved Accessibility and Input Monitoring records, then you grant again">
              <button className="btn primary" disabled={busy !== null} onClick={reset}>
                {busy === 'reset' ? 'Clearing…' : 'Clear old records'}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {!info.packaged && (
        <div className="small perm-note">
          <strong>Development build.</strong> macOS grants permissions to the running bundle, which
          here is <span className="mono">{info.tccIdentity}</span>, not KeeBind. Look for{' '}
          <span className="mono">{info.tccIdentity}</span> (or whichever terminal launched{' '}
          <span className="mono">npm run dev</span>) in the privacy panes. Installed builds identify
          themselves as <strong>KeeBind</strong>.
        </div>
      )}

      {(somethingWrong || showHelp) && (
        <div className="perm-help">
          <button className="link-btn" onClick={() => setShowHelp(!showHelp)}>
            {showHelp ? 'Hide the manual steps' : 'Asked already and it still says no?'}
          </button>
          {showHelp && (
            <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>
              Open the pane, select the KeeBind row, remove it with the minus button, then come back
              and press Request permission again. If KeeBind is not in the list at all, drag it in
              with the plus button.
              <div className="row wrap" style={{ marginTop: 8, gap: 14 }}>
                <button
                  className="link-btn"
                  onClick={() => window.keebind.openPermissionSettings('accessibility')}
                >
                  Open Accessibility
                </button>
                <button
                  className="link-btn"
                  onClick={() => window.keebind.openPermissionSettings('inputMonitoring')}
                >
                  Open Input Monitoring
                </button>
                <button className="link-btn" onClick={() => window.keebind.revealApp()}>
                  Show KeeBind in Finder
                </button>
                {info.canReset && !info.staleGrant && (
                  <button className="link-btn" disabled={busy !== null} onClick={reset}>
                    Clear saved records
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
