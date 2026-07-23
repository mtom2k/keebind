# Keebind — repo conventions

Electron + TypeScript + React keybinder/remapper. macOS menu bar / Windows tray app.

## Documentation discipline (CRITICAL)

This repo is designed for clean handoff between developers and LLMs. **When you change code, update the docs in the same change:**

- Any feature/behavior change → update `docs/PROJECT_STATE.md`
- Any structural change (new module, new IPC channel, dependency change) → update `docs/ARCHITECTURE.md`
- Any tradeoff/decision → append to `docs/DECISIONS.md`
- Setup/workflow changes → update `docs/HANDOFF.md`

Read `docs/HANDOFF.md` first when starting work here.

## Commands

- `npm run dev` — run the app in development
- `npm run typecheck` — TS check for both main and renderer projects
- `npm run build:mac` / `npm run build:win` — package installers
- `npm run icons` — regenerate all icons from code (`scripts/generate-icons.mjs`)
- `npm run via:definitions` — bundle the official VIA definition catalog (network)

## Conventions

- Shared types live in `src/shared/types.ts`; the IPC surface is defined once in `src/main/ipc.ts` and mirrored in `src/preload/index.ts` (`KeebindApi`). Keep the three in sync.
- Every user-facing control gets a tooltip (`Tooltip` component or `title`).
- The renderer must keep working in a plain browser via the dev mock (`src/renderer/src/devMock.ts`) — it's how UI is developed and tested without hardware.
- No native code beyond the two prebuilt deps (`uiohook-napi`, `node-hid`). OS-level key interception is deliberately out of scope for v1 (see DECISIONS.md).
