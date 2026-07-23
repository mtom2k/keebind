import type { KeeBindApi } from './index'

declare global {
  interface Window {
    keebind: KeeBindApi
  }
}

export {}
