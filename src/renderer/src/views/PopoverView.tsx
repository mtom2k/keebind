import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Binding } from '../../../shared/types'
import { summarizeAction } from '../components/ActionEditor'
import { Icon } from '../components/Icon'
import { Logo } from '../components/Logo'

/**
 * The panel that drops down from the menu bar / tray icon.
 *
 * Each pinned binding runs on double-click, or from the Run button that
 * appears on hover; the cog next to it opens the main window with that binding
 * ready to edit. This is a real window rather than a native Tray menu, because
 * a native menu row is one click target and can't hold two buttons.
 */
export function PopoverView() {
  const [bindings, setBindings] = useState<Binding[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await window.keebind.listBindings()
    setBindings(res.bindings.filter((b) => b.pinned))
  }, [])

  useEffect(() => {
    load()
    return window.keebind.onPopoverRefresh(load)
  }, [load])

  // The window is sized to its contents, so report the height after each render.
  useLayoutEffect(() => {
    if (bodyRef.current) window.keebind.resizePopover(bodyRef.current.offsetHeight)
  }, [bindings, failed])

  const run = async (binding: Binding) => {
    setRunning(binding.id)
    setFailed(null)
    try {
      await window.keebind.runBinding(binding.id)
      window.keebind.hidePopover()
    } catch {
      setFailed(binding.id)
    } finally {
      setRunning(null)
    }
  }

  const manage = (binding: Binding) => {
    window.keebind.hidePopover()
    window.keebind.navigate({ view: 'bindings', bindingId: binding.id })
  }

  return (
    <div className="popover" ref={bodyRef}>
      <div className="popover-head">
        <Logo size={18} />
        <span className="popover-title">Pinned bindings</span>
      </div>

      {bindings.length === 0 ? (
        <div className="popover-empty">
          Nothing pinned yet. Open KeeBind, go to Bindings, and click the star on any binding you
          want here.
        </div>
      ) : (
        <ul className="popover-list">
          {bindings.map((binding) => (
            <li
              key={binding.id}
              className="popover-item"
              title="Double-click to run"
              onDoubleClick={() => run(binding)}
            >
              <div className="popover-item-text">
                <div className="popover-item-name">
                  {binding.description || summarizeAction(binding.action)}
                </div>
                <div className="popover-item-sub">
                  <kbd>{binding.accelerator}</kbd>
                  {failed === binding.id && <span className="popover-failed">Did not run</span>}
                </div>
              </div>
              <div className="popover-actions">
                <button
                  className="icon-btn"
                  title={`Run "${binding.description || binding.accelerator}" now`}
                  aria-label="Run this binding"
                  disabled={running === binding.id}
                  onClick={() => run(binding)}
                >
                  <Icon name="play" />
                </button>
                <button
                  className="icon-btn"
                  title="Open this binding in KeeBind to change it"
                  aria-label="Manage this binding"
                  onClick={() => manage(binding)}
                >
                  <Icon name="gear" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="popover-foot">
        <button
          className="link-btn"
          onClick={() => {
            window.keebind.hidePopover()
            window.keebind.navigate({ view: 'bindings' })
          }}
        >
          Open KeeBind
        </button>
        <div className="spacer" />
        <button
          className="icon-btn"
          title="About KeeBind"
          aria-label="About KeeBind"
          onClick={() => {
            window.keebind.hidePopover()
            window.keebind.showAbout()
          }}
        >
          <Icon name="info" />
        </button>
        <button
          className="icon-btn danger"
          title="Quit KeeBind. Bindings stop working until you start it again."
          aria-label="Quit KeeBind"
          onClick={() => window.keebind.quit()}
        >
          <Icon name="power" />
        </button>
      </div>
    </div>
  )
}
