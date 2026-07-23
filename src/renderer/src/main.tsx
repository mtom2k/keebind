import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installDevMock } from './devMock'
import './styles.css'
import { AboutView } from './views/AboutView'
import { PopoverView } from './views/PopoverView'

// Outside Electron (browser tab during UI development) there is no preload
// bridge, so install the in-memory mock to keep the UI usable.
if (!('keebind' in window)) installDevMock()

// One bundle, three windows. The main window loads with no hash; the tray
// popover and the About window load the same file with #popover / #about.
const route = window.location.hash.replace('#', '')

const root = (
  <React.StrictMode>
    {route === 'popover' ? (
      <PopoverView />
    ) : route === 'about' ? (
      <AboutView standalone />
    ) : (
      <App />
    )}
  </React.StrictMode>
)

document.body.dataset.route = route || 'main'
createRoot(document.getElementById('root')!).render(root)
