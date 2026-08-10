# Quickstart: Android OPL Network Library

Validation guide for this feature. Assumes an Android device or emulator (API 29+) with a folder already populated with a sample OPL-structured library (`DVD`/`CD`/`PS1`/`APPS`/`ART`/`CFG`/`VMC`), and — for hardware-dependent scenarios — a PS2 running Open PS2 Loader on the same local network as the Android device.

## Prerequisites

- `mobile/` app built and installed via a dev client (not Expo Go — see `research.md` R1) on a physical Android device or emulator, API 29+.
- A sample library folder with a mix of conformant and non-conformant OPL naming, at least one item per recognized type (DVD/CD/PS1/APPS), for catalog-validation scenarios. A ~500-item reference library for the performance scenarios (SC-002/SC-003/SC-008), matching the desktop precedent.
- For Scenarios 2, 7, and the Hardware Smoke Test: a real PS2 with Open PS2 Loader installed, connected to the **same Wi-Fi network** as the Android device.
- Project's unit/instrumented/integration test suites passing on the branch before manual validation (Constitution Principle V gate) — exact commands defined in `tasks.md`.

## Scenario 1 — Select a library and confirm persisted access (US1)

1. Install and open the app fresh (no library selected).
2. **Expect**: Home shows the "no library configured" state with a single primary action.
3. Tap to select a library, choose a folder via the system picker (try both an internal-storage folder and, if available, a USB-OTG-attached drive — FR-005), confirm.
4. **Expect**: the app shows the selected folder as the active library everywhere (Home, Library tab, Sharing setup).
5. Fully close the app (remove from recents) and reopen it.
6. **Expect**: the same library is still active, no reselection prompt (FR-003, SC-006).

## Scenario 2 — Catalog a library and surface issues (US2)

1. With a library selected, start a catalog scan.
2. **Expect**: progress is visible and continuous until completion; item counts per type appear (FR-008/FR-010).
3. Include at least one file with a non-conformant name or misplaced location in the test library.
4. **Expect**: it's flagged with a clear "needs attention" status, not hidden or silently corrected (FR-009).
5. Start a new scan and cancel it mid-way.
6. **Expect**: cancellation completes within ~2s (SC-003), the previously completed snapshot (if any) remains intact and displayed.

## Scenario 3 — Start sharing, guided PS2 setup, real SMB browse (US3, US4)

1. From the sharing screen, start sharing for the first time.
2. **Expect**: the app requests username/password, then requires a separate explicit acknowledgment that the PS2 will be able to write to the library (FR-017/FR-018), before the service actually starts.
3. **Expect**: status becomes `running-idle`, with local address/port/share name displayed (FR-016).
4. Open the guided tutorial (US4); follow the displayed steps on the PS2: Configurações → Configurações de Rede → Servidor SMB → enter the exact address/port/share/username/password shown.
5. On the PS2, save and browse the network share from OPL's game list.
6. **Expect**: the PS2 lists the same DVD/CD/PS1/Apps titles visible in the app's catalog. Launch one title of each available type to confirm it boots — this step validates the Kotlin SMB1 server against real OPL client behavior (`contracts/smb-protocol-scope.md`) and cannot be replaced by a unit test.

## Scenario 4 — Status reflects real connection state (US5)

1. With sharing on and no PS2 connected, confirm Home/Sharing screen shows "running, waiting for connection".
2. Connect from the PS2 (as in Scenario 3).
3. **Expect**: within ~10s (SC-004) the app shows the connected state distinctly (e.g. emerald), with the client's activity.
4. Power off the PS2 or disconnect it from the network.
5. **Expect**: the app eventually reflects the client as disconnected — no stale "connected" state (`ConnectedClient.lastActivityAt` aging, per `data-model.md`).

## Scenario 5 — Sharing survives being backgrounded (US3 AS5, SC-007)

1. With sharing active and a PS2 connected/browsing, switch to another app or lock the screen.
2. Leave the device backgrounded for at least 30 minutes while the PS2 session continues (e.g. idle in OPL's game list, or mid-playthrough).
3. **Expect**: the persistent notification remains, the PS2 connection is not dropped, and returning to the app shows an uninterrupted `running-connected` state (FR-020/FR-021).

## Scenario 6 — Local-network-only enforcement (FR-015, SC-005)

1. With sharing on, attempt to reach the bound SMB port from a device outside the local subnet (or simulate a non-RFC1918 source address in a test harness).
2. **Expect**: the connection is rejected before any protocol negotiation completes.

## Scenario 7 — Off by default, explicit stop, no silent resume (FR-014, FR-022, FR-032, SC-005)

1. Fresh install, open the app.
2. **Expect**: sharing shows `off`; no listener is bound.
3. Start sharing, then force-stop the app process (simulating the OS killing it under memory pressure — e.g. via `adb shell am force-stop`).
4. Reopen the app.
5. **Expect**: sharing shows `off`, not a stale "running" state; the notification is gone; a new explicit action is required to start again (FR-032) — the app never silently resumed sharing in the background.

## Scenario 8 — No local network blocks start with a clear message (US3 AS4)

1. Disable Wi-Fi (or connect only to mobile data) on the Android device.
2. Attempt to start sharing.
3. **Expect**: the action is blocked with a plain-language explanation (FR-030), no service is started.

## Scenario 9 — Invalid credentials rejected safely (FR-034)

1. With sharing on, attempt to connect to the SMB share using a wrong username or wrong password from the PS2 (or a test SMB client).
2. **Expect**: rejection with a single generic authentication-failure message (not revealing which field was wrong); no `ConnectedClient` entry is created for the failed attempt.

## Scenario 10 — Memory ceiling on large files (SC-008)

1. Include a >4GB DVD image in the test library (or a synthetic large file for this scenario if an authentic backup isn't available).
2. With sharing active and the PS2 (or a test SMB client) reading that file, monitor the app's memory usage (e.g. Android Studio Profiler).
3. **Expect**: memory usage stays within a fixed ceiling regardless of file size — no proportional growth as the read progresses (FR-026).

## Hardware Smoke Test (mandatory, SC-009)

Non-optional per Constitution Principle V and `contracts/smb-protocol-scope.md`: repeat the boot step of Scenario 3 with a real PlayStation 2 + Open PS2 Loader for at least one title of each type present in the test library (DVD, CD, PS1, and an APPS entry if available). Record the result the same way desktop spec 005 does (`recordHardwareSmoke`-equivalent entry in `LocalHistoryEntry`) — this feature is not considered validated until this step passes on real hardware, independent of how much automated coverage exists elsewhere.
