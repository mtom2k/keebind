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
    pinned: false,
    action: { type: 'launchApp', target: '' }
  }
}

function bindingSearchText(binding: Binding): string {
  const actionTargets =
    binding.action.type === 'workflow'
      ? (binding.action.steps ?? [])
          .flatMap((step) => [step.type, step.target, step.args ?? ''])
          .join(' ')
      : [binding.action.type, binding.action.target ?? '', binding.action.args ?? ''].join(' ')

  return [
    binding.accelerator,
    binding.description,
    summarizeAction(binding.action),
    actionTargets
  ]
    .join(' ')
    .toLocaleLowerCase()
}

interface Props {
  platform: Platform
  /** Set when the tray popover asked to open one binding for editing. */
  focusBindingId?: string | null
  onFocusHandled?: () => void
}

export function BindingsView({ platform, focusBindingId, onFocusHandled }: Props) {
  const [bindings, setBindings] = useState<Binding[]>([])
  const [statuses, setStatuses] = useState<BindingStatus[]>([])
  const [editing, setEditing] = useState<Binding | null>(null)
  const [conflicts, setConflicts] = useState<ConflictHit[]>([])
  const [ran, setRan] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Binding | null>(null)
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    const res = await window.keebind.listBindings()
    setBindings(res.bindings)
    setStatuses(res.statuses)
    return res.bindings
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Arriving from the tray popover's Manage button: open that binding.
  useEffect(() => {
    if (!focusBindingId) return
    let cancelled = false
    refresh().then((list) => {
      if (cancelled) return
      const match = list.find((b) => b.id === focusBindingId)
      if (match) setEditing({ ...match })
      onFocusHandled?.()
    })
    return () => {
      cancelled = true
    }
  }, [focusBindingId, refresh, onFocusHandled])

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

  useEffect(() => {
    if (!pendingDelete || deleting) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingDelete(null)
    }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [pendingDelete, deleting])

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

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(pendingDelete.id)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const patchBinding = async (binding: Binding, patch: Partial<Binding>) => {
    const res = await window.keebind.saveBinding({ ...binding, ...patch })
    setBindings(res.bindings)
    setStatuses(res.statuses)
  }

  const runNow = async (binding: Binding) => {
    try {
      await window.keebind.runBinding(binding.id)
      setRan(binding.id)
      setTimeout(() => setRan(null), 1400)
    } catch {
      // the main process shows a notification with the reason
    }
  }

  const statusFor = (id: string) => statuses.find((s) => s.id === id)
  const pinnedCount = bindings.filter((b) => b.pinned).length
  const surface = platform === 'darwin' ? 'menu bar' : 'tray'
  const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const filteredBindings =
    searchTerms.length === 0
      ? bindings
      : bindings.filter((binding) => {
          const text = bindingSearchText(binding)
          return searchTerms.every((term) => text.includes(term))
        })

  return (
    <div>
      <h1>Bindings</h1>
      <p className="subtitle">
        Global hotkeys that launch apps, open URLs, or run multi-step workflows. Pin the ones you
        use most and they show up in the {surface}.
      </p>

      {bindings.length > 0 && (
        <div className="binding-search" role="search">
          <input
            type="search"
            value={query}
            aria-label="Search bindings"
            title="Filter bindings by name, hotkey, action, or target"
            placeholder="Search bindings…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <Tooltip tip="Clear the binding search">
              <button className="btn" onClick={() => setQuery('')}>
                Clear
              </button>
            </Tooltip>
          )}
          <span className="muted small" aria-live="polite">
            {query.trim()
              ? `${filteredBindings.length} of ${bindings.length} shown`
              : `${bindings.length} binding${bindings.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      {bindings.length === 0 && !editing && (
        <div className="panel muted">
          No bindings yet. Keys like <kbd>F13</kbd> to <kbd>F19</kbd> are a good place to start,
          since they are rarely used by the OS. Configure a spare key on your keyboard or macropad,
          then bind it here.
        </div>
      )}

      {bindings.length > 0 && filteredBindings.length === 0 && (
        <div className="panel muted">
          No bindings match “{query.trim()}”. Try another name, hotkey, action, or target.
        </div>
      )}

      {filteredBindings.map((b) => {
        const st = statusFor(b.id)
        return (
          <div className="binding-card" key={b.id}>
            <kbd>{b.accelerator}</kbd>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="desc">{b.description || summarizeAction(b.action)}</div>
              <div className="action-summary">{summarizeAction(b.action)}</div>
            </div>
            {b.enabled && st && !st.registered && (
              <Tooltip tip="The OS refused this hotkey. Another app or a system shortcut probably owns it.">
                <span className="badge">not registered</span>
              </Tooltip>
            )}
            {b.enabled && st?.registered && (
              <Tooltip tip="This hotkey is active system-wide">
                <span className="badge ok">active</span>
              </Tooltip>
            )}
            <Tooltip
              tip={
                b.pinned
                  ? `Unpin from the ${surface}`
                  : `Pin to the ${surface} so you can run it with the mouse`
              }
            >
              <button
                className={`icon-btn ${b.pinned ? 'on' : ''}`}
                aria-label={b.pinned ? 'Unpin this binding' : 'Pin this binding'}
                onClick={() => patchBinding(b, { pinned: !b.pinned })}
              >
                {b.pinned ? '★' : '☆'}
              </button>
            </Tooltip>
            <Tooltip tip="Run this binding now, without pressing the hotkey">
              <button className="btn small-btn" onClick={() => runNow(b)}>
                {ran === b.id ? '✓ Ran' : '▶ Run'}
              </button>
            </Tooltip>
            <Tooltip tip={b.enabled ? 'Turn this binding off' : 'Turn this binding on'}>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) => patchBinding(b, { enabled: e.target.checked })}
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
              <button className="btn danger" onClick={() => setPendingDelete(b)}>
                Delete
              </button>
            </Tooltip>
          </div>
        )
      })}

      {bindings.length > 0 && !editing && (
        <p className="muted small" style={{ margin: '10px 0 14px' }}>
          {pinnedCount === 0
            ? `Nothing pinned. Click the star on a binding to reach it from the ${surface}.`
            : `${pinnedCount} pinned. Click the KeeBind icon in the ${surface} to run them.`}
        </p>
      )}

      {!editing && (
        <Tooltip tip="Create a new hotkey binding">
          <button className="btn primary" onClick={() => setEditing(emptyBinding())}>
            + Add binding
          </button>
        </Tooltip>
      )}

      {editing && (
        <div className="panel editor">
          <h3 className="editor-title">
            {bindings.some((b) => b.id === editing.id) ? 'Edit binding' : 'New binding'}
          </h3>

          <div className="editor-grid">
            <label className="field">
              Hotkey
              <KeyCaptureField
                value={editing.accelerator}
                platform={platform}
                onChange={(accelerator) => setEditing({ ...editing, accelerator })}
              />
            </label>
            <label className="field">
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
              {c.label}
              {c.note ? <div className="small">{c.note}</div> : null}
            </div>
          ))}

          <div className="field editor-action">
            Action
            <ActionEditor
              value={editing.action}
              onChange={(action) => setEditing({ ...editing, action })}
            />
          </div>

          <div className="row editor-footer">
            <Tooltip tip={`Show this binding in the ${surface}`}>
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={editing.pinned ?? false}
                  onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
                />
                Pin to {surface}
              </label>
            </Tooltip>
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

      {pendingDelete && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            if (!deleting) setPendingDelete(null)
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-binding-title"
            aria-describedby="delete-binding-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="delete-binding-title">Delete binding?</h2>
            <p id="delete-binding-description" className="muted">
              This permanently removes the binding below. This action cannot be undone.
            </p>
            <div className="delete-binding-preview">
              <strong>{pendingDelete.description || summarizeAction(pendingDelete.action)}</strong>
              <kbd>{pendingDelete.accelerator}</kbd>
            </div>
            <div className="row confirm-actions">
              <div className="spacer" />
              <Tooltip tip="Keep this binding">
                <button
                  className="btn"
                  autoFocus
                  disabled={deleting}
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </button>
              </Tooltip>
              <Tooltip tip="Permanently delete this binding">
                <button className="btn danger-fill" disabled={deleting} onClick={confirmDelete}>
                  {deleting ? 'Deleting…' : 'Delete binding'}
                </button>
              </Tooltip>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
