// Generates all app icons from code (no binary assets in the repo).
// Outputs: resources/icons/trayTemplate(.png/@2x) for macOS menu bar,
// tray-win(.png/@2x) for the Windows notification area, build/icon.png (512px)
// used by electron-builder to derive .icns/.ico.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  ihdr[9] = 6 // color type RGBA
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

class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = Buffer.alloc(w * h * 4)
  }
  set(x, y, [r, g, b, a]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    this.px[i] = r
    this.px[i + 1] = g
    this.px[i + 2] = b
    this.px[i + 3] = a
  }
  fillRect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
  // Rounded rect: skip pixels whose center falls outside the corner radius.
  fillRoundRect(x, y, w, h, r, c) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const cx = i < x + r ? x + r : i >= x + w - r ? x + w - r - 1 : i
        const cy = j < y + r ? y + r : j >= y + h - r ? y + h - r - 1 : j
        if ((i - cx) ** 2 + (j - cy) ** 2 <= r * r + r * 0.5 || (cx === i && cy === j)) this.set(i, j, c)
        else if (cx === i || cy === j) this.set(i, j, c)
      }
    }
  }
  toPng() {
    return encodePng(this.w, this.h, this.px)
  }
}

// Keyboard glyph on a 16-unit grid, scaled by s. `keyColor` paints the key
// cutouts (use [0,0,0,0] to carve them out to transparency).
function drawKeyboard(c, s, bodyColor, keyColor) {
  c.fillRoundRect(2 * s, 4 * s, 12 * s, 8 * s, 2 * s, bodyColor)
  const dots = [
    [4, 6], [6, 6], [8, 6], [10, 6],
    [4, 8], [6, 8], [8, 8], [10, 8]
  ]
  for (const [x, y] of dots) c.fillRect(x * s, y * s, s, s, keyColor)
  c.fillRect(5 * s, 10 * s, 6 * s, s, keyColor) // spacebar
}

function trayIcon(scale, color) {
  const c = new Canvas(16 * scale, 16 * scale)
  drawKeyboard(c, scale, color, [0, 0, 0, 0])
  return c.toPng()
}

const iconsDir = join(root, 'resources', 'icons')
const buildDir = join(root, 'build')
mkdirSync(iconsDir, { recursive: true })
mkdirSync(buildDir, { recursive: true })

const black = [0, 0, 0, 255]
const white = [255, 255, 255, 255]

// macOS menu bar template images (black + alpha; macOS recolors them)
writeFileSync(join(iconsDir, 'trayTemplate.png'), trayIcon(1, black))
writeFileSync(join(iconsDir, 'trayTemplate@2x.png'), trayIcon(2, black))
// Windows notification area (white shows on the default dark taskbar)
writeFileSync(join(iconsDir, 'tray-win.png'), trayIcon(1, white))
writeFileSync(join(iconsDir, 'tray-win@2x.png'), trayIcon(2, white))

// App icon: dark rounded square with white keyboard glyph
const app = new Canvas(512, 512)
const bg = [31, 31, 42, 255]
app.fillRoundRect(0, 0, 512, 512, 96, bg)
drawKeyboard(app, 32, white, bg)
writeFileSync(join(buildDir, 'icon.png'), app.toPng())

console.log('Icons written to resources/icons and build/')
