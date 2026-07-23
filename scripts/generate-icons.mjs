// Generates every KeeBind icon from code. No binary design assets in the repo.
//
// The mark: a keycap on an indigo squircle, with a split "K" carved into the
// cap face and a homing bar under it. Two lockups, one identity:
//
//   full   ≥128px  plate + keycap + gradient K + homing bar  (app icon)
//   small  ≤64px   plate + solid K only                      (Windows tray)
//   stencil        keycap silhouette with the K knocked out (macOS template)
//
// Outputs:
//   build/icon.png                    1024px, electron-builder derives .icns/.ico
//   resources/icons/app-icon.png      512px, runtime Dock / taskbar / window icon
//   resources/icons/trayTemplate.png  macOS menu bar (black + alpha, OS recolors)
//   resources/icons/tray-win.png      Windows notification area (full colour)
//
// src/renderer/src/components/Logo.tsx redraws the "full" lockup as inline SVG;
// keep the two in sync when the geometry below changes.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ------------------------------------------------------------------ PNG */

let crcTable
function crc32(buf) {
  if (!crcTable) {
    crcTable = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crcTable[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0 // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

/* ------------------------------------------------------- rasterisation */

// Shapes are inside-tests over unit space (0..1 on both axes), so one set of
// coordinates renders at 16px and at 1024px. Coverage comes from SS×SS
// supersampling per pixel, which is what gives the small sizes clean edges.
const SS = 4

class Canvas {
  constructor(size) {
    this.size = size
    this.px = Buffer.alloc(size * size * 4)
  }

  /** Composite `color` (a fn of u,v) wherever `shape` reports inside. */
  fill(shape, color, alpha = 1) {
    this.#scan(shape, (x, y, cov, r, g, b) => {
      const a = alpha * cov
      const i = (y * this.size + x) * 4
      const da = this.px[i + 3] / 255
      const outA = a + da * (1 - a)
      if (outA <= 0) return
      this.px[i] = Math.round((r * a + this.px[i] * da * (1 - a)) / outA)
      this.px[i + 1] = Math.round((g * a + this.px[i + 1] * da * (1 - a)) / outA)
      this.px[i + 2] = Math.round((b * a + this.px[i + 2] * da * (1 - a)) / outA)
      this.px[i + 3] = Math.round(outA * 255)
    }, color)
  }

  /** Punch `shape` out of whatever is already painted (used for the stencil). */
  erase(shape) {
    this.#scan(shape, (x, y, cov) => {
      const i = (y * this.size + x) * 4
      this.px[i + 3] = Math.round(this.px[i + 3] * (1 - cov))
    })
  }

  #scan(shape, emit, color) {
    const n = SS * SS
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let hits = 0
        let r = 0
        let g = 0
        let b = 0
        for (let sy = 0; sy < SS; sy++) {
          for (let sx = 0; sx < SS; sx++) {
            const u = (x + (sx + 0.5) / SS) / this.size
            const v = (y + (sy + 0.5) / SS) / this.size
            if (!shape(u, v)) continue
            hits++
            if (color) {
              const c = color(u, v)
              r += c[0]
              g += c[1]
              b += c[2]
            }
          }
        }
        if (hits) emit(x, y, hits / n, r / hits, g / hits, b / hits)
      }
    }
  }

  toPng() {
    return encodePng(this.size, this.size, this.px)
  }
}

/* -------------------------------------------------------------- colour */

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16)
]
const solid = (hex) => {
  const c = rgb(hex)
  return () => c
}
/** Diagonal top-left → bottom-right gradient. */
const gradient = (from, to) => {
  const a = rgb(from)
  const b = rgb(to)
  return (u, v) => {
    const t = Math.min(1, Math.max(0, (u + v) / 2))
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  }
}

/* -------------------------------------------------------------- shapes */

const roundRect = (x0, y0, x1, y1, r) => (u, v) => {
  const cx = Math.min(Math.max(u, x0 + r), x1 - r)
  const cy = Math.min(Math.max(v, y0 + r), y1 - r)
  return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
}

/** Superellipse: the macOS "squircle" corner, softer than a rounded rect. */
const squircle = (x0, y0, x1, y1, n = 5) => {
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const rx = (x1 - x0) / 2
  const ry = (y1 - y0) / 2
  return (u, v) => Math.abs((u - cx) / rx) ** n + Math.abs((v - cy) / ry) ** n <= 1
}

/** Line segment with round caps. Every stroke of the K is one of these. */
const capsule = (ax, ay, bx, by, thickness) => {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  const r = thickness / 2
  return (u, v) => {
    let t = len2 === 0 ? 0 : ((u - ax) * dx + (v - ay) * dy) / len2
    t = Math.min(1, Math.max(0, t))
    return (u - (ax + t * dx)) ** 2 + (v - (ay + t * dy)) ** 2 <= r * r
  }
}

const union =
  (...shapes) =>
  (u, v) =>
    shapes.some((s) => s(u, v))

/* ---------------------------------------------------------------- mark */

const PLATE_FROM = '#3c46e0'
const PLATE_TO = '#7a4ff0'
const CAP_FACE = '#f6f7fb'
const CAP_SKIRT = '#cfd4e8'
const GLYPH_FROM = '#3b45d8'
const GLYPH_TO = '#6c46e4'

// Split "K": the arms stop short of the stem. The gap is the detail that makes
// the mark ours rather than a generic letterform. `gap` collapses to 0 for the
// small/stencil lockups, where a 1px gap would just read as mud.
function kGlyph({ x, y, w, h, weight, gap = 0 }) {
  const stemX = x + weight / 2
  const midY = y + h / 2
  const armX = x + weight + gap
  return union(
    capsule(stemX, y + weight / 2, stemX, y + h - weight / 2, weight),
    capsule(x + w - weight / 2, y + weight / 2, armX, midY, weight),
    capsule(armX, midY, x + w - weight / 2, y + h - weight / 2, weight)
  )
}

/** Full lockup: plate + keycap + gradient K + homing bar. */
function drawFull(c) {
  c.fill(squircle(0.055, 0.055, 0.945, 0.945), gradient(PLATE_FROM, PLATE_TO))
  // Keycap: skirt is the taller rect behind, face is inset and sits higher, so
  // the visible bottom band reads as the side wall of a real cap.
  c.fill(roundRect(0.198, 0.172, 0.802, 0.856, 0.108), solid(CAP_SKIRT))
  c.fill(roundRect(0.232, 0.202, 0.768, 0.744, 0.082), solid(CAP_FACE))
  c.fill(
    kGlyph({ x: 0.335, y: 0.272, w: 0.33, h: 0.33, weight: 0.076, gap: 0.028 }),
    gradient(GLYPH_FROM, GLYPH_TO)
  )
  c.fill(roundRect(0.428, 0.652, 0.572, 0.677, 0.0125), solid(GLYPH_FROM), 0.42)
}

/** Small lockup: plate + solid K, legible down to 16px. */
function drawSmall(c) {
  c.fill(squircle(0.02, 0.02, 0.98, 0.98), gradient(PLATE_FROM, PLATE_TO))
  c.fill(kGlyph({ x: 0.27, y: 0.235, w: 0.46, h: 0.53, weight: 0.125 }), solid('#ffffff'))
}

/** Stencil: solid keycap with the K punched through, for template images. */
function drawStencil(c, hex) {
  c.fill(roundRect(0.08, 0.1, 0.92, 0.9, 0.16), solid(hex))
  c.erase(kGlyph({ x: 0.28, y: 0.245, w: 0.44, h: 0.5, weight: 0.12 }))
}

/* --------------------------------------------------------------- write */

const render = (size, draw, ...args) => {
  const c = new Canvas(size)
  draw(c, ...args)
  return c.toPng()
}

const iconsDir = join(root, 'resources', 'icons')
const buildDir = join(root, 'build')
mkdirSync(iconsDir, { recursive: true })
mkdirSync(buildDir, { recursive: true })

const out = [
  // electron-builder derives .icns and .ico from this one file.
  [join(buildDir, 'icon.png'), render(1024, drawFull)],
  // Loaded at runtime for the Dock (macOS), taskbar + window (Windows) and the
  // About panel. The same art users see on the installer.
  [join(iconsDir, 'app-icon.png'), render(512, drawFull)],
  // macOS menu bar: black + alpha template, the OS recolours per appearance.
  [join(iconsDir, 'trayTemplate.png'), render(18, drawStencil, '#000000')],
  [join(iconsDir, 'trayTemplate@2x.png'), render(36, drawStencil, '#000000')],
  // Windows notification area keeps the colour mark, so tray and taskbar match.
  [join(iconsDir, 'tray-win.png'), render(16, drawSmall)],
  [join(iconsDir, 'tray-win@2x.png'), render(32, drawSmall)]
]

for (const [file, png] of out) writeFileSync(file, png)
console.log(`Wrote ${out.length} icons to resources/icons and build/`)
