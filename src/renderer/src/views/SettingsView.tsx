import { useEffect, useState } from 'react'
import type { AppInfo, ListenerStatus, Platform, Settings } from '../../../shared/types'
import { Tooltip } from '../components/Tooltip'

export function SettingsView({ platform }: { platform: Platform }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [listener, setListener] = useState<ListenerStatus | null>(null)

  useEffect(() => {
    window.keebind.getSettings().then(setSettings)
    window.keebind.appInfo().then(setInfo)
    window.keebind.listenerStatus().then(setListener)
  }, [])

  const patch = async (p: Partial<Settings>) => {
    setSettings(await window.keebind.setSettings(p))
  }

  if (!settings) return null

  return (
    <div>
      <h1>Settings</h1>
      <p className="subtitle">Appearance, startup behavior, and permissions.</p>

      <div className="panel">
        <div className="row">
          <div style={{ flex: 1 }}>
            <strong>Theme</strong>
            <div className="muted small">Follows your OS by default.</div>
          </div>
          <Tooltip tip="Choose light, dark, or follow the system appearance">
            <select
              value={settings.theme}
              onChange={(e) => patch({ theme: e.target.value as Settings['theme'] })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Tooltip>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <div style={{ flex: 1 }}>
            <strong>Launch at login</strong>
            <div className="muted small">
              Start Keebind in the {platform === 'darwin' ? 'menu bar' : 'system tray'} when you log
              in, so your bindings are always active.
            </div>
          </div>
          <Tooltip tip="Automatically start Keebind when you log in">
            <span className="switch">
              <input
                type="checkbox"
                checked={settings.launchAtLogin}
                onChange={(e) => patch({ launchAtLogin: e.target.checked })}
              />
              <span className="track" />
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <div style={{ flex: 1 }}>
            <strong>Bindings enabled</strong>
            <div className="muted small">
              Master switch for every hotkey binding (also available from the{' '}
              {platform === 'darwin' ? 'menu bar' : 'tray'} icon).
            </div>
          </div>
          <Tooltip tip="Enable or disable all hotkey bindings at once">
            <span className="switch">
              <input
                type="checkbox"
                checked={settings.bindingsEnabled}
                onChange={(e) => patch({ bindingsEnabled: e.target.checked })}
              />
              <span className="track" />
            </span>
          </Tooltip>
        </div>
      </div>

      {platform === 'darwin' && (
        <div className="panel">
          <strong>macOS permissions</strong>
          <div className="muted small" style={{ margin: '4px 0 10px' }}>
            The Key Listener needs Accessibility and Input Monitoring access. Hotkey bindings and
            VIA remapping work without them.
          </div>
          <div className="row">
            <span className={`badge ${listener?.accessibilityGranted ? 'ok' : ''}`}>
              Accessibility: {listener?.accessibilityGranted ? 'granted' : 'not granted'}
            </span>
            <div className="spacer" />
            <Tooltip tip="Open System Settings → Privacy & Security → Accessibility">
              <button
                className="btn"
                onClick={() => window.keebind.openPermissionSettings('accessibility')}
              >
                Accessibility…
              </button>
            </Tooltip>
            <Tooltip tip="Open System Settings → Privacy & Security → Input Monitoring">
              <button
                className="btn"
                onClick={() => window.keebind.openPermissionSettings('inputMonitoring')}
              >
                Input Monitoring…
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      <p className="muted small">
        Keebind {info?.version} · {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform}
      </p>
    </div>
  )
}
