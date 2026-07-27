import { useEffect, useState } from 'react'
import type { NavigateRequest, Platform } from '../../shared/types'
import { Logo } from './components/Logo'
import { Tooltip } from './components/Tooltip'
import { AboutView } from './views/AboutView'
import { BindingsView } from './views/BindingsView'
import { ListenerView } from './views/ListenerView'
import { SettingsView } from './views/SettingsView'

type View = NavigateRequest['view']

const NAV: { id: View; label: string; tip: string }[] = [
  {
    id: 'bindings',
    label: 'Bindings',
    tip: 'Assign hotkeys to actions: launch apps, open URLs, run multi-step workflows'
  },
  {
    id: 'listener',
    label: 'Key Listener',
    tip: 'Press any key on any connected keyboard and see what KeeBind receives'
  },
  {
    id: 'settings',
    label: 'Settings',
    tip: 'Theme, startup, tray or Dock visibility, and platform settings'
  },
  {
    id: 'about',
    label: 'About',
    tip: 'Version and app info'
  }
]

export function App() {
  const [view, setView] = useState<View>('bindings')
  const [platform, setPlatform] = useState<Platform>('darwin')
  /** Set when the tray popover asks us to open a specific binding. */
  const [focusBindingId, setFocusBindingId] = useState<string | null>(null)
  /** Set when the Key Listener starts a new binding from a captured key. */
  const [draftAccelerator, setDraftAccelerator] = useState<string | null>(null)

  useEffect(() => {
    window.keebind.appInfo().then((info) => setPlatform(info.platform))
  }, [])

  // The tray popover and About window drive the main window through this.
  useEffect(
    () =>
      window.keebind.onNavigate((request) => {
        setView(request.view)
        setFocusBindingId(request.bindingId ?? null)
        setDraftAccelerator(null)
      }),
    []
  )

  const go = (next: View) => {
    setView(next)
    setFocusBindingId(null)
    setDraftAccelerator(null)
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <Logo size={30} />
          <span>KeeBind</span>
        </div>
        {NAV.map((item) => (
          <Tooltip key={item.id} tip={item.tip}>
            <button
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => go(item.id)}
            >
              {item.label}
            </button>
          </Tooltip>
        ))}
      </nav>
      <main className="content">
        {view === 'bindings' && (
          <BindingsView
            platform={platform}
            focusBindingId={focusBindingId}
            draftAccelerator={draftAccelerator}
            onFocusHandled={() => setFocusBindingId(null)}
            onDraftHandled={() => setDraftAccelerator(null)}
          />
        )}
        {view === 'listener' && (
          <ListenerView
            platform={platform}
            onOpenSettings={() => go('settings')}
            onCreateBinding={(accelerator) => {
              setFocusBindingId(null)
              setDraftAccelerator(accelerator)
              setView('bindings')
            }}
          />
        )}
        {view === 'settings' && <SettingsView platform={platform} />}
        {view === 'about' && <AboutView />}
      </main>
    </div>
  )
}
