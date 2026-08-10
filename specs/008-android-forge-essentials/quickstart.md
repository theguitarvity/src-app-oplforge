# Quickstart: Funcionalidades-Chave do Forge no Android

Validation guide for this feature. Assumes an Android device or emulator (API 29+) with `mobile/` already built and a library already selected (spec 006 Scenario 1), plus internet connectivity for the Essentials scenarios.

## Prerequisites

- Everything from spec 006's `quickstart.md` prerequisites, plus:
- A library folder with meaningful free space remaining (for Smart Fill/space-check scenarios) and, separately, a nearly-full library folder (for the insufficient-space scenario).
- A local `.iso`/`.zso` file already present on the device (e.g. in Downloads) for the import scenarios, including one deliberately larger than the destination filesystem's size limit for the USBExtreme-splitting scenario.
- Network connectivity reaching `archive.org` (Essentials scenarios only — Diagnostics and local import work offline).
- Project's unit/instrumented/WorkManager-integration test suites passing on the branch before manual validation (Constitution Principle V gate) — exact commands defined in `tasks.md`.

## Scenario 1 — Browse and search the Essentials catalog (US1)

1. Open the Essentials screen.
2. **Expect**: a list of games loads (from cache if fresh, otherwise after a brief fetch), each showing title, type, and size.
3. Type a search term.
4. **Expect**: the list filters live, no full reload.
5. Tap an item whose link is known-inaccessible (or simulate one).
6. **Expect**: it's visibly marked as unavailable and cannot be selected for download.

## Scenario 2 — Download one item with legal confirmation (US1)

1. Select one available catalog item.
2. **Expect**: a legal confirmation prompt appears before anything is queued (FR-002) — declining cancels with nothing added to the queue.
3. Confirm.
4. **Expect**: the item appears in the Transfers queue in `queued` then `running` state with live progress.
5. Let it complete, then trigger a re-catalog (spec 006).
6. **Expect**: the new item appears in the Library tab under the correct type (DVD/CD/PS1).

## Scenario 3 — Smart Fill respects the space budget (US1)

1. Open Smart Fill, set a byte budget below the library's free space.
2. **Expect**: a plan appears listing selected items whose total size fits the budget, with remaining space shown.
3. Confirm the plan.
4. **Expect**: each selected item still requires its own individual legal confirmation before enqueueing (FR-003) — Smart Fill selects, it does not bypass consent.

## Scenario 4 — Insufficient space blocks the download upfront (FR-004)

1. Attempt to download (or Smart Fill toward) an item larger than the library's actual free space.
2. **Expect**: the action is blocked with a clear message before any network transfer starts — no partial download appears in the queue.

## Scenario 5 — Import a local file (US2)

1. Open "Adicionar jogo" → choose a local file via the system picker.
2. **Expect**: the file is copied into the correct library folder without modifying the original.
3. Re-catalog.
4. **Expect**: the imported item appears in the Library tab.
5. Repeat the import with the exact same file.
6. **Expect**: the system warns it already exists (FR-009) instead of silently duplicating it.

## Scenario 6 — Oversized file import splits transparently (US2, research.md R7)

1. Import the deliberately-oversized test file from Prerequisites.
2. **Expect**: the transfer completes with multiple part files created in the library (mirroring desktop's USBExtreme layout), and the item is still navigable/playable from OPL's perspective (structurally correct, even though a real PS2 boot test isn't required for this scenario — that's covered by spec 006's own Hardware Smoke Test for playback correctness in general).

## Scenario 7 — Transfer queue survives the app being killed (US4, SC-003)

1. Start a download or import of a reasonably large file.
2. While it's `running`, force-stop the app process (e.g. `adb shell am force-stop`).
3. Reopen the app and check the Transfers screen.
4. **Expect**: the item is present, not lost — either resumed automatically or shown as `queued`/retryable, never silently vanished, never falsely shown as `completed`.

## Scenario 8 — Concurrent writers to the same file never corrupt it (US4, FR-012/FR-013, SC-005)

1. Start an import/download targeting a specific destination file.
2. While it's `running`, trigger a second transfer targeting the exact same destination path (or, if hardware allows, have the PS2 attempt to read that same file via SMB — spec 006 — while the write is in progress).
3. **Expect**: the second writer queues behind the first rather than writing concurrently; a concurrent PS2 read never sees a torn/partial file.

## Scenario 9 — Diagnostics reports missing folders and readiness (US3)

1. Using a library folder deliberately missing one or more of the 7 mandatory OPL folders, open Diagnostics.
2. **Expect**: the missing folders are listed explicitly, free space is shown, and the overall readiness matches one of the four desktop-parity states (research.md R8) — not a silently-simplified version.
3. Fix the library (create the missing folder) and re-run Diagnostics.
4. **Expect**: the report updates to reflect the fix without requiring a full app restart.

## Scenario 10 — Component Manager is confirmed absent, not silently missing

1. Review the Settings/Tools area of the app.
2. **Expect**: no "Component Manager" entry exists, and this quickstart file (and `spec.md`'s FR-014) is the documented reason why — this is not an oversight to be "fixed" later without revisiting the scope decision explicitly.
