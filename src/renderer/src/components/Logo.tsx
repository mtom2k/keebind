import { useId } from 'react'

/**
 * The KeeBind mark as inline SVG, same geometry as the "full" lockup in
 * `scripts/generate-icons.mjs` (unit coordinates there × 100 here). Keep the
 * two in sync; the script is the source of truth for the shipped PNGs.
 *
 * The plate is a rounded rect rather than the script's n=5 superellipse: at
 * sidebar sizes the difference is sub-pixel and not worth a path.
 */
export function Logo({ size = 30 }: { size?: number }) {
  const id = useId()
  const plate = `plate-${id}`
  const glyph = `glyph-${id}`

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="KeeBind">
      {/* userSpaceOnUse, not the default objectBoundingBox: the K's stem is a
          vertical line, so its bounding box has zero width and an
          objectBoundingBox gradient makes it disappear entirely. Absolute
          coordinates also match the generator, which evaluates the gradient
          over the whole canvas rather than per shape. */}
      <defs>
        <linearGradient id={plate} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0" stopColor="#3c46e0" />
          <stop offset="1" stopColor="#7a4ff0" />
        </linearGradient>
        <linearGradient id={glyph} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0" stopColor="#3b45d8" />
          <stop offset="1" stopColor="#6c46e4" />
        </linearGradient>
      </defs>
      <rect x="5.5" y="5.5" width="89" height="89" rx="24" fill={`url(#${plate})`} />
      <rect x="19.8" y="17.2" width="60.4" height="68.4" rx="10.8" fill="#cfd4e8" />
      <rect x="23.2" y="20.2" width="53.6" height="54.2" rx="8.2" fill="#f6f7fb" />
      <g
        stroke={`url(#${glyph})`}
        strokeWidth="7.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M37.3 31.0 L37.3 56.4" />
        <path d="M62.7 31.0 L43.9 43.7" />
        <path d="M43.9 43.7 L62.7 56.4" />
      </g>
      <rect x="42.8" y="65.2" width="14.4" height="2.5" rx="1.25" fill="#3b45d8" opacity="0.42" />
    </svg>
  )
}
