# Keebind — Decision Log

Append-only. Newest last. Each entry: context → decision → consequences.

## 1. Electron + TypeScript over Tauri + Rust (2026-07-23)

**Context:** Cross-platform tray app needing global key hooks, raw HID, and system-theme awareness.
**Decision:** Electron. The exact libraries this app needs are mature there: `uiohook-napi` (maintained iohook successor), `node-hid` (battle-tested raw HID), first-class `Tray`/`nativeTheme`/`globalShortcut` APIs, and electron-builder producing both installers from one machine.
**Consequences:** ~100 MB installed footprint; in exchange, no custom native glue to maintain. Confirmed with the user during planning.

## 2. VIA support in v1 (2026-07-23)

**Context:** "True remapping" was a core wish; VIA-compatible boards expose a documented raw-HID protocol.
**Decision:** Implement the VIA dynamic-keymap protocol (commands 0x01, 0x04, 0x05, 0x11, 0x12) over `node-hid`. Definitions come from the official catalog (bundled on demand) or user import.
**Consequences:** Real hardware-level remapping with zero OS hooks; requires wired/dongle connection (VIA over Bluetooth isn't a thing firmware-side). Layout rendering ignores KLE rotation for now.

## 3. OS-level key-to-key interception deferred (2026-07-23)

**Context:** Remapping arbitrary (non-VIA) keys system-wide requires a low-level hook that *consumes* events: `WH_KEYBOARD_LL`+`SendInput` on Windows, `CGEventTap`+repost on macOS. No maintained Node module exposes suppression on both platforms; it would mean writing and maintaining our own native module.
**Decision:** Defer to phase 2, per the user's explicit escape clause. v1 covers the need via VIA (hardware remap) + hotkey→action bindings.
**Consequences:** CapsLock→Esc-style software remap on ordinary keyboards is out of scope for now; the conflict DB points users to OS/VIA alternatives.

## 4. Hand-rolled JSON store instead of electron-store (2026-07-23)

**Context:** electron-store v9+ is ESM-only, which fights the CJS main bundle electron-vite emits by default.
**Decision:** ~80-line `Store` class writing `userData/config.json`.
**Consequences:** Zero deps, trivially debuggable; no schema migrations — add them if the config ever changes shape incompatibly.

## 5. Two input paths: globalShortcut for bindings, uiohook for listening (2026-07-23)

**Context:** A binding should *consume* the keypress; the listener must *observe all* keys. No single API does both well.
**Decision:** Electron `globalShortcut` registers bindings; `uiohook-napi` powers the opt-in listener only.
**Consequences:** Bindings work without any macOS permissions; permissions are requested only when the user starts the listener. The listener cannot suppress keys (fine — it's a diagnostic view).

## 6. Icons generated from code (2026-07-23)

**Context:** Needed macOS template + Windows tray + 512px app icons without binary assets in the repo.
**Decision:** `scripts/generate-icons.mjs` contains a minimal PNG encoder (zlib + CRC) and draws the keyboard glyph programmatically.
**Consequences:** Icons are diffable and regenerable (`npm run icons`); changing the design means editing drawing code, not asset files.

## 7. Browser dev mock for the renderer (2026-07-23)

**Context:** The renderer crashes in a plain browser (no preload bridge), which blocked browser-based UI development and automated UI verification.
**Decision:** `devMock.ts` installs an in-memory `window.keebind` (including a fake VIA macropad) when the bridge is absent.
**Consequences:** Full UI (including the VIA remap flow) is developable and testable at http://localhost:5173 with no Electron, hardware, or permissions. The mock never runs inside Electron.
