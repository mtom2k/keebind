import type { ReactNode } from 'react'

/** Hover tooltip. Wrap any control; `tip` explains what it does. */
export function Tooltip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <span className="tooltip" data-tip={tip}>
      {children}
    </span>
  )
}
