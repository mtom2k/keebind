import { useEffect, useState } from 'react'
import type { Platform } from '../../shared/types'
import { Tooltip } from './components/Tooltip'
import { BindingsView } from './views/BindingsView'
import { ListenerView } from './views/ListenerView'
import { SettingsView } from './views/SettingsView'
import { ViaView } from './views/ViaView'

type View = 'bindings' | 'listener' | 'via' | 'settings'

const NAV: { id: View; label: string; tip: string }[] = [
  {
    id: 'bindings',
    label: 'Bindings',
    tip: 'Assign hotkeys to actions: launch apps, open URLs, run multi-step workflows'
  },
  {
    id: 'listener',
    label: 'Key Listener',
    tip: 'Press any key on any connected keyboard and see what Keebind receives'
  },
  {
    id: 'via',
    label: 'VIA Devices',
    tip: 'Remap keys directly on VIA-compatible keyboards and macropads'
  },
  {
    id: 'settings',
    label: 'Settings',
    tip: 'Theme, launch at login, and macOS permissions'
  }
]

export function App() {
  const [view, setView] = useState<View>('bindings')
  const [platform, setPlatform] = useState<Platform>('darwin')

  useEffect(() => {
    window.keebind.appInfo().then((info) => setPlatform(info.platform))
  }, [])

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">⌨ Keebind</div>
        {NAV.map((item) => (
          <Tooltip key={item.id} tip={item.tip}>
            <button
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          </Tooltip>
        ))}
      </nav>
      <main className="content">
        {view === 'bindings' && <BindingsView platform={platform} />}
        {view === 'listener' && <ListenerView platform={platform} />}
        {view === 'via' && <ViaView />}
        {view === 'settings' && <SettingsView platform={platform} />}
      </main>
    </div>
  )
}
