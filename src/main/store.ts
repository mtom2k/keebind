import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Binding, Settings } from '../shared/types'

interface StoreData {
  settings: Settings
  bindings: Binding[]
  /**
   * cdhash of the build that last received Accessibility. Compared against the
   * running binary to spot an old privacy-pane record.
   */
  permissionIdentity?: string
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  launchAtLogin: false,
  bindingsEnabled: true,
  showDockIcon: true,
  showTechnicalDetails: false
}

// Deliberately tiny hand-rolled JSON store instead of electron-store:
// zero dependencies, no ESM/CJS friction, trivially debuggable
// (see docs/DECISIONS.md).
class Store {
  private data: StoreData | null = null

  private get file(): string {
    return join(app.getPath('userData'), 'config.json')
  }

  private load(): StoreData {
    if (this.data) return this.data
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8'))
      const savedIdentities =
        raw.permissionIdentities && typeof raw.permissionIdentities === 'object'
          ? raw.permissionIdentities
          : {}
      this.data = {
        settings: { ...DEFAULT_SETTINGS, ...raw.settings },
        bindings: Array.isArray(raw.bindings) ? raw.bindings : [],
        permissionIdentity:
          typeof raw.permissionIdentity === 'string'
            ? raw.permissionIdentity
            : typeof savedIdentities.accessibility === 'string'
              ? savedIdentities.accessibility
              : undefined
      }
    } catch {
      this.data = { settings: { ...DEFAULT_SETTINGS }, bindings: [] }
    }
    return this.data
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.load(), null, 2))
  }

  get settings(): Settings {
    return this.load().settings
  }

  get bindings(): Binding[] {
    return this.load().bindings
  }

  get permissionIdentity(): string | undefined {
    return this.load().permissionIdentity
  }

  setPermissionIdentity(identity: string | undefined): void {
    this.load().permissionIdentity = identity
    this.save()
  }

  clearPermissionIdentity(): void {
    this.load().permissionIdentity = undefined
    this.save()
  }

  patchSettings(patch: Partial<Settings>): Settings {
    const data = this.load()
    data.settings = { ...data.settings, ...patch }
    this.save()
    return data.settings
  }

  upsertBinding(binding: Binding): Binding[] {
    const data = this.load()
    const i = data.bindings.findIndex((b) => b.id === binding.id)
    if (i >= 0) data.bindings[i] = binding
    else data.bindings.push(binding)
    this.save()
    return data.bindings
  }

  deleteBinding(id: string): Binding[] {
    const data = this.load()
    data.bindings = data.bindings.filter((b) => b.id !== id)
    this.save()
    return data.bindings
  }
}

export const store = new Store()
