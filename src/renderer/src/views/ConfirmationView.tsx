import { useCallback, useEffect, useRef, useState } from 'react'
import type { BindingConfirmationDetails } from '../../../shared/types'
import { Logo } from '../components/Logo'

export function ConfirmationView() {
  const [details, setDetails] = useState<BindingConfirmationDetails | null>(null)
  const [answering, setAnswering] = useState(false)
  const denyRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    void window.keebind.getBindingConfirmation().then((next) => {
      if (!next) void window.keebind.respondBindingConfirmation(false)
      else setDetails(next)
    })
  }, [])

  const answer = useCallback(async (approved: boolean) => {
    if (answering) return
    setAnswering(true)
    await window.keebind.respondBindingConfirmation(approved)
  }, [answering])

  useEffect(() => {
    if (!details) return
    const frame = requestAnimationFrame(() => denyRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [details])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        void answer(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [answer])

  return (
    <div className="confirmation-window">
      <header className="confirmation-titlebar">
        <Logo size={20} />
        <span>Confirm binding</span>
        <button
          className="confirmation-close"
          aria-label="Deny and close"
          title="Deny and close"
          disabled={answering}
          onClick={() => void answer(false)}
        >
          ×
        </button>
      </header>

      {details ? (
        <main className="confirmation-content">
          <div className="confirmation-heading">
            <div className="confirmation-mark">?</div>
            <div>
              <h1>Run “{details.displayName}”?</h1>
              <p>This binding requires your approval every time it runs.</p>
            </div>
          </div>

          <dl className="confirmation-facts">
            <div>
              <dt>Hotkey</dt>
              <dd><kbd>{details.accelerator}</kbd></dd>
            </div>
            <div>
              <dt>Name</dt>
              <dd>{details.name}</dd>
            </div>
            <div>
              <dt>Description</dt>
              <dd>{details.description || 'None'}</dd>
            </div>
          </dl>

          <section className="confirmation-action">
            <span>Action to perform</span>
            <pre>{details.actionDescription}</pre>
          </section>
        </main>
      ) : (
        <main className="confirmation-content confirmation-loading">Loading confirmation…</main>
      )}

      <footer className="confirmation-footer">
        <button
          ref={denyRef}
          className="btn"
          disabled={answering || !details}
          onClick={() => void answer(false)}
        >
          Deny
        </button>
        <button
          className="btn primary"
          disabled={answering || !details}
          onClick={() => void answer(true)}
        >
          Run binding
        </button>
      </footer>
    </div>
  )
}
