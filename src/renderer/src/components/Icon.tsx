/**
 * Small UI icons as inline SVG on a shared 16-unit grid.
 *
 * These were text glyphs (▶ ⚙) before, which each font draws at its own size
 * and baseline, so the buttons never matched. Drawing them ourselves means
 * every icon occupies exactly the same box.
 */
import type { ReactElement } from 'react'

export type IconName = 'play' | 'gear' | 'info' | 'power'

const PATHS: Record<IconName, ReactElement> = {
  // Solid triangle, optically centred in the 16-unit box and sized to carry
  // the same visual weight as the stroked icons.
  play: <path d="M4.9 3.1 L13.0 8 L4.9 12.9 Z" fill="currentColor" />,
  // Eight-tooth cog. The teeth start inside the rim so they read as attached;
  // detached thin spokes look like a sun at this size. Butt caps keep them
  // blocky rather than rounded.
  gear: (
    <g fill="none" stroke="currentColor">
      <circle cx="8" cy="8" r="4" strokeWidth="2.4" />
      <g strokeWidth="2" strokeLinecap="butt">
        <path d="M12.0 8 H14.2M4.0 8 H1.8M8 12.0 V14.2M8 4.0 V1.8" />
        <path d="M10.83 10.83 L12.38 12.38M5.17 5.17 L3.62 3.62M10.83 5.17 L12.38 3.62M5.17 10.83 L3.62 12.38" />
      </g>
    </g>
  ),
  info: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.3v4M8 4.9v.1" />
    </g>
  ),
  power: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 2.2v5.4" />
      <path d="M4.4 4.6a5 5 0 1 0 7.2 0" />
    </g>
  )
}

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  )
}
