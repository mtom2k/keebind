import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const DELAY_MS = 250
/** Distance from the anchor. */
const GAP = 8
/** Minimum distance from the viewport edge. */
const EDGE = 8

interface Placement {
  top: number
  left: number
  below: boolean
}

/**
 * Hover/focus tooltip. Wrap any control; `tip` explains what it does.
 *
 * Rendered through a portal with `position: fixed` rather than as a CSS
 * `::after` on the trigger: as a child it was clipped by the scrolling content
 * pane and by the window edges, which cut off the tips on controls near the
 * top of a view or against the sidebar. Fixed positioning escapes every
 * overflow container, and the placement below clamps to the viewport and flips
 * under the anchor when there is no room above.
 */
export function Tooltip({ tip, children }: { tip: string; children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), DELAY_MS)
  }

  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
    setPlacement(null)
  }

  useEffect(() => () => clearTimeout(timer.current), [])

  // Measure after the bubble is mounted (it renders hidden until placed, so
  // there is no flash at the origin).
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const bubble = bubbleRef.current?.getBoundingClientRect()
      if (!anchor || !bubble) return
      const fitsAbove = anchor.top - GAP - bubble.height >= EDGE
      setPlacement({
        top: fitsAbove ? anchor.top - GAP - bubble.height : anchor.bottom + GAP,
        left: Math.max(
          EDGE,
          Math.min(
            anchor.left + anchor.width / 2 - bubble.width / 2,
            window.innerWidth - bubble.width - EDGE
          )
        ),
        below: !fitsAbove
      })
    }
    place()
    window.addEventListener('resize', place)
    // capture: the content pane scrolls, not the window
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, tip])

  return (
    <>
      <span
        ref={anchorRef}
        className="tooltip"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            className={`tooltip-bubble ${placement ? 'placed' : ''} ${placement?.below ? 'below' : ''}`}
            style={placement ? { top: placement.top, left: placement.left } : undefined}
          >
            {tip}
          </div>,
          document.body
        )}
    </>
  )
}
