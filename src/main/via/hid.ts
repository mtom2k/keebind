import { devicesAsync } from 'node-hid'
import type { ViaDeviceDetail, ViaDeviceSummary } from '../../shared/types'
import { findDefinition, hasDefinition, parseKleKeymap } from './definitions'
import { VIA_USAGE, VIA_USAGE_PAGE, ViaClient } from './protocol'

export async function listViaDevices(): Promise<ViaDeviceSummary[]> {
  const all = await devicesAsync()
  return all
    .filter((d) => d.usagePage === VIA_USAGE_PAGE && d.usage === VIA_USAGE && d.path)
    .map((d) => ({
      path: d.path!,
      name: d.product ?? 'Unknown device',
      manufacturer: d.manufacturer ?? '',
      vendorId: d.vendorId,
      productId: d.productId,
      hasDefinition: hasDefinition(d.vendorId, d.productId)
    }))
}

/**
 * Opens a device, reads protocol info and the full keymap, then closes it.
 * Stateless per call: no HID handles are held between IPC requests, so
 * unplugging a board never leaves a dangling handle.
 */
export async function openViaDevice(path: string): Promise<ViaDeviceDetail> {
  const summary = (await listViaDevices()).find((d) => d.path === path)
  if (!summary) throw new Error('Device not found — it may have been unplugged.')
  const definition = findDefinition(summary.vendorId, summary.productId)
  if (!definition) {
    throw new Error(
      'No VIA definition available for this keyboard. Import its VIA JSON definition in the panel below (or run `npm run via:definitions` to bundle the official catalog).'
    )
  }
  const client = await ViaClient.open(path)
  try {
    const protocolVersion = await client.protocolVersion()
    const layerCount = await client.layerCount()
    const { rows, cols } = definition.matrix
    const keymap = await client.readKeymap(layerCount, rows, cols)
    return {
      ...summary,
      protocolVersion,
      layerCount,
      matrix: definition.matrix,
      keys: parseKleKeymap(definition.layouts.keymap),
      keymap
    }
  } finally {
    await client.close()
  }
}

export async function setViaKeycode(args: {
  path: string
  layer: number
  row: number
  col: number
  keycode: number
}): Promise<{ verified: number }> {
  const client = await ViaClient.open(args.path)
  try {
    const verified = await client.setKeycode(args.layer, args.row, args.col, args.keycode)
    return { verified }
  } finally {
    await client.close()
  }
}
