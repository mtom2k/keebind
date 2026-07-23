import { useCallback, useEffect, useState } from 'react'
import type { Binding, BindingStatus, ConflictHit, Platform } from '../../../shared/types'
import { ActionEditor, summarizeAction } from '../components/ActionEditor'
import { KeyCaptureField } from '../components/KeyCaptureField'
import { Tooltip } from '../components/Tooltip'

function emptyBinding(): Binding {
  return {
    id: crypto.randomUUID(),
    accelerator: '',
    description: '',
    enabled: true,
    action: { type: 'launchApp', target: '' }
  }
}

export function BindingsView({ platform }: { platform: Platform }) {
  const [bindings, setBindings] = useState<Binding[]>([])
  const [statuses, setStatuses] = useState<BindingStatus[]>([])
  const [editing, setEditing] = useState<Binding | null>(null)
  const [conflicts, setConflicts] = useState<ConflictHit[]>([])

  const refresh = useCallback(async () => {
    const res = await window.keebind.listBindings()
    setBindings(res.bindings)
    setStatuses(res.statuses)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!editing || !editing.accelerator) {
      setConflicts([])
      return
    }
    let cancelled = false
    window.keebind.checkConflicts(editing.accelerator, editing.id).then((hits) => {
      if (!cancelled) setConflicts(hits)
    })
    return () => {
      cancelled = true
    }
  }, [editing?.accelerator, editing?.id])

  const save = async () => {
    if (!editing || !editing.accelerator) return
    const res = await window.keebind.saveBinding(editing)
    setBindings(res.bindings)
    setStatuses(res.statuses)
    setEditing(null)
  }

  const remove = async (id: string) => {
    const res = await window.keebind.deleteBinding(id)
    setBindings(res.bindings)
    setStatuses(res.statuses)
  }

  const toggle = async (binding: Binding, enabled: boolean) => {
    const res = await window.keebind.saveBinding({ ...binding, enabled })
    setBindings(res.bindings)
    setStatuses(res.statuses)
  }

  const statusFor = (id: string) => statuses.find((s) => s.id === id)

  return (
    <div>
      <h1>Bindings</h1>
      <p className="subtitle">
        Global hotkeys that launch apps, open URLs, or run multi-step workflows.
      </p>

      {bindings.length === 0 && !editing && (
        <div className="panel muted">
          No bindings yet. Tip: keys like <kbd>F13</kbd>–<kbd>F19</kbd> are unused by the OS and
          make great macro keys — assign one on your board in the VIA tab, then bind it here.
        </div>
      )}

      {bindings.map((b) => {
        const st = statusFor(b.id)
        return (
          <div className="binding-card" key={b.id}>
            <kbd>{b.accelerator}</kbd>
            <div style={{ flex: 1 }}>
              <div className="desc">{b.description || summarizeAction(b.action)}</div>
              <div className="action-summary">{summarizeAction(b.action)}</div>
            </div>
            {b.enabled && st && !st.registered && (
              <Tooltip tip="The OS refused this hotkey — another app or a system shortcut probably owns it">
                <span className="badge">not registered</span>
              </Tooltip>
            )}
            {b.enabled && st?.registered && (
              <Tooltip tip="This hotkey is active system-wide">
                <span className="badge ok">active</span>
              </Tooltip>
            )}
            <Tooltip tip={b.enabled ? 'Disable this binding' : 'Enable this binding'}>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) => toggle(b, e.target.checked)}
                />
                <span className="track" />
              </span>
            </Tooltip>
            <Tooltip tip="Edit this binding">
              <button className="btn" onClick={() => setEditing({ ...b })}>
                Edit
              </button>
            </Tooltip>
            <Tooltip tip="Delete this binding">
              <button className="btn danger" onClick={() => remove(b.id)}>
                Delete
              </button>
            </Tooltip>
          </div>
        )
      })}

      {!editing && (
        <Tooltip tip="Create a new hotkey binding">
          <button className="btn primary" onClick={() => setEditing(emptyBinding())}>
            + Add binding
          </button>
        </Tooltip>
      )}

      {editing && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>
            {bindings.some((b) => b.id === editing.id) ? 'Edit binding' : 'New binding'}
          </h3>
          <div className="row wrap" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
            <label className="field" style={{ flex: 1, minWidth: 260 }}>
              Hotkey
              <KeyCaptureField
                value={editing.accelerator}
                platform={platform}
                onChange={(accelerator) => setEditing({ ...editing, accelerator })}
              />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              Description
              <input
                type="text"
                value={editing.description}
                placeholder="What does this binding do?"
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
          </div>

          {conflicts.map((c, i) => (
            <div className={`alert ${c.severity}`} key={i}>
              <strong>
                {c.severity === 'warning' ? '⚠ ' : 'ℹ '}
                {c.combo}
              </strong>{' '}
              — {c.label}
              {c.note ? <div className="small">{c.note}</div> : null}
            </div>
          ))}

          <label className="field" style={{ marginBottom: 6 }}>
            Action
          </label>
          <ActionEditor
            value={editing.action}
            onChange={(action) => setEditing({ ...editing, action })}
          />

          <div className="row" style={{ marginTop: 14 }}>
            <div className="spacer" />
            <Tooltip tip="Discard changes">
              <button className="btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </Tooltip>
            <Tooltip tip="Save and activate this binding">
              <button className="btn primary" disabled={!editing.accelerator} onClick={save}>
                Save binding
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}
