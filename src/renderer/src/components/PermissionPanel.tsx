import { useState } from 'react'
import type { PermissionsInfo, PermissionState } from '../../../shared/types'
import { Tooltip } from './Tooltip'

const LABELS: Record<PermissionState, string> = {
  granted: 'granted',
  denied: 'not granted',
  'not-applicable': 'not needed'
}

function Badge({ label, state }: { label: string; state: PermissionState }) {
  return (
    <span className={`badge ${state === 'granted' ? 'ok' : ''}`}>
      {label}: {LABELS[state]}
    </span>
  )
}

/**
 * macOS privacy controls. libuiohook's active event tap is gated by
 * Accessibility, which already includes event-listening access. Input
 * Monitoring is for a passive listen-only tap and is not required here.
 */
export function PermissionPanel({
  info,
  onChange
}: {
  info: PermissionsInfo
  onChange: (info: PermissionsInfo) => void
}) {
  const [busy, setBusy] = useState<'accessibility' | 'reset' | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const request = async () => {
    setBusy('accessibility')
    try {
      onChange(await window.keebind.requestPermission())
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

  const allGranted = info.accessibility === 'granted'
  const somethingWrong = !allGranted

  return (
    <>
      {info.staleGrant && (
        <div className="panel alert warning perm-stale-banner">
          <strong>System Settings is showing an old entry.</strong> KeeBind was granted access as a
          previous version, and macOS ties that grant to the exact copy of the app it was given to.
          The row you see ticked belongs to that older build, which is why KeeBind still reports no
          access. Clearing the old record and asking again fixes it.
          <div className="row" style={{ marginTop: 8 }}>
            <Tooltip tip="Removes KeeBind's saved Accessibility record, then you grant it again">
              <button className="btn primary" disabled={busy !== null} onClick={reset}>
                {busy === 'reset' ? 'Clearing…' : 'Clear old records'}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className={`panel ${allGranted ? '' : 'alert warning'}`}>
        <strong>{allGranted ? 'macOS permission' : '⚠ macOS permission needed'}</strong>
        <div className="small" style={{ margin: '4px 0 12px' }}>
          The Key Listener needs Accessibility. Input Monitoring is not required. Hotkey bindings
          work without either permission.
        </div>

        <div className="row perm-row">
          <Badge label="Accessibility" state={info.accessibility} />
          <div className="spacer" />
          <Tooltip tip="Ask macOS for the Accessibility access required by KeeBind's key listener">
            <button className="btn" disabled={busy !== null} onClick={request}>
              {busy === 'accessibility' ? 'Asking macOS…' : 'Request permission'}
            </button>
          </Tooltip>
        </div>

        {!info.packaged && (
          <div className="small perm-note">
            <strong>Development build.</strong> macOS grants permissions to the running bundle,
            which here is <span className="mono">{info.tccIdentity}</span>, not KeeBind. Look for{' '}
            <span className="mono">{info.tccIdentity}</span> (or whichever terminal launched{' '}
            <span className="mono">npm run dev</span>) in the privacy panes. Installed builds
            identify themselves as <strong>KeeBind</strong>.
          </div>
        )}

        {(somethingWrong || showHelp) && (
          <div className="perm-help">
            <button className="link-btn" onClick={() => setShowHelp(!showHelp)}>
              {showHelp ? 'Hide the manual steps' : 'Asked already and it still says no?'}
            </button>
            {showHelp && (
              <div className="small" style={{ marginTop: 8, lineHeight: 1.55 }}>
                Open Accessibility, select the KeeBind row, remove it with the minus button, then
                come back and press Request permission again. If KeeBind is not in the list at all,
                drag it in with the plus button.
                <div className="row wrap" style={{ marginTop: 8, gap: 14 }}>
                  <button
                    className="link-btn"
                    onClick={() => window.keebind.openPermissionSettings()}
                  >
                    Open Accessibility
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
    </>
  )
}
