import { useCallback, useEffect, useState } from 'react'
import { bindingDisplayName, summarizeAction } from '../../../shared/action-summary'
import type { Binding, BindingStatus, ConflictHit, Platform } from '../../../shared/types'
import { ActionEditor } from '../components/ActionEditor'
import { Icon } from '../components/Icon'
import { KeyCaptureField } from '../components/KeyCaptureField'
import { Tooltip } from '../components/Tooltip'
import { bindingMatchesQuery } from '../binding-search'

type DropEdge = 'before' | 'after'

function emptyBinding(accelerator = ''): Binding {
  return {
    id: crypto.randomUUID(),
    accelerator,
    name: '',
    description: '',
    enabled: true,
    pinned: false,
    confirmBeforeRun: false,
    action: { type: 'launchApp', target: '' }
  }
}

interface Props {
  platform: Platform
  /** Set when the tray popover asked to open one binding for editing. */
  focusBindingId?: string | null
  /** Set when the Key Listener captured a hotkey for a new binding. */
  draftAccelerator?: string | null
  onFocusHandled?: () => void
  onDraftHandled?: () => void
}

export function BindingsView({
  platform,
  focusBindingId,
  draftAccelerator,
  onFocusHandled,
  onDraftHandled
}: Props) {
  const [bindings, setBindings] = useState<Binding[]>([])
  const [statuses, setStatuses] = useState<BindingStatus[]>([])
  const [editing, setEditing] = useState<Binding | null>(null)
  const [conflicts, setConflicts] = useState<ConflictHit[]>([])
  const [ran, setRan] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Binding | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: DropEdge } | null>(null)
  const [reordering, setReordering] = useState(false)
  const editingExisting = Boolean(editing && bindings.some((b) => b.id === editing.id))

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

  // Arriving from the Key Listener: create a fresh binding with the captured
  // accelerator already filled in so the user only has to choose its action.
  useEffect(() => {
    if (!draftAccelerator) return
    setEditing(emptyBinding(draftAccelerator))
    onDraftHandled?.()
  }, [draftAccelerator, onDraftHandled])

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

  useEffect(() => {
    if (!draggedId) return
    const finishDrag = () => {
      setDraggedId(null)
      setDropTarget(null)
    }
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    return () => {
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [draggedId])

  // Existing bindings edit in a true focused modal: Escape discards and Tab
  // remains inside the editor instead of moving into the obscured page.
  useEffect(() => {
    if (!editingExisting) return
    const handleModalKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!saving) setEditing(null)
        return
      }
      if (event.key !== 'Tab') return

      const modal = document.querySelector<HTMLElement>('.binding-edit-modal')
      if (!modal) return
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      ).filter((element) => element.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !modal.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleModalKeys)
    return () => window.removeEventListener('keydown', handleModalKeys)
  }, [editingExisting, saving])

  const save = async () => {
    if (!editing || !editing.accelerator) return
    setSaving(true)
    try {
      const res = await window.keebind.saveBinding(editing)
      setBindings(res.bindings)
      setStatuses(res.statuses)
      setEditing(null)
    } finally {
      setSaving(false)
    }
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

  const reorderBinding = async (sourceId: string, targetId: string, edge: DropEdge) => {
    if (reordering || sourceId === targetId) return
    const source = bindings.find((binding) => binding.id === sourceId)
    if (!source || !bindings.some((binding) => binding.id === targetId)) return

    const previous = bindings
    const next = bindings.filter((binding) => binding.id !== sourceId)
    const targetIndex = next.findIndex((binding) => binding.id === targetId)
    next.splice(targetIndex + (edge === 'after' ? 1 : 0), 0, source)
    if (next.every((binding, index) => binding.id === bindings[index]?.id)) return

    setBindings(next)
    setReordering(true)
    try {
      const res = await window.keebind.reorderBindings(next.map((binding) => binding.id))
      setBindings(res.bindings)
      setStatuses(res.statuses)
    } catch {
      setBindings(previous)
    } finally {
      setReordering(false)
    }
  }

  const moveBindingWithKeyboard = (binding: Binding, direction: -1 | 1) => {
    const index = filteredBindings.findIndex((item) => item.id === binding.id)
    const adjacent = filteredBindings[index + direction]
    if (!adjacent) return
    void reorderBinding(binding.id, adjacent.id, direction < 0 ? 'before' : 'after')
  }

  const runNow = async (binding: Binding) => {
    try {
      const result = await window.keebind.runBinding(binding.id)
      if (result.outcome !== 'ran') return
      setRan(binding.id)
      setTimeout(() => setRan(null), 1400)
    } catch {
      // the main process shows a notification with the reason
    }
  }

  const statusFor = (id: string) => statuses.find((s) => s.id === id)
  const pinnedCount = bindings.filter((b) => b.pinned).length
  const surface = platform === 'darwin' ? 'menu bar' : 'tray'
  const filteredBindings = bindings.filter((binding) => bindingMatchesQuery(binding, query))

  return (
    <div className="main-view">
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
          <div
            className={[
              'binding-card',
              draggedId === b.id ? 'dragging' : '',
              dropTarget?.id === b.id ? `drop-${dropTarget.edge}` : ''
            ]
              .filter(Boolean)
              .join(' ')}
            data-binding-id={b.id}
            key={b.id}
            onPointerMove={(event) => {
              if (!draggedId || draggedId === b.id || reordering) return
              const rect = event.currentTarget.getBoundingClientRect()
              const edge: DropEdge = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
              if (dropTarget?.id !== b.id || dropTarget.edge !== edge) {
                setDropTarget({ id: b.id, edge })
              }
            }}
            onPointerUp={(event) => {
              if (!draggedId) return
              const sourceId = draggedId
              const rect = event.currentTarget.getBoundingClientRect()
              const edge: DropEdge = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
              setDraggedId(null)
              setDropTarget(null)
              if (sourceId !== b.id) void reorderBinding(sourceId, b.id, edge)
            }}
          >
            <Tooltip tip="Drag to reorder. You can also focus this handle and use the Up or Down arrow key.">
              <button
                className="icon-btn drag-handle"
                disabled={reordering || bindings.length < 2}
                aria-label={`Reorder ${bindingDisplayName(b)}`}
                onPointerDown={(event) => {
                  if (event.button !== 0 || reordering || bindings.length < 2) return
                  event.preventDefault()
                  setDraggedId(b.id)
                  setDropTarget(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    moveBindingWithKeyboard(b, -1)
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    moveBindingWithKeyboard(b, 1)
                  }
                }}
              >
                <Icon name="grip" size={16} />
              </button>
            </Tooltip>
            <kbd>{b.accelerator}</kbd>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="desc">
                {b.name?.trim() || b.description || summarizeAction(b.action)}
              </div>
              {b.name?.trim() && b.description.trim() && (
                <div className="binding-description">{b.description}</div>
              )}
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
        <div
          className={
            editingExisting ? 'modal-backdrop binding-editor-backdrop' : 'binding-editor-inline'
          }
        >
          <section
            className={`panel editor ${editingExisting ? 'binding-edit-modal' : ''}`}
            role={editingExisting ? 'dialog' : undefined}
            aria-modal={editingExisting ? 'true' : undefined}
            aria-labelledby={editingExisting ? 'edit-binding-title' : undefined}
            aria-describedby={editingExisting ? 'edit-binding-description' : undefined}
          >
            <h3 className="editor-title" id={editingExisting ? 'edit-binding-title' : undefined}>
              {editingExisting ? 'Edit binding' : 'New binding'}
            </h3>

            {editingExisting && (
              <p className="binding-editor-intro muted" id="edit-binding-description">
                Editing <strong>{bindingDisplayName(editing)}</strong>. Save your changes or discard
                them to return to the binding list.
              </p>
            )}

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
                Name
                <input
                  type="text"
                  autoFocus={editingExisting}
                  value={editing.name ?? ''}
                  placeholder="e.g. Open my notes"
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="field editor-description">
                Description
                <input
                  type="text"
                  value={editing.description}
                  placeholder="Optional details about what this binding does"
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
              <div className="editor-options">
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
                <Tooltip tip="Ask for approval before this binding runs from a hotkey, KeeBind, or the menu">
                  <label className="check-inline">
                    <input
                      type="checkbox"
                      checked={editing.confirmBeforeRun ?? false}
                      onChange={(e) =>
                        setEditing({ ...editing, confirmBeforeRun: e.target.checked })
                      }
                    />
                    Confirm before run
                  </label>
                </Tooltip>
              </div>
              <div className="spacer" />
              <Tooltip tip="Discard changes">
                <button className="btn" disabled={saving} onClick={() => setEditing(null)}>
                  {editingExisting ? 'Discard edits' : 'Cancel'}
                </button>
              </Tooltip>
              <Tooltip tip="Save and activate this binding">
                <button
                  className="btn primary"
                  disabled={!editing.accelerator || saving}
                  onClick={save}
                >
                  {saving ? 'Saving…' : 'Save binding'}
                </button>
              </Tooltip>
            </div>
          </section>
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
              <strong>{bindingDisplayName(pendingDelete)}</strong>
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
