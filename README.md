# KeeBind

A minimal, cross-platform (macOS + Windows) keybinder and key listener for keyboards and macropads.

KeeBind lives in the macOS menu bar / Windows notification area and does three things:

1. **Key Listener**: press any key on any connected keyboard or macropad (wired, wireless, or Bluetooth) and see exactly what the OS receives.
2. **Bindings**: bind any hotkey (including the OS-free F13 to F24 range) to an action: launch an app, open a URL, open a file/folder, run a shell command, or run a **workflow** of several steps in order with optional delays.
3. **Conflict warnings**: when you pick a hotkey, KeeBind checks it against a per-OS database of system shortcuts (Spotlight, Mission Control, Win+L, PrtScn, F13 to F24 quirks, and so on) and warns you before you shadow something.

## Install / Run

```bash
npm install
npm run dev          # run in development
```

Packaged builds:

```bash
npm run build:mac    # dmg + zip (ad-hoc signed, not notarized)
npm run build:win    # NSIS installer (cross-buildable from macOS)
```

## macOS notes

- The **Key Listener** requires Accessibility + Input Monitoring. Use **Request permission** in Settings; macOS only lists an app in a privacy pane once the app has asked, so opening the pane first does nothing.
- After updating KeeBind, permissions have to be granted again, and System Settings will still show the old entry as enabled. That is macOS tying the grant to the exact copy of the app it was given to. Settings detects this and offers **Clear old records**.
- Packaged builds are ad-hoc signed, so Gatekeeper warns on first open (right-click → Open). Because an ad-hoc signature changes with every build, permission grants have to be re-given after an update until there is a Developer ID certificate.
- Under `npm run dev` macOS attributes permissions to the Electron bundle (or the terminal that launched it), not to KeeBind. The permissions panel says which name to look for.
- KeeBind shows a Dock icon by default; turn off **Show in Dock** in Settings for menu-bar-only.

## Documentation

All project documentation lives in [docs/](docs/):

- [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md): what works today, what's stubbed, what's planned
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): module map, IPC contract, data flow
- [docs/HANDOFF.md](docs/HANDOFF.md): how to pick up development (humans and LLMs)
- [docs/DECISIONS.md](docs/DECISIONS.md): why things are the way they are

**These files are kept current as the code changes.** See [CLAUDE.md](CLAUDE.md) for the rule.
