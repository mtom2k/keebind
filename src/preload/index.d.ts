import type { KeebindApi } from './index'

declare global {
  interface Window {
    keebind: KeebindApi
  }
}

export {}
