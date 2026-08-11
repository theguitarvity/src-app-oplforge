# Quickstart: iOS OPL Network Library

Validation guide for this feature. Assumes a **physical iPhone** (iOS 16+ — the Simulator's Local Network stack is not reachable from a real PS2 on the LAN, research.md R1/Target Platform) with a folder already populated with a sample OPL-structured library (`DVD`/`CD`/`PS1`/`APPS`/`ART`/`CFG`/`VMC`), and — for hardware-dependent scenarios — a PS2 running Open PS2 Loader on the same local network as the iPhone.

## Prerequisites

- `mobile/` app built via `expo prebuild -p ios` and run through Xcode onto a physical iPhone (not the Simulator, not Expo Go — research.md R1/R3).
- A sample library folder reachable through the iOS document picker (a folder on-device, or in iCloud Drive with at least one deliberately-not-yet-downloaded file for Scenario 6) with a mix of conformant and non-conformant OPL naming, at least one item per recognized type. A ~500-item reference library for the performance scenarios.
- For Scenarios 3, 4, and the Hardware Smoke Test: a real PS2 with Open PS2 Loader installed, connected to the **same Wi-Fi network** as the iPhone.
- Project's XCTest suite (Swift domain logic — frame codec, NTLMv1, path confinement, catalog parsing) passing on the branch before manual validation (Constitution Principle V gate) — exact commands defined in `tasks.md`.

## Scenario 1 — Select a library via the document picker and confirm persisted access (US1)

1. Install and open the app fresh (no library selected).
2. **Expect**: Home shows the "no library configured" state with a single primary action, same as Android.
3. Tap to select a library — **Expect**: the native iOS document picker opens in folder-selection mode (research.md R2), not the file-selection mode.
4. Choose a folder, confirm.
5. **Expect**: the app shows the selected folder as the active library everywhere (Home, Library tab, Sharing setup) — `sourceKind` shows `'internal'` for an on-device folder or `'unknown'` for an iCloud Drive/third-party-provider folder (data-model.md).
6. Fully close the app (swipe up from app switcher) and reopen it.
7. **Expect**: the same library is still active, no reselection prompt — the security-scoped bookmark resolved successfully (research.md R2).
8. In the Files app, rename or move the selected folder, then reopen the OPL Forge app.
9. **Expect**: the app surfaces an "access lost" state (bookmark resolution failed or went stale), not a silent crash or stale display.

## Scenario 2 — Catalog, diagnose, and prepare the device (US2)

1. With a library selected, start a catalog scan.
2. **Expect**: progress is visible and continuous until completion; item counts per type appear.
3. Include at least one file with a non-conformant name or misplaced location in the test library.
4. **Expect**: it's flagged with a clear "needs attention" status, not hidden or silently corrected.
5. Remove one or more of the 7 mandatory OPL folders from the test library (e.g. delete `CFG` via the Files app) before running Diagnostics.
6. **Expect**: the diagnostic report lists exactly the missing folders and downgrades the readiness classification.
7. Tap "Preparar dispositivo".
8. **Expect**: the missing folders are created directly in the library folder (verifiable by reopening it in the Files app), and a follow-up automatic diagnostic confirms a complete structure.

## Scenario 3 — Start sharing, guided PS2 setup, real SMB browse (US1)

1. From the sharing screen, enter username/password, confirm the write-access acknowledgment, and start sharing.
2. **Expect**: the iOS system Local Network permission prompt appears (if not already granted) — confirm the in-app explanation shown _before_ that system prompt is clear about why it's needed (research.md R4).
3. **Expect**: status becomes `running-idle`, with local address/port (1445, not 445 — research.md R5)/share name displayed.
4. Open the guided tutorial; follow the displayed steps on the PS2: Configurações → Configurações de Rede → Servidor SMB → enter the exact address/port/share/username/password shown.
5. On the PS2, save and browse the network share from OPL's game list.
6. **Expect**: the PS2 lists the same DVD/CD/PS1/Apps titles visible in the app's catalog. Launch one title of each available type to confirm it boots — this validates the Swift SMB1 server against real OPL client behavior (`contracts/smb-protocol-scope.md`) and cannot be replaced by a unit test or Simulator run.
7. **If this fails at the network-menu stage before any title list appears**: check the SMB_COM_ECHO handling first (`contracts/smb-protocol-scope.md`'s "Additions since 006") — this exact failure mode was already seen and fixed on Android.
8. **If login fails specifically**: check that credentials are being validated at `TREE_CONNECT_ANDX`, not `SESSION_SETUP_ANDX` (`contracts/smb-protocol-scope.md`'s architectural correction) — this exact failure mode was already seen and fixed on Android, and is easy to reintroduce on a from-scratch Swift port if the share-level-security model isn't followed from the start.

## Scenario 4 — Status reflects real connection state (US1)

1. With sharing on and no PS2 connected, confirm Home/Sharing screen shows "running, waiting for connection".
2. Connect from the PS2 (as in Scenario 3).
3. **Expect**: within ~10s the app shows the connected state distinctly (e.g. emerald), matching Android's existing UI.
4. Power off the PS2 or disconnect it from the network.
5. **Expect**: the app eventually reflects the client as disconnected — no stale "connected" state.

## Scenario 5 — Sharing stops cleanly when the app is backgrounded (iOS-specific — NOT a background-survival test, the opposite)

This is the one scenario with no Android equivalent, and it validates the _opposite_ of Android Scenario 5 (which confirms sharing survives backgrounding) — see spec.md Assumptions and research.md R3.

1. With sharing active and a PS2 connected/browsing, press the iPhone's Home button or switch to another app.
2. **Expect**: within a few seconds, the app's sharing session transitions to the new `'suspended'` state (data-model.md) — the listener is torn down proactively by the app itself, not left to be silently killed by iOS.
3. **Expect**: on the PS2 side, the connection drops in a way OPL reports as a clean disconnect/error, not an indefinite hang.
4. Reopen the app.
5. **Expect**: the Sharing screen clearly shows that sharing stopped because the app was backgrounded, with an easy action to restart it — never silently showing a stale "connected" state from before backgrounding.
6. **This scenario passing is a hard requirement, not a nice-to-have** — spec.md FR-008 and SC-004 treat "never show stale connected state" as equally important as the connection working in the first place.

## Scenario 6 — iCloud on-demand files don't hang a transfer (iOS-specific)

1. Select a library folder in iCloud Drive containing at least one file that has been evicted locally (visible in Files app with a cloud-download icon, not a checkmark).
2. Start sharing and, from the PS2, attempt to open/boot the not-yet-downloaded title.
3. **Expect**: the app begins downloading the file on-demand (visible progress if the UI surfaces it) rather than the PS2's read hanging indefinitely or receiving corrupted/truncated data.
4. If the download exceeds a reasonable bound, **Expect**: a clear error surfaces instead of an indefinite hang (research.md R8).

## Scenario 7 — Essentials catalog, Smart Fill, and downloads (US3)

1. Open the Essentials catalog tab.
2. **Expect**: the catalog loads with search/filter working, and box art renders for most items (same `Named_Boxarts`-subtree fix already applied on Android — research.md/contracts note this is pure HTTP/JSON logic, not Android-specific, so it should port cleanly, but confirm live rather than assuming).
3. Open the Smart Fill wizard, confirm the displayed available-space figure matches the real free space of the selected library's volume.
4. Choose a budget within that space and each mode (rating, random) in turn; confirm the generated plan never exceeds the chosen budget.
5. Confirm the legal notice for a small selection and start the download.
6. **Expect**: the item appears in the transfer queue with live progress, and on completion the file is present in the correct library subfolder (verifiable via the Files app).

## Hardware Smoke Test (blocking — spec.md SC-007)

Every scenario above involving a real PS2 (3, 4, 5, 6 with a PS2-side read, 7 combined with Scenario 3's sharing) MUST be run against **physical hardware** — a real iPhone and a real PS2 running Open PS2 Loader — before any user story in this feature is considered done. Per Constitution Principle V and the lesson already learned twice in this repository (desktop spec 005, Android spec 006), code review and Simulator-only verification are explicitly insufficient for protocol-compatibility and background-execution-behavior claims. Record findings (pass/fail per scenario, any new port/permission/timing surprises — matching the format of Android's own "Correction found during on-device implementation" notes in `research.md`) so they're available to whoever eventually revisits this feature, rather than rediscovered from scratch.
