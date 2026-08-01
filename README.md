# KeeBind

A minimal, cross-platform (macOS + Windows) keybinder and key listener for keyboards and macropads.

KeeBind lives in the macOS menu bar / Windows notification area and does three things:

1. **Key Listener**: press any key on any connected keyboard or macropad (wired, wireless, or Bluetooth) and see exactly what the OS receives.
2. **Bindings**: give a hotkey a name and description, then launch an app, open a URL, open a file/folder, run a shell command, or run a **workflow** of several steps in order with optional delays. Individual bindings can require confirmation before every run; KeeBind's fail-closed confirmation window discloses the hotkey, name, description, and complete action without revealing the hidden main window.
3. **Conflict warnings**: when you pick a hotkey, KeeBind checks it against a per-OS database of system shortcuts (Spotlight, Mission Control, Win+L, PrtScn, F13 to F24 quirks, and so on) and warns you before you shadow something.

Bindings can be reordered with a drag handle. Pinned menu-bar/tray bindings inherit that order and have the same dynamic name, hotkey, description, action, and target search as the main Bindings tab.

## Install / Run

```bash
npm install
npm run dev          # run in development
```

Packaged builds:

```bash
npm run build:mac    # dmg + zip (ad-hoc signed, not notarized)
npm run build:win    # x64 NSIS installer (native on Windows or cross-buildable from macOS)
```

KeeBind uses one application version for both operating systems. A release tag
such as `v0.2.9` identifies one source commit; that release carries separate
macOS and Windows artifacts rather than maintaining platform-specific branches
or version numbers.

## macOS notes

- The **Key Listener requires Accessibility only**. KeeBind's active event tap is covered by Accessibility, which already includes listening access; Input Monitoring is not required. Use **Request permission** in Settings.
- The permission badge refreshes while Settings is open, including after you grant access in System Settings; no app restart is needed.
- When upgrading, quit the existing menu-bar copy before replacing `/Applications/KeeBind.app`. KeeBind is single-instance, so an older resident process otherwise remains the app you see. The Settings footer shows the running version.
- After updating KeeBind, permissions have to be granted again, and System Settings will still show the old entry as enabled. That is macOS tying the grant to the exact copy of the app it was given to. Settings detects this and offers **Clear old records**.
- Packaged builds are ad-hoc signed, so Gatekeeper warns on first open (right-click → Open). Because an ad-hoc signature changes with every build, permission grants have to be re-given after an update until there is a Developer ID certificate.
- Under `npm run dev` macOS attributes permissions to the Electron bundle (or the terminal that launched it), not to KeeBind. The permissions panel says which name to look for.
- KeeBind shows a Dock icon by default; turn off **Show in Dock** in Settings for menu-bar-only.

## Windows notes

- The **Key Listener does not require a Windows privacy permission**. Start it directly from the Key Listener tab.
- KeeBind shows a taskbar icon by default; turn off **Show in taskbar** for notification-area-only use.
- The Windows build is x64 and uses a one-click NSIS installer. It is not code-signed yet, so Microsoft Defender SmartScreen may warn on first launch.

## Documentation

All project documentation lives in [docs/](docs/):

- [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md): what works today, what's stubbed, what's planned
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): module map, IPC contract, data flow
- [docs/HANDOFF.md](docs/HANDOFF.md): how to pick up development (humans and LLMs)
- [docs/DECISIONS.md](docs/DECISIONS.md): why things are the way they are

**These files are kept current as the code changes.** See [CLAUDE.md](CLAUDE.md) for the rule.
