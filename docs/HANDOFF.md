# KeeBind: Developer / LLM Handoff

Read this first. Then `ARCHITECTURE.md` for structure and `PROJECT_STATE.md` for what's done vs. open.

## Setup

```bash
npm install
npm run dev            # launch the app (menu bar / tray icon appears)
npm run typecheck      # both TS projects (main+preload, renderer)
```

Prereqs: Node ≥ 20 (developed on 24), npm. If Electron's binary is missing after install (`Error: Electron uninstall`), run `node node_modules/electron/install.js`.

`uiohook-napi` uses its bundled prebuilds and `electron-builder.yml` keeps `npmRebuild: false`; do not run a blanket Electron native rebuild.

## Everyday workflows

- **UI work without Electron**: `npm run dev`, then open http://localhost:5173 in a normal browser. `devMock.ts` auto-installs a fake `window.keebind` with in-memory bindings and browser key events. This is how most UI iteration happens, with no hardware and no permissions.
- **Adding an action type**: add the variant to `StepType` in `src/shared/types.ts`, implement it in `src/main/bindings/actions.ts` (`runStep`), add it to `STEP_TYPES` in `src/renderer/src/components/ActionEditor.tsx`. Everything else (workflow editor, summaries) picks it up.
- **Running a saved binding**: always call `executeBinding()` in `src/main/bindings/execution.ts`, never `runAction()` directly. That is the single confirmation, window-ownership, stale-record validation, duplicate-suppression and error-notification boundary used by global shortcuts and manual Run buttons.
- **Adding an IPC channel**: handler in `src/main/ipc.ts` → method on `KeeBindApi` in `src/preload/index.ts` → use via `window.keebind.*`. Keep `src/shared/types.ts` as the single home for payload types. Add it to `devMock.ts` too or the browser harness breaks.
- **Working on the tray popover or About window**: both load the same renderer bundle at `#popover` and `#about` (see `src/renderer/src/main.tsx`). In a browser you can reach them by editing the hash and reloading, which is how they get styled and checked without Electron. The popover sizes its own window by reporting `offsetHeight` over `popover:resize`, so wrap its content in the element the `useLayoutEffect` measures.
- **Pinning**: `Binding.pinned` drives the popover list. Anything that mutates bindings in `ipc.ts` must call `refreshPopover()`, or the menu bar shows a stale list.
- **Editing conflict data**: `src/main/data/conflicts/darwin.json` / `win32.json`. `combos` match full accelerators; `keyNotes` match bare keys only. Severities: `warning` (OS owns it / reserved) vs `info` (caveat worth knowing).
- **Regenerating icons**: edit `scripts/generate-icons.mjs`, run `npm run icons`. All icons are code-generated PNGs; don't add binary assets. Shapes are inside-tests in unit space (0..1) composited with 4×4 supersampling, so the same geometry renders cleanly at every size. If you change the mark, update `src/renderer/src/components/Logo.tsx` to match, since it hand-mirrors the "full" lockup as SVG.
- **Changing the chord rules**: `src/renderer/src/chord.ts` is self-contained (`reduceChord` + `chordToAccelerator`) and is the only place the keydown/keyup stream is interpreted.

## Packaging: building a DMG or an EXE

Both installers build from a single macOS machine. Node ≥ 20 and `npm install` are the only prerequisites; Windows needs no Visual Studio toolchain because its native code comes from `uiohook-napi`'s bundled prebuild.

```bash
npm run build:mac
```

Produces, in `dist/`:

- `KeeBind-<version>-arm64.dmg`: the drag-to-Applications installer
- `KeeBind-<version>-arm64-mac.zip`: same app, for auto-update channels later
- `dist/mac-arm64/KeeBind.app`: the unpacked bundle, handy for `codesign`/`plutil` checks

```bash
npm run build:win
```

Produces `dist/KeeBind Setup <version>.exe`, a one-click NSIS installer, x64, cross-built from macOS. `dist/win-unpacked/` holds the unpacked tree.

Both scripts run `electron-vite build` first, so they always package the current source. To build everything at once: `npx electron-builder --mac --win` after a single `npm run build`.

**Verifying a mac build** (this is what catches the privacy-pane regression):

```bash
codesign -dv dist/mac-arm64/KeeBind.app
```

Expect `Identifier=com.keebind.app`, `Info.plist entries=…` and `Sealed Resources version=2`. If it says `Identifier=Electron` with `Info.plist=not bound`, signing was skipped and macOS will attribute Accessibility to whatever launched the app instead of to KeeBind (DECISIONS.md #8).

**Things that will bite you:**

- Windows cross-builds only work because `npmRebuild: false` skips @electron/rebuild (node-gyp can't cross-compile) and the bundled uiohook prebuilds cover win32-x64. Keep that flag if you add targets.
- The mac build is **ad-hoc signed**, not notarized. Gatekeeper will warn on first open (right-click → Open, or `xattr -dr com.apple.quarantine`), and because an ad-hoc signature is content-based, macOS permission grants reset on every new build. A Developer ID certificate + notarization fixes both; set `mac.identity` to the certificate name and add notarize options.
- `hardenedRuntime: false` is required alongside ad-hoc signing, because hardened runtime enforces library validation and would reject the pre-signed Electron framework.
- Changing `productName` changes the `userData` directory. The Keebind → KeeBind rename was case-only, and macOS/Windows filesystems are case-insensitive by default, so existing configs carry over. A non-case rename would strand them.
- Bumping the version: `package.json` `version` only. electron-builder reads it for all artifact names.
- To sanity-check the renderer without Electron, `npm run dev` and open http://localhost:5173 in a browser (the dev mock takes over). A stale Electron instance holding the single-instance lock will make `npm run dev` exit immediately with code 0. Check `ps aux | grep Electron` if that happens.

## Gotchas (learned the hard way)

- **A native Tray menu can't hold two buttons per row.** That is why the pinned-bindings panel is a real window (DECISIONS.md #11). If you add rows to it, remember macOS gets no `setContextMenu` call, because attaching a menu hijacks left-click.
- **Popover filtering changes its height.** `resizePopover()` repositions against the cached Tray after every height report; keep that step or a bottom Windows taskbar will be covered when a filtered list grows upward.
- **Popover confirmations temporarily suppress hide-on-blur.** A native child dialog takes focus away from the frameless popover. Keep `setPopoverDialogActive()` around the dialog lifetime or the parent disappears as the prompt opens. Global-hotkey prompts temporarily reveal the hidden main window and restore its prior visibility afterward.
- **Persisted binding additions must be optional or migrated.** `name` and `confirmBeforeRun` are optional because earlier `config.json` records do not contain them; `bindingDisplayName()` and `?? false` provide the legacy behavior.
- **Flex children default to `min-width: auto`.** A wide row (the workflow step editor) will push its container instead of wrapping, which silently scrolls the whole content pane sideways and hides the Save button. `.content` and `.step-fields` set `min-width: 0` for this reason.
- **Keep main-window limits centralized.** `MAIN_WINDOW_BOUNDS` in `src/main/window.ts` defines the default, minimum and maximum size. The 940px minimum leaves enough space for the sidebar, content padding and two-column binding editor; re-check every view for horizontal overflow before reducing it.
- **Keep the functional tabs width-stable.** Bindings, Key Listener and Settings use `.main-view`, while `.content` reserves a `scrollbar-gutter`. Without that gutter, opening taller permission help in Settings can make only that tab narrower when its vertical scrollbar appears.
- **The app shell must fill `#root`.** `#root` used to be a flex container while `.app` had no width, so `.app` became an intrinsically sized flex child: long Listener text stretched it across the viewport, but shorter Settings content let it collapse after the stale-record banner disappeared. Keep `.app { width: 100%; height: 100%; }`; view-level `width: 100%` cannot repair a shrunken shell.
- **Native focus rings are intentionally suppressed.** macOS uses the system accent color for Electron's default focus outline, which produced a thick yellow/orange halo around clicked or keyboard-focused controls. The global `*:focus` / `*:focus-visible` rule removes it, and the old text-field outline was removed as well. Focus behavior remains functional, only its ring is hidden.
- **Controls whose label changes need a fixed width**, or the row reflows mid-interaction. See `.capture-btn`.

- **Version pins matter**: `electron-vite@5` needs `vite@7`, which needs `@vitejs/plugin-react@5` (v6 requires Vite 8). Don't blindly bump these three independently.
- **TypeScript 7 (tsgo)** is stricter: JSON imports must be listed in tsconfig `include` explicitly (`src/main/**/*.json`), and side-effect CSS imports need `/// <reference types="vite/client" />` (see `src/renderer/src/env.d.ts`).
- **`app.setLoginItemSettings` throws/errors on unsigned dev builds** on macOS, so only call it on real changes, wrapped in try/catch (see `applySettings` in `src/main/ipc.ts`).
- **uiohook must be stopped on quit** (`will-quit` → `shutdownListener()`), or its thread keeps the process alive.
- **A grant is tied to the exact binary.** `codesign -d -r- KeeBind.app` shows a designated requirement of `cdhash` alone, so every rebuild invalidates every permission while System Settings keeps showing the old row ticked. If you are testing permissions, expect to press "Clear old records" (or `tccutil reset Accessibility com.keebind.app`) after each build. A Developer ID certificate is what ends this.
- **macOS permissions are a signature problem, not a UI problem.** TCC identifies a client by its code signature. See `src/main/permissions.ts` and DECISIONS.md #8/#19 for the full story; packaged builds must be signed (ad-hoc is enough) or macOS blames the launching process. Under `npm run dev` the running bundle is genuinely `node_modules/.../Electron.app`, so Accessibility lands on "Electron" (or your terminal) and the panel says so.
- **Accessibility is the only listener permission.** uiohook uses an active `kCGEventTapOptionDefault` and hard-checks `AXIsProcessTrusted`. Apple says Accessibility includes listening and posting, whereas Input Monitoring only includes listening. Do not reintroduce an Input Monitoring gate unless the macOS hook is first replaced with a passive `kCGEventTapOptionListenOnly`.
- **Quit the resident app before testing an upgrade.** KeeBind holds a single-instance lock and stays in the menu bar after its window closes. Launching a DMG copy while an older `/Applications/KeeBind.app` process is alive can reactivate the old version. Check the Settings footer or `CFBundleShortVersionString` before diagnosing the new build.
- **Windows is unverified**: everything Windows-specific (tray click behavior, taskbar icon, `cmd /c start` launching, conflict DB, NSIS) compiles and cross-builds but has not run on real Windows yet. That's a top open item in PROJECT_STATE.md.

## Docs discipline

Per CLAUDE.md: code changes update PROJECT_STATE.md; structural changes update ARCHITECTURE.md; tradeoffs go to DECISIONS.md; workflow changes land here. Keep the "Last updated" date in PROJECT_STATE.md fresh.
