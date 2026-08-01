<div align="center">

<img src="resources/icons/app-icon.png" width="88" alt="KeeBind" />

# KeeBind

**A minimal keybinder and key listener for keyboards and macropads.**

It sits in the macOS menu bar or the Windows notification area, and your hotkeys keep working after you close the window.

<<<<<<< HEAD
1. **Key Listener**: press any key on any connected keyboard or macropad (wired, wireless, or Bluetooth) and see exactly what the OS receives.
2. **Bindings**: give a hotkey a name and description, then launch an app, open a URL, open a file/folder, run a shell command, or run a **workflow** of several steps in order with optional delays. Individual bindings can require confirmation before every run; KeeBind's fail-closed confirmation window discloses the hotkey, name, description, and complete action without revealing the hidden main window.
3. **Conflict warnings**: when you pick a hotkey, KeeBind checks it against a per-OS database of system shortcuts (Spotlight, Mission Control, Win+L, PrtScn, F13 to F24 quirks, and so on) and warns you before you shadow something.
=======
![version](https://img.shields.io/badge/version-0.2.9-4f6bed)
![platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows-6d6d78)
![built with](https://img.shields.io/badge/built%20with-Electron%20%2B%20React-6c46e4)
>>>>>>> b195ab44a452fbc8a5d985a11ec4cbe434e3f070

</div>

![The Bindings tab](docs/screenshots/bindings.png)

## What it does

- **Binds a key to something useful.** Launch an app, open a URL or a folder, run a shell command, or chain several of those into a workflow with delays between the steps.
- **Shows what your keyboard actually sends.** Whole combinations, from any board you have connected, wired or wireless, macropads included.
- **Warns you about conflicts.** Every hotkey is checked against the shortcuts your OS already owns (Spotlight, Win+L, PrtScn, the F13 to F24 quirks), so you find out before you shadow one.
- **Keeps the ones you use most within reach.** Pin a binding and it shows up under the menu bar icon with its own Run button.
- **Asks first, if you want it to.** Turn on confirmation for a binding and nothing happens until you approve the exact action it lists.

## Install

Grab the latest installer from [Releases](https://github.com/mtom2k/keebind/releases):

| Platform | File |
| --- | --- |
| macOS (Apple silicon) | `KeeBind-<version>-arm64.dmg` |
| Windows (x64) | `KeeBind Setup <version>.exe` |

Both are built from the same commit and share one version number. The platform notes further down cover the first-launch warnings.

## Getting started

### 1. Find a key that is free

Open the Key Listener, hit **Start listening**, then press whatever you are thinking of binding. The full combination shows up as keycaps, and recent presses stay in the list underneath.

`F13` to `F19` are usually the best pick. The OS leaves them alone, and most macropads can be configured to send them.

![The Key Listener showing a captured combination](docs/screenshots/listener.png)

### 2. Bind it

With the key still on screen, click **+ Create binding** and you land in the Bindings tab with the hotkey already filled in. Starting from scratch works too: **+ Add binding**.

1. Set the hotkey. Press **Capture** and hit the key, or type the accelerator yourself.
2. Name it, and add a description if it needs one.
3. Choose an action, or pick **Workflow (multiple steps)** to run a few things in order.
4. **Save binding**. It works system wide straight away.

![Creating a workflow binding](docs/screenshots/binding-editor.png)

| Action | What it does |
| --- | --- |
| **Launch app** | Opens an application, with optional arguments. |
| **Open URL** | Opens a link in your default browser. |
| **Open file/folder** | Opens a path with whatever app normally handles it. |
| **Shell command** | Runs a command (zsh on macOS, cmd on Windows). |
| **Workflow** | Runs any number of the above in order, with a delay before each step. |

### 3. Pin the ones you use often

Click the star on a binding and it joins the panel behind the menu bar icon. Double-click a row to run it, or use the Run and Manage buttons that appear when you hover over it.

<p align="center">
  <img src="docs/screenshots/popover.png" width="320" alt="The pinned bindings panel" />
</p>

### 4. Settings

Theme, launch at login, hiding the Dock or taskbar icon, a master switch for every binding, and the macOS permission all live here.

![Settings in dark mode](docs/screenshots/settings.png)

## 🍎 macOS notes

- The Key Listener needs Accessibility. Grant it with **Request permission** in Settings. Input Monitoring is not required, and bindings work without any permission at all.
- Builds are ad-hoc signed, so Gatekeeper complains the first time. Right-click the app and choose Open.
- After an update you have to grant Accessibility again, and System Settings will still show the old entry as ticked. That is macOS tying the grant to that exact copy of the app. Settings notices and offers **Clear old records**.
- Quit the copy already running in the menu bar before replacing it. KeeBind runs a single instance, so an older process otherwise stays the app you are looking at.

## 🪟 Windows notes

- Nothing to grant. Start the Key Listener whenever you like.
- The installer is not code signed yet, so SmartScreen may warn you on first launch.
- Turn off **Show in taskbar** if you only want the notification area icon.

## Build from source

```bash
npm install
npm run dev          # run in development
npm run build:mac    # dmg + zip (ad-hoc signed, not notarized)
npm run build:win    # x64 NSIS installer (native or cross-built from macOS)
```

Node 20 or newer. The screenshots above come out of `npm run screenshots`, which drives the real interface.

## Documentation

| Doc | Contents |
| --- | --- |
| [PROJECT_STATE.md](docs/PROJECT_STATE.md) | What works today, what is verified, what is planned |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, IPC contract, data flow |
| [HANDOFF.md](docs/HANDOFF.md) | How to pick up development (humans and LLMs) |
| [DECISIONS.md](docs/DECISIONS.md) | Why things are the way they are |

These files are kept up to date as the code changes. See [CLAUDE.md](CLAUDE.md) for the rule.
