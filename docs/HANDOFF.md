# Keebind — Developer / LLM Handoff

Read this first. Then `ARCHITECTURE.md` for structure and `PROJECT_STATE.md` for what's done vs. open.

## Setup

```bash
npm install            # also rebuilds native modules via electron-builder
npm run dev            # launch the app (menu bar / tray icon appears)
npm run typecheck      # both TS projects (main+preload, renderer)
```

Prereqs: Node ≥ 20 (developed on 24), npm. If Electron's binary is missing after install (`Error: Electron uninstall`), run `node node_modules/electron/install.js`.

If native modules fail to load after an Electron version bump: `npx electron-builder install-app-deps`.

## Everyday workflows

- **UI work without Electron**: `npm run dev`, then open http://localhost:5173 in a normal browser. `devMock.ts` auto-installs a fake `window.keebind` (in-memory bindings, a fake 3×3 VIA macropad, key events from the browser). This is how most UI iteration happens — no hardware, no permissions.
- **Adding an action type**: add the variant to `StepType` in `src/shared/types.ts`, implement it in `src/main/bindings/actions.ts` (`runStep`), add it to `STEP_TYPES` in `src/renderer/src/components/ActionEditor.tsx`. Everything else (workflow editor, summaries) picks it up.
- **Adding an IPC channel**: handler in `src/main/ipc.ts` → method on `KeebindApi` in `src/preload/index.ts` → use via `window.keebind.*`. Keep `src/shared/types.ts` as the single home for payload types.
- **Editing conflict data**: `src/main/data/conflicts/darwin.json` / `win32.json`. `combos` match full accelerators; `keyNotes` match bare keys only. Severities: `warning` (OS owns it / reserved) vs `info` (caveat worth knowing).
- **Regenerating icons**: edit `scripts/generate-icons.mjs`, run `npm run icons`. All icons are code-generated PNGs; don't add binary assets.
- **VIA definition catalog**: `npm run via:definitions` downloads github.com/the-via/keyboards and packs `resources/via-definitions.json` (gitignored, several MB). The app works without it (users import definitions in the UI).

## Packaging

```bash
npm run build:mac   # dist/ dmg + zip, unsigned (identity: null)
npm run build:win   # dist/ NSIS installer — cross-builds on macOS
```

Signing later: set a real identity in `electron-builder.yml` (mac) and add notarization; for win add a cert. `LSUIElement` is set for packaged macOS builds (menu-bar-only, no Dock).

## Gotchas (learned the hard way)

- **Version pins matter**: `electron-vite@5` needs `vite@7`, which needs `@vitejs/plugin-react@5` (v6 requires Vite 8). Don't blindly bump these three independently.
- **TypeScript 7 (tsgo)** is stricter: JSON imports must be listed in tsconfig `include` explicitly (`src/main/**/*.json`), and side-effect CSS imports need `/// <reference types="vite/client" />` (see `src/renderer/src/env.d.ts`).
- **`app.setLoginItemSettings` throws/errors on unsigned dev builds** on macOS — only call it on real changes, wrapped in try/catch (see `applySettings` in `src/main/ipc.ts`).
- **uiohook must be stopped on quit** (`will-quit` → `shutdownListener()`), or its thread keeps the process alive.
- **node-hid writes need a leading `0x00` report-id byte** on every platform; VIA responses echo the command id in byte 0 — `ViaClient.request` loops reads until it sees the echo.
- **macOS permissions**: the Key Listener needs Accessibility *and* Input Monitoring. In dev these are granted to your terminal/Electron, not "Keebind". `systemPreferences.isTrustedAccessibilityClient` only covers Accessibility; Input Monitoring can't be queried — the UI treats "listener runs but no events arrive" as the hint.
- **Windows is unverified**: everything Windows-specific (tray click behavior, `cmd /c start` launching, conflict DB, NSIS) compiles and cross-builds but has not run on real Windows yet. That's the top open item in PROJECT_STATE.md.

## Docs discipline

Per CLAUDE.md: code changes update PROJECT_STATE.md; structural changes update ARCHITECTURE.md; tradeoffs go to DECISIONS.md; workflow changes land here. Keep the "Last updated" date in PROJECT_STATE.md fresh.
