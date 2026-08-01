# KeeBind: Architecture

## Stack

Electron (43) + TypeScript + React 19, built with electron-vite (Vite 7), packaged with electron-builder. The only native dependency is the prebuilt `uiohook-napi` package for global key listening.

## Process model

```
┌────────────────────── main process ──────────────────────┐
│ index.ts      lifecycle, single-instance, app.setName    │
│ window.ts     bounded window, close=hide, Dock/taskbar   │
│ popover.ts    tray popover window + About window         │
│ confirmation.ts dedicated guarded-run confirmation window│
│ paths.ts      resources/ + icon path resolution          │
│ tray.ts       Tray icon: click = popover, right = menu   │
│ permissions.ts macOS TCC: live status, request, reveal   │
│ paths.ts      packaged/dev resource paths                │
│ store.ts      hand-rolled JSON store (userData/config)   │
│ ipc.ts        ALL ipcMain.handle channels live here      │
│ listener.ts   uiohook wrapper + keycode→name mapping     │
│ bindings/                                                │
│   engine.ts    globalShortcut register/refresh           │
│   execution.ts confirmation + sole binding run boundary  │
│   actions.ts   action runners (spawn/openExternal/…)     │
│   conflicts.ts accelerator normalizer + DB lookup        │
│ data/conflicts/{darwin,win32}.json  conflict databases   │
└──────────────┬───────────────────────────────────────────┘
               │ typed IPC (invoke/handle + one push event)
┌──────────────┴─────── preload ───────────────────────────┐
│ index.ts   contextBridge → window.keebind (KeeBindApi)   │
└──────────────┬───────────────────────────────────────────┘
┌──────────────┴─────── renderer (React) ──────────────────┐
│ main.tsx   routes on location.hash: main | popover|about │
│ App.tsx    sidebar nav → 4 views                         │
│ chord.ts   key event stream → chords + accelerators      │
│ binding-search.ts shared binding/pinned query matcher     │
│ views/     BindingsView, ListenerView, SettingsView,      │
│            AboutView, PopoverView                         │
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
| `settings:get` / `settings:set` | invoke | `Settings` (theme, launchAtLogin, bindingsEnabled, showDockIcon, showTechnicalDetails); set applies side effects (nativeTheme, login item, Dock/taskbar visibility, tray menu, re-register) |
| `bindings:list` / `bindings:save` / `bindings:delete` | invoke | CRUD; save/delete re-register shortcuts and return fresh `BindingStatus[]` |
| `bindings:reorder` | invoke | validates and persists binding IDs in display order, then refreshes the pinned popover without re-registering unchanged shortcuts |
| `bindings:run` | invoke | executes through the same confirmation gate as global hotkeys; returns `BindingRunResult` (`ran` or `denied`) |
| `confirmation:get` / `confirmation:respond` | invoke | restricted bridge used by the active custom confirmation window to read the pending binding summary and deny/approve it |
| `bindings:checkConflicts` | invoke | `ConflictHit[]` for an accelerator (OS DB + in-app duplicates) |
| `listener:start` / `listener:stop` / `listener:status` | invoke | uiohook control; status includes macOS Accessibility and a blocked reason |
| `listener:key` | main→renderer push | `KeyEventPayload` stream while listening (both edges; `modifier` tags Shift/Ctrl/Alt/Meta) |
| `permissions:open` | invoke | deep-link into macOS Accessibility |
| `permissions:info` | invoke | `PermissionsInfo`, Accessibility state, TCC identity, packaged flag |
| `permissions:request` | invoke | actively request Accessibility |
| `permissions:reveal` | invoke | show the app bundle in Finder for manual "+" adds |
| `permissions:reset` | invoke | `tccutil reset Accessibility`, clearing a stale grant |
| `dialog:pick` | invoke | native file picker for app / file / folder targets; null if cancelled |
| `popover:resize` / `popover:hide` | invoke | the popover sizes itself to its content; dismissal disposes the transparent window so the next opening gets a clean native presentation |
| `popover:refresh` | main→renderer push | the pinned list changed, or the popover was just shown |
| `app:showAbout` | invoke | open the standalone About window |
| `app:quit` | invoke | quit from the popover's power button |
| `app:navigate` | invoke + main→renderer push | show the main window on a given view, optionally opening one binding |

## Key design points

- **Two input mechanisms on purpose.** Bindings use Electron `globalShortcut` (the OS consumes the keypress, which is what you want for a hotkey). The listener uses `uiohook-napi` (passive observation of *all* keys). They are independent; the listener is opt-in so macOS permissions are only requested when the user asks for it.
- **Hotkey capture** (`KeyCaptureField`) uses DOM `KeyboardEvent.code` mapped to Electron accelerator tokens. No permissions are needed, because the window is focused during capture. Manual text entry covers anything the DOM can't see.
- **Conflict checking** normalizes accelerators (`normalizeAccelerator`) so `CmdOrCtrl+shift+k` ≡ `Command+Shift+K` on macOS ≡ `Control+Shift+K` on Windows, then matches against the per-OS JSON DB. Bare-key notes (F13 to F24 etc.) only fire for unmodified keys.
- **Theme**: main sets `nativeTheme.themeSource` from settings; the renderer styles purely off `prefers-color-scheme` CSS variables. No theme IPC needed.
- **Store**: ~80-line JSON file store (`userData/config.json`). Deliberately not electron-store (see DECISIONS.md).
- **Chords, not keystrokes**: `src/renderer/src/chord.ts` folds the raw keydown/keyup stream into whole combinations. Modifiers are derived from each event's flags (they can't get stuck when a keyup is missed); a chord is committed to history when it shrinks below its peak, so releasing ⌘⌃⇧F records one four-key chord rather than four shrinking ones. Unmodified keys never group, so typing rollover reads as "A" then "B". `chordToAccelerator` renders a chord as an Electron accelerator for the Bindings field.
- **Four window surfaces, one bundle.** `main.tsx` reads `location.hash` and renders the main app, tray popover, About panel, or binding-confirmation window. The popover is a real frameless window rather than a native `Tray` menu, because a native menu row is a single click target and cannot hold the per-row Run and Manage buttons (see DECISIONS.md #11). Every presentation creates a fresh transparent window, keeps it hidden until the renderer has loaded the binding list and reported its content height, then shows it once. Dismissal destroys that window instead of retaining it for a Windows re-show, which avoids the compositor flash that affected every opening after the first. Its delayed blur dismissal also coalesces the transient blur/focus handoff emitted by the Windows notification area.
- **Permission grants are pinned to the binary.** Ad-hoc signing gives a designated requirement of `cdhash` alone, so a rebuild silently invalidates every grant while the privacy pane keeps showing the old row ticked. `permissions.ts` stores the cdhash it was granted under and reports `staleGrant` when the running build differs, with a `tccutil`-based reset to clear the dead record (DECISIONS.md #13).
- **Accessibility is the sole listener permission.** libuiohook hard-codes an active `kCGEventTapOptionDefault` and checks `AXIsProcessTrusted` before starting. Apple states that Accessibility grants both event listening and posting; Input Monitoring is the narrower alternative for passive listen-only taps. Requiring both was incorrect. `startListener()` therefore checks Accessibility only and reports `blockedReason: permissions` when it is absent.
- **The listener permission gate is platform-specific.** Accessibility is checked only on macOS. Windows starts uiohook directly and the renderer treats the absence of a macOS permission record as allowed, not denied.
- **Pinned bindings** carry `Binding.pinned`. Saving, deleting or reordering bindings calls `refreshPopover()` so the menu-bar list never goes stale. The popover filters the persisted binding array without sorting it, so pinned entries inherit the Bindings-tab order. Its Manage button routes through `app:navigate`, which shows the main window and hands the renderer a `bindingId` to open.
- **Binding execution has one gate.** Global shortcuts and every manual Run entry call `executeBinding()`. `Binding.confirmBeforeRun` opens a fail-closed custom KeeBind window with the hotkey, separate name and description, and full action details; rapid duplicate triggers share one in-flight result. A visible main window owns confirmations it initiated, while global-hotkey confirmations are standalone and never reveal the hidden main application. macOS application activation focuses an open standalone prompt instead of opening the main window. The IPC bridge accepts an answer only from the active confirmation renderer. Acceptance is revalidated against the saved binding before `runAction`, preventing an edited, disabled, or deleted binding from executing through an obsolete prompt.
- **Binding records remain backward-compatible.** `Binding.name` and `Binding.confirmBeforeRun` are optional in the persisted type. A pre-v0.2.8 record therefore keeps its description as the display name and runs without prompting until the user opts in.
- **Binding search is shared.** `bindingMatchesQuery()` applies the same case-insensitive all-term match to the Bindings tab and pinned popover, including name, accelerator, description, action type, workflow steps, targets and arguments.
- **Tooltips are portalled**: `Tooltip` renders its bubble into `<body>` with `position: fixed`, measured and clamped to the viewport. As a CSS `::after` on the trigger it was clipped by `.content`'s overflow and by the window edges (see DECISIONS.md #9).
- **Icons are code**: `scripts/generate-icons.mjs` writes every PNG with a self-contained encoder plus a supersampling rasterizer over unit-space shapes, so one geometry renders cleanly at 16px and 1024px. Three lockups of one mark: full (app icon), small (Windows tray), stencil (macOS template). `components/Logo.tsx` mirrors the full lockup as inline SVG for the UI.
- **Shell visibility is one setting with two implementations.** `applyShellVisibility()` stores the desired value before window creation, uses `app.dock.show/hide` on macOS, and `BrowserWindow.setSkipTaskbar` on Windows. The tray/menu-bar icon remains available in either mode.
- **Packaging**: `electron-builder.yml` ships `resources/` via extraResources, unpacks dependency `.node` files, and ad-hoc signs macOS (`identity: '-'`, `hardenedRuntime: false`) so Accessibility is attributed to KeeBind (see DECISIONS.md #8). Windows produces an unsigned x64 NSIS installer from the same versioned source.
