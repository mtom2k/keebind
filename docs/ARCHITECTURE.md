# KeeBind: Architecture

## Stack

Electron (43) + TypeScript + React 19, built with electron-vite (Vite 7), packaged with electron-builder. Two native deps, both prebuilt N-API: `uiohook-napi` (global key listening) and `node-hid` (VIA raw HID).

## Process model

```
┌────────────────────── main process ──────────────────────┐
│ index.ts      lifecycle, single-instance, app.setName    │
│ window.ts     BrowserWindow (close = hide), dock icon    │
│ popover.ts    tray popover window + About window         │
│ paths.ts      resources/ + icon path resolution          │
│ tray.ts       Tray icon: click = popover, right = menu   │
│ permissions.ts macOS TCC: status, request, reveal        │
│ store.ts      hand-rolled JSON store (userData/config)   │
│ ipc.ts        ALL ipcMain.handle channels live here      │
│ listener.ts   uiohook wrapper + keycode→name mapping     │
│ bindings/                                                │
│   engine.ts    globalShortcut register/refresh           │
│   actions.ts   action runners (spawn/openExternal/…)     │
│   conflicts.ts accelerator normalizer + DB lookup        │
│ via/                                                     │
│   protocol.ts  32-byte report framing, VIA commands      │
│   hid.ts       discovery + stateless open/read/write     │
│   definitions.ts bundled/custom defs + KLE parser        │
│   keycodes.ts  QMK basic keycode table (picker data)     │
│ data/conflicts/{darwin,win32}.json  conflict databases   │
└──────────────┬───────────────────────────────────────────┘
               │ typed IPC (invoke/handle + one push event)
┌──────────────┴─────── preload ───────────────────────────┐
│ index.ts   contextBridge → window.keebind (KeeBindApi)   │
└──────────────┬───────────────────────────────────────────┘
┌──────────────┴─────── renderer (React) ──────────────────┐
│ main.tsx   routes on location.hash: main | popover|about │
│ App.tsx    sidebar nav → 5 views                         │
│ chord.ts   key event stream → chords + accelerators      │
│ views/     BindingsView, ListenerView, ViaView,          │
│            SettingsView, AboutView, PopoverView          │
│ components/ Tooltip, Logo, Icon, PermissionPanel,        │
│             KeyCaptureField, ActionEditor                │
│ devMock.ts in-browser mock of KeeBindApi (no Electron)   │
└──────────────────────────────────────────────────────────┘
```

## IPC contract

Defined in `src/main/ipc.ts`, typed in `src/preload/index.ts` (`KeeBindApi`), exposed as `window.keebind`. Shared payload types: `src/shared/types.ts`.

| Channel | Direction | Purpose |
|---|---|---|
| `app:info` | invoke | version + platform |
| `settings:get` / `settings:set` | invoke | `Settings` (theme, launchAtLogin, bindingsEnabled, showDockIcon); set applies side effects (nativeTheme, login item, dock visibility, tray menu, re-register) |
| `bindings:list` / `bindings:save` / `bindings:delete` | invoke | CRUD; every mutation re-registers all shortcuts and returns fresh `BindingStatus[]` |
| `bindings:run` | invoke | runs a binding's action now, without its hotkey (popover Run, editor Run) |
| `bindings:checkConflicts` | invoke | `ConflictHit[]` for an accelerator (OS DB + in-app duplicates) |
| `listener:start` / `listener:stop` / `listener:status` | invoke | uiohook control; status includes macOS accessibility flag |
| `listener:key` | main→renderer push | `KeyEventPayload` stream while listening (both edges; `modifier` tags Shift/Ctrl/Alt/Meta) |
| `permissions:open` | invoke | deep-link into macOS privacy panes |
| `permissions:info` | invoke | `PermissionsInfo`, the state of both grants, TCC identity, packaged flag |
| `permissions:request` | invoke | actively request a grant (this is what registers the app in a pane) |
| `permissions:reveal` | invoke | show the app bundle in Finder for manual "+" adds |
| `permissions:reset` | invoke | `tccutil reset` for both services, clearing stale grants |
| `dialog:pick` | invoke | native file picker for app / file / folder targets; null if cancelled |
| `popover:resize` / `popover:hide` | invoke | the popover sizes itself to its content and dismisses itself |
| `popover:refresh` | main→renderer push | the pinned list changed, or the popover was just shown |
| `app:showAbout` | invoke | open the standalone About window |
| `app:quit` | invoke | quit from the popover's power button |
| `app:navigate` | invoke + main→renderer push | show the main window on a given view, optionally opening one binding |
| `via:list` / `via:open` / `via:setKeycode` / `via:importDefinition` / `via:keycodes` / `via:bundledCount` | invoke | VIA device flows |

## Key design points

- **Two input mechanisms on purpose.** Bindings use Electron `globalShortcut` (the OS consumes the keypress, which is what you want for a hotkey). The listener uses `uiohook-napi` (passive observation of *all* keys). They are independent; the listener is opt-in so macOS permissions are only requested when the user asks for it.
- **Hotkey capture** (`KeyCaptureField`) uses DOM `KeyboardEvent.code` mapped to Electron accelerator tokens. No permissions are needed, because the window is focused during capture. Manual text entry covers anything the DOM can't see.
- **Conflict checking** normalizes accelerators (`normalizeAccelerator`) so `CmdOrCtrl+shift+k` ≡ `Command+Shift+K` on macOS ≡ `Control+Shift+K` on Windows, then matches against the per-OS JSON DB. Bare-key notes (F13 to F24 etc.) only fire for unmodified keys.
- **VIA is stateless per request**: every operation opens the HID handle, talks, and closes. No dangling handles when boards unplug. Writes are verified by read-back (`setKeycode` returns the re-read value).
- **VIA definitions**: matched by `vendorId:productId`. Custom imports (userData/via-definitions/) take precedence over the bundled catalog (`resources/via-definitions.json`, generated by `scripts/fetch-via-definitions.mjs`, absent by default). The KLE parser handles x/y/w/h offsets and decals; rotation is ignored (v1).
- **Theme**: main sets `nativeTheme.themeSource` from settings; the renderer styles purely off `prefers-color-scheme` CSS variables. No theme IPC needed.
- **Store**: ~80-line JSON file store (`userData/config.json`). Deliberately not electron-store (see DECISIONS.md).
- **Chords, not keystrokes**: `src/renderer/src/chord.ts` folds the raw keydown/keyup stream into whole combinations. Modifiers are derived from each event's flags (they can't get stuck when a keyup is missed); a chord is committed to history when it shrinks below its peak, so releasing ⌘⌃⇧F records one four-key chord rather than four shrinking ones. Unmodified keys never group, so typing rollover reads as "A" then "B". `chordToAccelerator` renders a chord as an Electron accelerator for the Bindings field.
- **Three windows, one bundle.** `main.tsx` reads `location.hash` and renders the main app, the tray popover, or the About panel. The popover is a real frameless window rather than a native `Tray` menu, because a native menu row is a single click target and cannot hold the per-row Run and Manage buttons (see DECISIONS.md #11). It reports its content height over `popover:resize` and hides on blur.
- **Permission grants are pinned to the binary.** Ad-hoc signing gives a designated requirement of `cdhash` alone, so a rebuild silently invalidates every grant while the privacy pane keeps showing the old row ticked. `permissions.ts` stores the cdhash it was granted under and reports `staleGrant` when the running build differs, with a `tccutil`-based reset to clear the dead record (DECISIONS.md #13).
- **Pinned bindings** carry `Binding.pinned`. Saving or deleting any binding calls `refreshPopover()` so the menu-bar list never goes stale. The popover's Manage button routes through `app:navigate`, which shows the main window and hands the renderer a `bindingId` to open.
- **Tooltips are portalled**: `Tooltip` renders its bubble into `<body>` with `position: fixed`, measured and clamped to the viewport. As a CSS `::after` on the trigger it was clipped by `.content`'s overflow and by the window edges (see DECISIONS.md #9).
- **Icons are code**: `scripts/generate-icons.mjs` writes every PNG with a self-contained encoder plus a supersampling rasterizer over unit-space shapes, so one geometry renders cleanly at 16px and 1024px. Three lockups of one mark: full (app icon), small (Windows tray), stencil (macOS template). `components/Logo.tsx` mirrors the full lockup as inline SVG for the UI.
- **Packaging**: `electron-builder.yml`: `resources/` ships via extraResources, native modules asar-unpacked, mac **ad-hoc signed** (`identity: '-'`, `hardenedRuntime: false`) so macOS privacy attributes grants to KeeBind (see DECISIONS.md #8). No `LSUIElement`: the Dock icon shows by default and `app.dock.hide()` removes it when "Show in Dock" is off.
