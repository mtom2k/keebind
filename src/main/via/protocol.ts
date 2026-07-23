import { HIDAsync } from 'node-hid'

// VIA speaks 32-byte raw HID reports on usagePage 0xFF60 / usage 0x61.
// Command ids match QMK's via.h; responses echo the command id in byte 0.
export const VIA_USAGE_PAGE = 0xff60
export const VIA_USAGE = 0x61

const REPORT_SIZE = 32
const BUFFER_CHUNK = 28 // max payload of id_dynamic_keymap_get_buffer

const CMD = {
  getProtocolVersion: 0x01,
  dynamicKeymapGetKeycode: 0x04,
  dynamicKeymapSetKeycode: 0x05,
  dynamicKeymapGetLayerCount: 0x11,
  dynamicKeymapGetBuffer: 0x12
} as const

export class ViaClient {
  private constructor(private dev: HIDAsync) {}

  static async open(path: string): Promise<ViaClient> {
    return new ViaClient(await HIDAsync.open(path))
  }

  async close(): Promise<void> {
    await this.dev.close()
  }

  private async request(payload: number[]): Promise<Buffer> {
    const report = Buffer.alloc(REPORT_SIZE)
    Buffer.from(payload).copy(report)
    // Leading 0x00 = "no report id" (required by hidapi on every platform)
    await this.dev.write(Buffer.concat([Buffer.from([0x00]), report]))
    const deadline = Date.now() + 1500
    while (Date.now() < deadline) {
      const resp = await this.dev.read(250)
      if (resp && resp.length > 0 && resp[0] === payload[0]) return Buffer.from(resp)
    }
    throw new Error(
      `VIA device did not answer command 0x${payload[0].toString(16).padStart(2, '0')}`
    )
  }

  async protocolVersion(): Promise<number> {
    const r = await this.request([CMD.getProtocolVersion])
    return r.readUInt16BE(1)
  }

  async layerCount(): Promise<number> {
    const r = await this.request([CMD.dynamicKeymapGetLayerCount])
    return r[1]
  }

  async getKeycode(layer: number, row: number, col: number): Promise<number> {
    const r = await this.request([CMD.dynamicKeymapGetKeycode, layer, row, col])
    return r.readUInt16BE(4)
  }

  /** Writes a keycode, then reads it back. Returns the verified value. */
  async setKeycode(layer: number, row: number, col: number, keycode: number): Promise<number> {
    await this.request([
      CMD.dynamicKeymapSetKeycode,
      layer,
      row,
      col,
      (keycode >> 8) & 0xff,
      keycode & 0xff
    ])
    return this.getKeycode(layer, row, col)
  }

  /** Bulk-reads the whole dynamic keymap as [layer][row][col] keycodes. */
  async readKeymap(layers: number, rows: number, cols: number): Promise<number[][][]> {
    const totalBytes = layers * rows * cols * 2
    const raw = Buffer.alloc(totalBytes)
    for (let offset = 0; offset < totalBytes; offset += BUFFER_CHUNK) {
      const size = Math.min(BUFFER_CHUNK, totalBytes - offset)
      const r = await this.request([
        CMD.dynamicKeymapGetBuffer,
        (offset >> 8) & 0xff,
        offset & 0xff,
        size
      ])
      r.copy(raw, offset, 4, 4 + size)
    }
    const keymap: number[][][] = []
    let i = 0
    for (let l = 0; l < layers; l++) {
      const layer: number[][] = []
      for (let r = 0; r < rows; r++) {
        const row: number[] = []
        for (let c = 0; c < cols; c++) {
          row.push(raw.readUInt16BE(i))
          i += 2
        }
        layer.push(row)
      }
      keymap.push(layer)
    }
    return keymap
  }
}
