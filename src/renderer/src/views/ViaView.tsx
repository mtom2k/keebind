import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ViaDeviceDetail, ViaDeviceSummary, ViaKeyLayout } from '../../../shared/types'
import { Tooltip } from '../components/Tooltip'

const UNIT = 52 // px per keyboard unit

interface KeycodeCategory {
  name: string
  keycodes: { code: number; label: string }[]
}

function hex(n: number, width = 4): string {
  return '0x' + n.toString(16).padStart(width, '0')
}

export function ViaView() {
  const [devices, setDevices] = useState<ViaDeviceSummary[]>([])
  const [detail, setDetail] = useState<ViaDeviceDetail | null>(null)
  const [layer, setLayer] = useState(0)
  const [selectedKey, setSelectedKey] = useState<ViaKeyLayout | null>(null)
  const [categories, setCategories] = useState<KeycodeCategory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rawHex, setRawHex] = useState('')
  const [importText, setImportText] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const labelFor = useMemo(() => {
    const map = new Map<number, string>()
    for (const cat of categories) {
      for (const kc of cat.keycodes) if (!map.has(kc.code)) map.set(kc.code, kc.label)
    }
    return (code: number) => map.get(code) ?? hex(code)
  }, [categories])

  const refreshDevices = useCallback(async () => {
    setError(null)
    setDevices(await window.keebind.viaList())
  }, [])

  useEffect(() => {
    refreshDevices()
    window.keebind.viaKeycodes().then(setCategories)
  }, [refreshDevices])

  const openDevice = async (path: string) => {
    setBusy(true)
    setError(null)
    setDetail(null)
    setSelectedKey(null)
    setLayer(0)
    try {
      setDetail(await window.keebind.viaOpen(path))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const assign = async (keycode: number) => {
    if (!detail || !selectedKey) return
    setBusy(true)
    setError(null)
    try {
      const { verified } = await window.keebind.viaSetKeycode({
        path: detail.path,
        layer,
        row: selectedKey.row,
        col: selectedKey.col,
        keycode
      })
      setDetail((d) => {
        if (!d) return d
        const keymap = d.keymap.map((l, li) =>
          li === layer
            ? l.map((r, ri) =>
                ri === selectedKey.row
                  ? r.map((c, ci) => (ci === selectedKey.col ? verified : c))
                  : r
              )
            : l
        )
        return { ...d, keymap }
      })
      if (verified !== keycode) {
        setError(
          `The keyboard stored ${hex(verified)} instead of ${hex(keycode)} — the firmware may not support this keycode.`
        )
      } else {
        setNotice(`Key (${selectedKey.row},${selectedKey.col}) on layer ${layer} is now ${labelFor(verified)} — saved in the keyboard itself.`)
      }
      setSelectedKey(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const importDefinition = async () => {
    setError(null)
    setNotice(null)
    try {
      const { name } = await window.keebind.viaImportDefinition(importText)
      setNotice(`Imported definition "${name}". Select the device again.`)
      setImportText('')
      refreshDevices()
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const layoutSize = useMemo(() => {
    if (!detail) return { w: 0, h: 0 }
    let w = 0
    let h = 0
    for (const k of detail.keys) {
      w = Math.max(w, (k.x + k.w) * UNIT)
      h = Math.max(h, (k.y + k.h) * UNIT)
    }
    return { w, h }
  }, [detail])

  return (
    <div>
      <h1>VIA Devices</h1>
      <p className="subtitle">
        Remap keys directly in the keyboard&apos;s own memory — changes persist even when you plug
        the board into another computer. Requires a wired or 2.4&nbsp;GHz dongle connection
        (Bluetooth does not carry VIA&apos;s configuration channel).
      </p>

      <div className="row" style={{ marginBottom: 12 }}>
        <Tooltip tip="Rescan USB for VIA-compatible keyboards and macropads">
          <button className="btn" onClick={refreshDevices}>
            ⟳ Refresh devices
          </button>
        </Tooltip>
        <span className="muted small">
          {devices.length === 0
            ? 'No VIA devices detected.'
            : `${devices.length} VIA device${devices.length === 1 ? '' : 's'} detected.`}
        </span>
      </div>

      {devices.map((d) => (
        <div className="binding-card" key={d.path}>
          <div style={{ flex: 1 }}>
            <div className="desc">{d.name}</div>
            <div className="action-summary">
              {d.manufacturer} · {hex(d.vendorId)}:{hex(d.productId)}
              {!d.hasDefinition && ' · no layout definition'}
            </div>
          </div>
          <Tooltip
            tip={
              d.hasDefinition
                ? 'Read this keyboard’s layout and current keymap'
                : 'No definition found — import this board’s VIA JSON below first'
            }
          >
            <button className="btn primary" disabled={busy} onClick={() => openDevice(d.path)}>
              {detail?.path === d.path ? 'Reload' : 'Configure'}
            </button>
          </Tooltip>
        </div>
      ))}

      {error && <div className="alert warning">⚠ {error}</div>}
      {notice && <div className="alert info">ℹ {notice}</div>}

      {detail && (
        <div className="panel">
          <div className="row">
            <strong>{detail.name}</strong>
            <span className="muted small">
              VIA protocol v{detail.protocolVersion} · {detail.layerCount} layers ·{' '}
              {detail.matrix.rows}×{detail.matrix.cols} matrix
            </span>
          </div>

          <div className="layer-tabs">
            {Array.from({ length: detail.layerCount }, (_, i) => (
              <Tooltip key={i} tip={`Show and edit layer ${i}`}>
                <button
                  className={`btn ${layer === i ? 'primary' : ''}`}
                  onClick={() => {
                    setLayer(i)
                    setSelectedKey(null)
                  }}
                >
                  Layer {i}
                </button>
              </Tooltip>
            ))}
          </div>

          <div className="kb-wrap">
            <div className="kb-layout" style={{ width: layoutSize.w, height: layoutSize.h }}>
              {detail.keys.map((k, i) => {
                const code = detail.keymap[layer]?.[k.row]?.[k.col] ?? 0
                const selected = selectedKey?.row === k.row && selectedKey?.col === k.col
                return (
                  <button
                    key={i}
                    type="button"
                    className={`kb-key ${selected ? 'selected' : ''}`}
                    title={`Matrix (${k.row},${k.col}) — ${hex(code)}. Click to remap.`}
                    style={{
                      left: k.x * UNIT,
                      top: k.y * UNIT,
                      width: k.w * UNIT - 4,
                      height: k.h * UNIT - 4
                    }}
                    onClick={() => setSelectedKey(selected ? null : k)}
                  >
                    {labelFor(code)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {selectedKey && detail && (
        <div className="picker-overlay" onClick={() => setSelectedKey(null)}>
          <div className="picker" onClick={(e) => e.stopPropagation()}>
            <h3>
              Remap key ({selectedKey.row},{selectedKey.col}) on layer {layer}
            </h3>
            <p className="muted small" style={{ marginTop: -6 }}>
              Pick the new keycode. It is written to the keyboard immediately and verified by
              reading it back.
            </p>
            {categories.map((cat) => (
              <div key={cat.name}>
                <div className="cat-name">{cat.name}</div>
                <div className="kc-grid">
                  {cat.keycodes.map((kc) => (
                    <button
                      key={kc.code}
                      className="kc"
                      disabled={busy}
                      onClick={() => assign(kc.code)}
                    >
                      {kc.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="cat-name">Advanced (raw QMK keycode)</div>
            <div className="row">
              <input
                type="text"
                placeholder="0x5C00"
                value={rawHex}
                onChange={(e) => setRawHex(e.target.value)}
                style={{ width: 130 }}
              />
              <Tooltip tip="Write this raw 16-bit QMK keycode (hex) — for layer taps, macros, or custom codes">
                <button
                  className="btn"
                  disabled={busy || !/^(0x)?[0-9a-f]{1,4}$/i.test(rawHex.trim())}
                  onClick={() => assign(parseInt(rawHex.trim(), 16))}
                >
                  Write raw code
                </button>
              </Tooltip>
              <div className="spacer" />
              <button className="btn" onClick={() => setSelectedKey(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <strong>Import a VIA definition</strong>
        <p className="muted small">
          If your board isn&apos;t recognized, paste its VIA definition JSON here (from the vendor,
          or from{' '}
          <span style={{ fontFamily: 'monospace' }}>github.com/the-via/keyboards</span>). You can
          also bundle the full official catalog by running{' '}
          <span style={{ fontFamily: 'monospace' }}>npm run via:definitions</span>.
        </p>
        <textarea
          rows={4}
          style={{ width: '100%' }}
          placeholder='{"name": "...", "vendorId": "0x...", "productId": "0x...", "matrix": {...}, "layouts": {...}}'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <div className="spacer" />
          <Tooltip tip="Validate and save this definition for matching devices">
            <button className="btn primary" disabled={!importText.trim()} onClick={importDefinition}>
              Import definition
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
