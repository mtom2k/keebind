import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installDevMock } from './devMock'
import './styles.css'
import { AboutView } from './views/AboutView'
import { ConfirmationView } from './views/ConfirmationView'
import { PopoverView } from './views/PopoverView'

// Outside Electron (browser tab during UI development) there is no preload
// bridge, so install the in-memory mock to keep the UI usable.
if (!('keebind' in window)) installDevMock()

// One bundle, four window surfaces. The main window loads with no hash; the
// tray popover, About panel and guarded-run confirmation use hash routes.
const route = window.location.hash.replace('#', '')

const root = (
  <React.StrictMode>
    {route === 'popover' ? (
      <PopoverView />
    ) : route === 'confirmation' ? (
      <ConfirmationView />
    ) : route === 'about' ? (
      <AboutView standalone />
    ) : (
      <App />
    )}
  </React.StrictMode>
)

document.body.dataset.route = route || 'main'
createRoot(document.getElementById('root')!).render(root)
