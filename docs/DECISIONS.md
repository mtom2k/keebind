# KeeBind: Decision Log

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
**Consequences:** Zero deps, trivially debuggable; no schema migrations, so add them if the config ever changes shape incompatibly.

## 5. Two input paths: globalShortcut for bindings, uiohook for listening (2026-07-23)

**Context:** A binding should *consume* the keypress; the listener must *observe all* keys. No single API does both well.
**Decision:** Electron `globalShortcut` registers bindings; `uiohook-napi` powers the opt-in listener only.
**Consequences:** Bindings work without any macOS permissions; permissions are requested only when the user starts the listener. The listener cannot suppress keys (fine, since it's a diagnostic view).

## 6. Icons generated from code (2026-07-23)

**Context:** Needed macOS template + Windows tray + 512px app icons without binary assets in the repo.
**Decision:** `scripts/generate-icons.mjs` contains a minimal PNG encoder (zlib + CRC) and draws the keyboard glyph programmatically.
**Consequences:** Icons are diffable and regenerable (`npm run icons`); changing the design means editing drawing code, not asset files.

## 7. Browser dev mock for the renderer (2026-07-23)

**Context:** The renderer crashes in a plain browser (no preload bridge), which blocked browser-based UI development and automated UI verification.
**Decision:** `devMock.ts` installs an in-memory `window.keebind` (including a fake VIA macropad) when the bridge is absent.
**Consequences:** Full UI (including the VIA remap flow) is developable and testable at http://localhost:5173 with no Electron, hardware, or permissions. The mock never runs inside Electron.

## 8. Ad-hoc code signing for macOS instead of no signing (2026-07-23)

**Context:** The Accessibility pane listed the app under the name of whatever launched it (a terminal, an agent process) rather than "KeeBind", and the app never appeared under Input Monitoring at all. Root cause: `identity: null` made electron-builder skip signing, so the packaged bundle kept Electron's own linker signature. `codesign -dv` reported `Identifier=Electron`, `Info.plist=not bound`, `Sealed Resources=none`. macOS privacy (TCC) identifies a client by its code signature; with no usable identity it falls back to the *responsible process*, i.e. the launcher.
**Decision:** Ad-hoc sign (`mac.identity: '-'`, supported natively by electron-builder 26) with `hardenedRuntime: false`, and pin `CFBundleName`/`CFBundleDisplayName` via `extendInfo`. Hardened runtime must be off because it enforces library validation, which rejects the pre-signed Electron framework's different Team ID.
**Consequences:** Verified after the change: `Identifier=com.keebind.app`, Info.plist bound, 252 resources sealed, `codesign --verify --deep --strict` passes. The panes now say KeeBind. An ad-hoc signature has no certificate, so its designated requirement is content-based: **grants must be re-given after every update** until a real Developer ID certificate exists. Under `npm run dev` the running bundle genuinely is `node_modules/.../Electron.app`, so the mis-attribution is unavoidable there. The UI says so instead of implying the permission is broken.

## 9. Portal-rendered tooltips (2026-07-23)

**Context:** Tooltips were a CSS `::after` on the trigger element. As a descendant they were clipped by `.content`'s `overflow-y: auto` and by the window edges, so tips on controls near the top of a view or inside the sidebar were cut off.
**Decision:** Render the bubble through a React portal into `<body>` with `position: fixed`, measure trigger and bubble, clamp horizontally to the viewport and flip below the anchor when there is no room above.
**Consequences:** No ancestor can clip a tooltip regardless of future layout. Costs a render pass to measure (the bubble is `visibility: hidden` until placed, so there is no flash) and a scroll/resize listener while open. `data-tip` is gone; the tip is a prop.

## 10. Input Monitoring is requested by opening a HID keyboard (2026-07-23)

**Context:** Electron exposes `isTrustedAccessibilityClient` but nothing for Input Monitoring (`kTCCServiceListenEvent`), and macOS only lists an app in that pane once the app has actually requested the permission. Opening the pane first, which is all the old UI could do, therefore showed no KeeBind entry, which read as a bug.
**Decision:** Request it by opening a keyboard-class HID device (usage page 0x01, usage 0x06) with node-hid, non-exclusively, closing immediately. That call is exactly what TCC gates, so it both registers the app in the pane and reports whether access was granted. No native module: node-hid is already a dependency for VIA.
**Consequences:** Honours the repo's "no new native code" rule. The probe prompts the user the first time, so it runs only on explicit action and the result is cached. `permissionsInfo()` reports `unknown` until then rather than re-prompting on every poll. If no HID keyboard is enumerated (some Apple-silicon internal keyboards), the state stays `unknown` and the UI offers "Reveal app in Finder" for a manual "+" add.

## 11. The tray popover is a window, not a native menu (2026-07-23)

**Context:** Pinned bindings needed a Run button and a Manage button on each row, revealed on hover. A native Electron `Tray` menu can show an icon per item, but each row is one click target with no hover state of its own, so two buttons per row are not possible.
**Decision:** Build the popover as a frameless, transparent, always-on-top `BrowserWindow` that loads the existing renderer bundle at `#popover`. Left-click on the tray icon toggles it; right-click still opens the native menu with the app-wide switches. On macOS we deliberately skip `setContextMenu`, because attaching a menu makes left-click open it and there would be no way to reach the popover.
**Consequences:** Exactly the requested interaction, and the panel is styled with the same CSS variables as the rest of the app, so it follows the theme for free. Costs a second window and its own positioning code (`position()` in `popover.ts` keeps it on the display the tray icon is on and flips above the icon for a bottom Windows taskbar). The window is destroyed on `before-quit`, since a hidden frameless window would otherwise keep the process alive.

## 12. Browse buttons instead of typed paths (2026-07-23)

**Context:** Launch app and Open file/folder both took a raw path. Few people know the full path to an app off the top of their head.
**Decision:** A `dialog:pick` channel wrapping `dialog.showOpenDialog`, with Browse buttons on the path targets in both the single-action editor and every workflow step.
**Consequences:** Windows dialogs cannot offer files and folders in one dialog, so Open file/folder gets two buttons (File, Folder) on both platforms rather than behaving differently per OS. macOS `.app` bundles are directories, but dialogs treat packages as files by default, so plain `openFile` selects the bundle and `open -a` accepts it.

## 13. Detect and clear stale TCC grants (2026-07-23)

**Context:** A user reported that System Settings showed KeeBind ticked under Accessibility while KeeBind itself reported no access, and that the entry survived trashing the app. Nothing appeared under Input Monitoring at all.
**Cause, confirmed with `codesign -d -r- KeeBind.app`:** our designated requirement is `cdhash H"9d5278..."` and nothing else. No identifier clause, no certificate, because an ad-hoc signature has none. TCC stores that requirement at grant time, and the cdhash is a hash of the binary, so **every rebuild invalidates the grant while the pane keeps showing the old row as enabled**. TCC records are keyed by bundle id and outlive the bundle, which is why deleting the app changed nothing.
**Decision:** Record the cdhash whenever a grant succeeds (`store.permissionIdentity`). When Accessibility reports denied and the stored identity differs from the running one, set `staleGrant` and say so in plain language. Offer `tccutil reset Accessibility com.keebind.app` and the same for `ListenEvent`, which clears the dead record without any special privileges and is scoped to our own bundle id.
**Consequences:** The disparity is now explained rather than mysterious, and recoverable in one click. It does not go away permanently: until there is a Developer ID certificate, whose requirement is certificate-based and survives rebuilds, every update needs a re-grant. That is now the headline argument for getting a certificate.

## 14. One button for permissions (2026-07-23)

**Context:** The panel had "Request" and "Open pane" side by side for each permission. Users reached for "Open pane" first, which does nothing useful on its own, because macOS will not list an app in a privacy pane until the app has asked. That is very likely why Input Monitoring stayed empty.
**Decision:** One primary button per permission, "Request permission". Opening the panes, revealing the bundle in Finder and clearing records moved into a help block behind "Asked already and it still says no?", which only appears when something is actually denied.
**Consequences:** The action that works is the only one competing for attention. Recovery steps are still one click away when they are needed.

## 15. Input Monitoring asks twice (2026-07-23)

**Context:** `requestInputMonitoring()` only opened a keyboard-class HID device. If none was enumerable, it gave up and KeeBind never registered in the pane.
**Decision:** Keep the HID open as the first attempt, and fall back to creating and immediately tearing down a keyboard CGEventTap through uiohook (`pokeEventTap`). Both calls are gated on `kTCCServiceListenEvent`, so either one registers us. Also widened the device filter from usage 6 to usages 6 and 7 (keyboard and keypad).
**Consequences:** Registration no longer depends on the hardware present. This exposed a latent bug in `listener.ts`: the event handler was captured in a closure on the first `startListener` call and never rebound, so a second caller was silently ignored. The handler now lives in a variable that each call updates.

## 16. Remove VIA and all raw-HID device support (2026-07-25)

**Context:** KeeBind is being narrowed to global hotkey bindings, key diagnostics, conflict warnings and tray access. Hardware discovery, definition management and firmware programming are no longer part of the solution.
**Decision:** Remove the VIA tab and renderer, all VIA IPC and shared types, the raw-HID protocol and device/definition modules, the catalog-fetch script, browser mock support, and `node-hid`. Input Monitoring requests now use only the existing `uiohook` CGEventTap path.
**Consequences:** KeeBind no longer identifies, opens, configures or remaps keyboards. There is no raw-HID access or definition import/catalog flow. The only native dependency is `uiohook-napi`; arbitrary software key-to-key remapping remains out of scope.
