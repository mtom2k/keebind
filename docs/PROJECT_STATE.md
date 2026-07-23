# Keebind — Project State

_Last updated: 2026-07-23_

## Status: v0.1.0 — feature-complete v1, macOS-verified

| Feature | Status | Notes |
|---|---|---|
| Tray / menu-bar residency | ✅ Done | macOS menu bar (template icon, Dock hidden), Windows notification area. Close hides the window; Quit is in the tray menu. |
| Light/Dark theme | ✅ Done | Defaults to system; overridable in Settings. `nativeTheme.themeSource` → CSS `prefers-color-scheme`. |
| Key Listener | ✅ Done | `uiohook-napi` global hook, opt-in start/stop. Shows key name, keycode, modifiers, history. macOS permission detection + settings shortcuts. |
| Hotkey → action bindings | ✅ Done | Electron `globalShortcut`. Actions: launch app, open URL, open path, shell command, multi-step workflow with per-step delays. Per-binding enable toggle + master switch. "Not registered" badge when the OS refuses a hotkey. |
| Conflict warnings | ✅ Done | Per-OS databases (`src/main/data/conflicts/darwin.json`, `win32.json`) incl. researched F13–F24 guidance; also warns on duplicate in-app bindings. Checked live while editing a binding. |
| VIA device remapping | ✅ Done (needs hardware test) | Raw-HID protocol (`0xFF60`/`0x61`), device discovery, layer tabs, layout render from VIA definition, keycode picker + raw hex, write-then-read-back verification. Custom definition import; optional bundled catalog via `npm run via:definitions`. |
| Tooltips everywhere | ✅ Done | `Tooltip` component / `title` on all actionable controls, incl. tray menu items. |
| Launch at login | ✅ Done | Works in packaged builds only (macOS restriction for unsigned dev builds). |
| Packaging | ✅ Configured | electron-builder: mac dmg+zip (unsigned, `identity: null`), win NSIS. |

## Verified

- macOS (this machine): dev run, tray, all four views, binding editor + conflict warnings, VIA flow end-to-end against the browser dev mock, typecheck + production bundle clean.

## Not yet verified (open items)

- **Windows runtime**: tray behavior, conflict DB accuracy, `start`-based app launching, NSIS install. Needs a Windows machine.
- **VIA against real hardware**: protocol implemented per QMK `via.h` (protocol commands 0x01/0x04/0x05/0x11/0x12); mock-verified only. Test with any VIA board.
- **uiohook on macOS with permissions granted**: listener code paths verified; the actual Accessibility/Input Monitoring grant flow needs a manual once-through.

## Planned / deferred (phase 2)

- **OS-level key-to-key interception for non-VIA boards** (e.g. CapsLock→Esc system-wide). Deliberately deferred — see DECISIONS.md #3. Would need a native N-API module: `WH_KEYBOARD_LL` + `SendInput` (Windows), `CGEventTap` + repost (macOS).
- KLE rotation support in the VIA layout renderer (ergo boards currently render at their x/y anchor without rotation).
- Auto-update (electron-updater) once there's a release channel.
- Code signing / notarization when certificates are available.
