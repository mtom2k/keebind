import { useEffect, useState } from 'react'
import type { AppInfo, PermissionsInfo, Platform, Settings } from '../../../shared/types'
import { PermissionPanel } from '../components/PermissionPanel'
import { Tooltip } from '../components/Tooltip'

export function SettingsView({ platform }: { platform: Platform }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [permissions, setPermissions] = useState<PermissionsInfo | null>(null)

  useEffect(() => {
    window.keebind.getSettings().then(setSettings)
    window.keebind.appInfo().then(setInfo)
  }, [])

  useEffect(() => {
    if (platform !== 'darwin') return

    let cancelled = false
    let checking = false
    const refreshPermissions = async () => {
      if (checking) return
      checking = true
      try {
        const next = await window.keebind.permissionsInfo()
        if (!cancelled) setPermissions(next)
      } finally {
        checking = false
      }
    }

    void refreshPermissions()
    const timer = window.setInterval(refreshPermissions, 1000)
    window.addEventListener('focus', refreshPermissions)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshPermissions)
    }
  }, [platform])

  const patch = async (p: Partial<Settings>) => {
    setSettings(await window.keebind.setSettings(p))
  }

  if (!settings) return null

  const surface = platform === 'darwin' ? 'menu bar' : 'system tray'

  return (
    <div>
      <h1>Settings</h1>
      <p className="subtitle">Appearance, startup behavior, listener details, and permissions.</p>

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
              Start KeeBind in the {surface} when you log in, so your bindings are always active.
            </div>
          </div>
          <Tooltip tip="Automatically start KeeBind when you log in">
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
            <strong>Show in {platform === 'darwin' ? 'Dock' : 'taskbar'}</strong>
            <div className="muted small">
              Turn off to make KeeBind {surface}-only. It keeps running either way, and the{' '}
              {platform === 'darwin' ? 'menu bar' : 'tray'} icon never goes away.
            </div>
          </div>
          <Tooltip
            tip={`Show the KeeBind icon in the ${platform === 'darwin' ? 'Dock' : 'taskbar'} as well as the ${surface}`}
          >
            <span className="switch">
              <input
                type="checkbox"
                checked={settings.showDockIcon}
                onChange={(e) => patch({ showDockIcon: e.target.checked })}
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

      <div className="panel">
        <div className="row">
          <div style={{ flex: 1 }}>
            <strong>Show technical key details</strong>
            <div className="muted small">
              Show accelerator strings and numeric keycodes in the Key Listener. Useful for
              diagnostics, but hidden by default.
            </div>
          </div>
          <Tooltip tip="Show technical accelerator and keycode details in the Key Listener">
            <span className="switch">
              <input
                type="checkbox"
                checked={settings.showTechnicalDetails}
                onChange={(e) => patch({ showTechnicalDetails: e.target.checked })}
              />
              <span className="track" />
            </span>
          </Tooltip>
        </div>
      </div>

      {platform === 'darwin' && permissions && (
        <PermissionPanel info={permissions} onChange={setPermissions} />
      )}

      <p className="muted small">
        KeeBind {info?.version} ·{' '}
        {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform}
      </p>
    </div>
  )
}
