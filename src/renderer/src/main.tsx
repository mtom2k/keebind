import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { installDevMock } from './devMock'
import './styles.css'

// Outside Electron (browser tab during UI development) there is no preload
// bridge — install the in-memory mock so the UI stays usable.
if (!('keebind' in window)) installDevMock()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
