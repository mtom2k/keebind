# Keebind

A minimal, cross-platform (macOS + Windows) keybinder and remapper for keyboards and macropads.

Keebind lives in the macOS menu bar / Windows notification area and does four things:

1. **Key Listener** — press any key on any connected keyboard or macropad (wired, wireless, or Bluetooth) and see exactly what the OS receives.
2. **Bindings** — bind any hotkey (including the OS-free F13–F24 range) to an action: launch an app, open a URL, open a file/folder, run a shell command, or run a **workflow** of several steps in order with optional delays.
3. **Conflict warnings** — when you pick a hotkey, Keebind checks it against a per-OS database of system shortcuts (Spotlight, Mission Control, Win+L, PrtScn, F13–F24 quirks, …) and warns you before you shadow something.
4. **VIA remapping** — for VIA-compatible keyboards and macropads, remap keys *in the keyboard's own memory* over raw HID. Changes persist across computers and need no OS hooks.

## Install / Run

```bash
npm install
npm run dev          # run in development
```

Packaged builds:

```bash
npm run build:mac    # dmg + zip (unsigned by default)
npm run build:win    # NSIS installer (cross-buildable from macOS)
```

Optional: bundle the official VIA keyboard definition catalog (needs network):

```bash
npm run via:definitions
```

Without it, VIA boards can still be configured by importing their definition JSON in the app.

## macOS notes

- The **Key Listener** requires Accessibility + Input Monitoring permissions (the app guides you there). Bindings and VIA remapping work without them.
- Unsigned dev builds: right-click → Open the first time, and "Launch at login" only works in packaged builds.

## Documentation

All project documentation lives in [docs/](docs/):

- [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) — what works today, what's stubbed, what's planned
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module map, IPC contract, data flow
- [docs/HANDOFF.md](docs/HANDOFF.md) — how to pick up development (humans and LLMs)
- [docs/DECISIONS.md](docs/DECISIONS.md) — why things are the way they are

**These files are kept current as the code changes** — see [CLAUDE.md](CLAUDE.md) for the rule.
