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

## 17. Query Input Monitoring through Core Graphics in-process (2026-07-26)

**Context:** Input Monitoring stayed at "not checked yet" because the request path always assigned `unknown` after poking uiohook. Electron exposes Accessibility status but no Input Monitoring equivalent, and using event-tap creation as both a request and a status check would re-request permission during polling. The settings view also fetched permissions only once, so grants made in System Settings were invisible until remount/restart.

**Decision:** Add a minimal macOS-only N-API bridge exposing Apple's `CGPreflightListenEventAccess` and `CGRequestListenEventAccess`. It loads inside KeeBind's Electron main process so TCC evaluates KeeBind itself. Build it as a universal x86_64/arm64 resource before dev and Mac packaging. Poll passive permission state once per second while Settings is mounted and immediately on focus. Track the last-granted cdhash separately for Accessibility and Input Monitoring, and render the stale-record warning as a panel above both permission controls.

**Consequences:** Input Monitoring now has a real `granted`/`denied` status, the request button invokes the API intended to present macOS consent, and either badge updates without restarting KeeBind. The bridge is 30 lines of C and adds Apple's Command Line Tools as a macOS development/build prerequisite; Windows cross-building is unchanged because the bridge is neither loaded nor compiled there.

## 18. Refuse a modifier-only listener and fail closed on missing probes (2026-07-26)

**Context:** A follow-up report still showed "not checked yet" and a listener that saw Command/Shift but not letters. Inspection found `/Applications/KeeBind.app` and both mounted DMGs were v0.2.0, which predates the Core Graphics bridge. Separately, two real product weaknesses made the symptom confusing: a missing bridge fell back to `unknown`, the renderer treated any Input Monitoring state except `denied` as healthy, and uiohook could start while macOS delivered only modifier flag changes.

**Decision:** A missing bridge now falls back to `denied`, never `unknown`. Extract bridge loading into `macos-permissions.ts` so both the permission service and listener share the same passive check. Before starting uiohook on macOS, require both Accessibility and Input Monitoring; otherwise return `blockedReason: permissions`. The Key Listener also polls grants, requires exact `granted` states, disables Start while blocked, and explains why modifiers may appear without letters.

**Consequences:** KeeBind cannot present a partially working listener as healthy, and "not checked yet" is no longer possible in a normally built macOS app. Upgrades still require replacing and relaunching the installed copy, so the README and handoff now call out the single-instance/menu-bar trap explicitly.

## 19. Accessibility is the sole macOS listener permission (2026-07-26)

**Context:** Repeated attempts to make Input Monitoring requestable exposed a wrong premise. Apple's current DTS guidance says Accessibility grants both event posting and listening, while Input Monitoring grants listening only, and an app normally should not need both. The bundled libuiohook source creates `kCGEventTapOptionDefault`, an active filter, and refuses to start unless `AXIsProcessTrusted` succeeds. It does not use a passive `kCGEventTapOptionListenOnly`. Therefore Accessibility already grants everything this exact hook needs; the Input Monitoring request was redundant, could legitimately produce no separate prompt after Accessibility, and incorrectly blocked the listener.

**Decision:** Make Accessibility the only macOS permission. Remove the Input Monitoring row, IPC branch, Core Graphics bridge, build script, status field, stale-identity tracking and `ListenEvent` reset. Gate listener startup only on Electron's Accessibility check. Continue polling that check in Settings and the Key Listener so a grant is reflected without restarting. If Electron's Accessibility prompt call still returns false, open the Accessibility pane automatically, because macOS may suppress repeat consent alerts.

**Consequences:** There is no permission ordering question and no nonfunctional Input Monitoring button. The app returns to one third-party native dependency with no local native build step. If KeeBind later replaces uiohook with a truly passive `kCGEventTapOptionListenOnly`, the correct least-privilege design would instead request Input Monitoring alone and remove Accessibility; that would be a separate native-hook change.

## 20. Bound the main window instead of fixing its size (2026-07-26)

**Context:** Shrinking the main window below the width required by the sidebar and two-column binding editor caused horizontal scrolling, while unrestricted growth made the compact utility interface scale well beyond its intended layout.

**Decision:** Keep the main window resizable, but constrain its native bounds to 940×600 minimum and 1200×800 maximum. Disable maximize and full-screen so operating-system controls cannot bypass the maximum. The main document owns no scrollbars; `.content` is vertical-scroll-only so long pages remain usable without horizontal drift.

**Consequences:** Users can still move and resize KeeBind within a useful range, every supported size preserves the intended layout, and only content that is genuinely taller than the viewport scrolls. Any future wider editor must either wrap responsively or justify increasing the centralized bounds.

## 21. Reserve one scrollbar gutter across functional tabs (2026-07-26)

**Context:** Bindings, Key Listener and Settings used the same available width under normal content, but Settings can become taller when permission warnings or recovery instructions appear. On systems with non-overlay scrollbars, its newly visible vertical scrollbar reduced only that tab's usable width, making its panels look shorter.

**Decision:** Give all three functional views the shared `.main-view` full-width contract and set `scrollbar-gutter: stable` on their common `.content` scroller.

**Consequences:** Panel edges no longer shift when switching tabs or expanding Settings content. A narrow empty gutter remains reserved when a tab does not need vertical scrolling, trading a small amount of space for consistent alignment.

## 22. Size the application shell to the viewport (2026-07-26)

**Context:** The first tab-alignment fix correctly made each view 100% wide, but the parent `.app` itself was an auto-sized flex child because `#root` and `.app` shared `display: flex` while `.app` had no explicit width. Long Listener content gave the shell a full-window intrinsic width. Once the stale-record guidance disappeared, shorter Settings content let the entire shell collapse from 1200px to about 959px, so its 100%-wide panels were still visibly shorter.

**Decision:** Make `#root` only establish viewport height and give `.app` explicit `width: 100%`, `height: 100%`, and `min-width: 0` before it lays out the sidebar and content pane.

**Consequences:** View contents can no longer change the width of the application shell. In the reproduced packaged-app sequence, Settings remains 958px wide before, during, and after the permission guidance transition, matching Bindings and Key Listener exactly.

## 23. Suppress native focus outlines globally (2026-07-26)

**Context:** Electron inherits Chromium's macOS focus ring, colored by the user's system accent. It intermittently appeared as a thick yellow/orange and white halo around navigation buttons and form controls after mouse or keyboard focus, clashing with KeeBind's existing active and hover states.

**Decision:** Disable outlines for both `:focus` and `:focus-visible` across all renderer elements and remove the separate accent outline previously applied to text fields and selects.

**Consequences:** Mouse clicks and keyboard focus no longer draw an additional system-colored halo anywhere in the main window, popover, or About window. Controls remain focusable and keyboard-operable, but focus position is no longer represented by a dedicated visual ring.

## 24. Gate every binding run in the main process (2026-07-26)

**Context:** A per-binding confirmation option must cover global shortcuts while every renderer window may be hidden, as well as Run and double-click actions from two renderer windows. A renderer-only modal would either miss global hotkeys or require showing and coordinating a window before every guarded action.

**Decision:** Add optional `Binding.confirmBeforeRun` and route every saved-binding launch through `bindings/execution.ts`. Checked bindings open a native Electron dialog that shows the hotkey, description, and complete action/workflow. Deny is the default and cancel action. Prompts for different bindings serialize, while concurrent triggers of the same binding share one in-flight Promise and exact binding snapshot.

**Consequences:** No launch path can bypass confirmation, denial is a normal non-error result, and key repeat cannot stack prompts or execute twice. The native dialog works even when KeeBind's windows are hidden. Existing bindings omit the optional field and continue running without a prompt.

## 25. Share search semantics with the pinned popover (2026-07-26)

**Context:** The main Bindings tab already had useful dynamic search, but a long pinned list in the menu-bar/tray popover required scanning or scrolling. Duplicating the matcher would let the two searches drift, and filtering changes the frameless window's height.

**Decision:** Extract one renderer `bindingMatchesQuery()` helper and use it in both views. The pinned popover auto-focuses a compact search field, supports case-insensitive all-term matching, result counts, no-match recovery, Clear and Escape. Every resize repositions the popover against its cached Tray.

**Consequences:** Description, accelerator, action, arguments, workflow steps and targets search identically in both places. The panel grows and shrinks with results while remaining anchored below a top menu bar or above a bottom Windows taskbar.

## 26. Own prompts and invalidate stale approvals (2026-07-26)

**Context:** A standalone native confirmation can open behind the previously active application when KeeBind is tray-only, while parenting it to the frameless pinned popover normally triggers that window's hide-on-blur behavior. A serialized prompt can also remain open long enough for its binding to be edited, disabled, or deleted before the user accepts it. Finally, the existing Description field could not accurately satisfy a confirmation that identifies both a binding name and its descriptive details.

**Decision:** Add an optional, backward-compatible `Binding.name`; use the old description as the display-name fallback. Parent manual prompts to their invoking BrowserWindow and suppress popover blur dismissal for the dialog lifetime. For global shortcuts, temporarily show/focus the hidden main window as the owner and restore its prior visibility afterward. Before running an accepted snapshot, compare its execution-relevant revision with the current stored binding.

**Consequences:** The prompt reliably appears in front, lists the hotkey, distinct name, description and full action, and cannot authorize a binding that changed while approval was pending. Old records remain valid without migration.

## 27. Separate existing-binding edits from creation (2026-07-26)

**Context:** Reusing the inline creation panel for Edit placed an existing binding's form after the entire binding list. On a populated Bindings tab it looked like another card had appeared at an unrelated location, and the user could continue tabbing through obscured page controls.

**Decision:** Keep the new-binding editor inline, but render existing-binding edits as a centered modal over the current view. Autofocus Name, trap Tab within the modal, make Escape and the explicit Discard edits button abandon the draft, and keep Save as the only persistence path. Constrain the modal to the viewport and scroll long workflows inside it.

**Consequences:** Edit now preserves context and clearly isolates unsaved changes without changing the creation workflow. Large workflow forms remain usable at the 940×600 minimum window size and cannot introduce page-level horizontal scrolling.

## 28. Let the macOS Accessibility prompt own settings navigation (2026-07-26)

**Context:** `isTrustedAccessibilityClient(true)` presents a native macOS confirmation with its own Open System Settings choice. KeeBind also deep-linked to the Accessibility pane immediately when that synchronous call returned false, so the pane opened behind or alongside the still-pending confirmation instead of waiting for the user's choice.

**Decision:** The primary Request permission action invokes only the native prompt. Do not call `openPermissionSettings()` from that request path; retain the separate manual Open Accessibility recovery action.

**Consequences:** System Settings opens only when the user selects the native dialog's Open System Settings button. A previously dismissed prompt may remain suppressed by macOS, in which case the explicit manual recovery link is the fallback rather than an automatic navigation.

## 29. Persist one binding order for the main list and pinned menu (2026-07-26)

**Context:** Bindings previously appeared only in creation order. Adding an independent order field or sorting only the renderer would require migrations and could let the Bindings tab and pinned menu disagree.

**Decision:** Treat the existing persisted `bindings` array order as canonical. Reorder it through a validated `bindings:reorder` IPC operation; do not modify binding contents or re-register shortcuts. The pinned popover filters this array in place. Provide an eight-dot HTML drag handle plus Up/Down keyboard movement, with visible before/after insertion markers.

**Consequences:** One reorder is immediately reflected in both surfaces and survives restart with no schema migration. New bindings append to the end, edits preserve position, deletion removes one slot, and omitted or unknown reorder IDs cannot discard stored bindings.

## 30. Qualify releases by tested platform until Windows validation (2026-07-26)

**Context:** KeeBind builds for macOS and Windows, but the current feature set has only been exercised on macOS. Publishing an ordinary stable version would imply that both advertised platforms were validated.

**Decision:** Publish the current build as the SemVer pre-release `v0.2.9-macos.1`, attach only its macOS artifacts, and mark the GitHub Release as a pre-release. Reserve the unsuffixed `v0.2.9` tag for a cross-platform release after Windows testing.

**Consequences:** macOS users get an immutable, identifiable build without overstating Windows readiness. Additional macOS candidates can increment the suffix, while the eventual cross-platform release retains a conventional clean version.
