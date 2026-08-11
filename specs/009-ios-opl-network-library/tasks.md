---
description: 'Task list for iOS OPL Network Library'
---

# Tasks: iOS OPL Network Library

**Input**: Design documents from `/specs/009-ios-opl-network-library/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — Constitution Principle V requires automated tests for domain logic (path confinement, protocol parsing, catalog logic), the same bar already applied to the Android implementation (JUnit). This plan's Swift equivalent is XCTest, ported case-for-case where the Kotlin logic is a direct port.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) so each is independently implementable, testable, and demoable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (share with PS2), US2 (diagnose/prepare device), US3 (Essentials/Smart Fill/downloads)
- All Swift paths are under `mobile/ios/OplForgeMobile/` unless noted; all Kotlin paths referenced as porting sources are under `mobile/android/app/src/main/java/com/oplforge/mobile/`.

## Path Conventions

Mirrors `plan.md`'s Structure Decision — one Swift file per Kotlin file it ports, in the equivalent package-per-domain subfolder, so a future protocol/behavior fix is easy to apply to both platforms.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get an iOS project that builds and runs on a physical iPhone, with the permission strings this feature needs already declared, before any native module work starts.

- [ ] T001 Add `ios: {...}` block to `mobile/app.json` (bundle identifier `com.oplforge.mobile`, matching Android's package name; `expo-build-properties` iOS deployment target 16.0 per research.md R1)
- [ ] T002 Remove the `-p android` hardcoding from the `prebuild` script in `mobile/package.json`, add a companion `ios`/`prebuild:ios` script (`expo run:ios` / `expo prebuild -p ios`)
- [ ] T003 Run `expo prebuild -p ios` in `mobile/` and commit the generated `mobile/ios/` Xcode project/Podfile
- [ ] T004 Add `NSLocalNetworkUsageDescription` and `NSBonjourServices` to `mobile/ios/OplForgeMobile/Info.plist` (research.md R4), with clear PS2-sharing-specific copy
- [ ] T005 Add `NSDocumentsFolderUsageDescription`-equivalent document-picker usage copy to `Info.plist` (research.md R2)
- [ ] T006 Confirm the app builds and runs on a physical iPhone via Xcode, showing the existing cross-platform React Native Home screen with no native modules registered yet (sanity check before any Swift work begins)

**Checkpoint**: `mobile/ios/` exists, builds, and runs the existing JS app shell on a real device.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Native infrastructure every user story depends on — library selection (named directly in all 3 stories' Given clauses), shared protocol-agnostic utilities, and local persistence. No user story's acceptance scenarios can be tested until this phase is done.

- [ ] T007 [P] Port `PathConfinement.kt` → `Shared/PathConfinement.swift` (confines a resolved logical path to the security-scoped bookmark's root, rejects traversal — same contract as Android, different underlying URL resolution)
- [ ] T008 [P] Port `WriteLock.kt` → `Shared/WriteLock.swift` (single-writer-per-file lock, used by both the SMB server and the transfer queue to prevent concurrent-write corruption per spec.md Edge Cases)
- [ ] T009 [P] Create `Shared/TypedEventEmitter.swift` — the Swift-side equivalent of the generated event-emitter base class Kotlin modules use for `onSharingSessionEvent`/`onCatalogScanEvent`/`onTransferQueueEvent`/`onArtSyncEvent` (contracts/native-modules-ios.md)
- [ ] T010 [P] Create `Shared/KeychainStore.swift` — `kSecClassGenericPassword` wrapper (save/read/delete) for SMB credentials (research.md R7)
- [ ] T011 [P] Define the local catalog-index persistence schema (Core Data model or SQLite table, matching `CatalogEntry`/`CatalogSnapshot`/`DiagnosticsReport`/`CatalogListingCacheEntity`/`TransferItem` shapes from data-model.md) in `Shared/Persistence.swift`
- [ ] T012 [P] Create `Shared/DocumentBookmarkStore.swift` — resolves/persists security-scoped bookmarks per data-model.md's `DocumentBookmark` entity (bookmark data in `UserDefaults`, `startAccessingSecurityScopedResource`/`stopAccessingSecurityScopedResource` bracketing per call, staleness/resolution-failure surfaced as a typed result, research.md R2)
- [ ] T013 [US1][US2][US3] Implement `Library/LibraryModule.swift` (registers as `LibraryModule`, same name as Android) — `selectLibrary()` presents `UIDocumentPickerViewController(forOpeningContentTypes: [.folder])`, `getActiveLibrary()`/`revalidateAccess()` use T012, `clearAppData()` wipes `UserDefaults`/Keychain/the T011 store (research.md R2, contracts/native-modules-ios.md)
- [ ] T014 [P] XCTest: `PathConfinementTests.swift` — traversal-rejection cases ported from the existing Kotlin test suite
- [ ] T015 [P] XCTest: `DocumentBookmarkStoreTests.swift` — resolve/stale/failure cases (mockable via a test double `URL`, since real bookmark resolution needs a real security scope)
- [ ] T016 [P] XCTest: `LibraryModuleTests.swift` — `getActiveLibrary()`/`revalidateAccess()` state transitions (no-library / valid / access-lost), matching Android's `LibrarySelectionModuleTest` coverage

**Checkpoint**: A user can select a library folder via the native picker and it persists across app restarts — the shared precondition for every user story below.

---

## Phase 3: User Story 1 - Selecionar a Biblioteca e Compartilhar com a PS2 (Priority: P1) 🎯 MVP

**Goal**: Catalog a selected library and serve it to a real PS2 over SMB1, with the app correctly surfacing the iOS-specific foreground-only constraint instead of showing stale "connected" state.

**Independent Test**: quickstart.md Scenarios 1 (already covered by Phase 2), 3, 4, 5 — select a library, start sharing, connect a real PS2, confirm it lists/boots titles, background the app and confirm sharing stops cleanly and visibly.

### Tests for User Story 1

- [ ] T017 [P] [US1] XCTest: `FrameCodecTests.swift` — NetBIOS framing + SMB1 header encode/decode, ported from the existing Kotlin `FrameCodecTest.kt` fixtures
- [ ] T018 [P] [US1] XCTest: `NtlmV1Tests.swift` — MD4 + DES-based NTLMv1 response, verified against the same published MS-NLMP test vector already used on Android
- [ ] T019 [P] [US1] XCTest: `CommandHandlersTests.swift` — share-level auth flow (dummy `SESSION_SETUP_ANDX` succeeds unconditionally, real password validated at `TREE_CONNECT_ANDX`), `ECHO` handled pre-auth with `UID 0`, `TREE_CONNECT_ANDX` path parsing stops at the first NUL (not the whole Path+Service blob) — these three cases are direct regression tests for the exact bugs already found and fixed on Android (contracts/smb-protocol-scope.md)
- [ ] T020 [P] [US1] XCTest: `CatalogScannerTests.swift` — art-matching normalization (`<GAMEID>_COV[2].png`) ported from `CatalogScannerArtMatchingTest.kt`

### Implementation for User Story 1

- [ ] T021 [US1] Implement `Catalog/CatalogScanModule.swift` (registers as `CatalogModule`) — folder walk via `FileManager` bracketed by T012's security scope, populates the T011 schema, emits `onCatalogScanEvent` progress (mirrors `CatalogScanModule.kt`/`CatalogScanner.kt`)
- [ ] T022 [P] [US1] Port `FrameCodec.kt` → `Sharing/Smb/FrameCodec.swift` (NetBIOS + SMB1 header codec, byte-for-byte port, no protocol reinterpretation)
- [ ] T023 [P] [US1] Port `NtlmV1.kt` → `Sharing/Smb/NtlmV1.swift` (hand-rolled MD4 port + `CommonCrypto` DES-ECB for the challenge-response construction, research.md R6)
- [ ] T024 [US1] Port `CommandHandlers.kt` → `Sharing/Smb/CommandHandlers.swift` (NEGOTIATE/ECHO/SESSION_SETUP_ANDX/TREE_CONNECT_ANDX/NT_CREATE_ANDX/OPEN_ANDX/READ_ANDX/WRITE_ANDX/CLOSE/TRANSACTION2/CHECK_DIRECTORY — share-level security model per contracts/smb-protocol-scope.md, depends on T022/T023/T007/T008) — includes the iCloud on-demand check (research.md R8: resolve `NSURLUbiquitousItemDownloadingStatusKey` before serving file content in the `NT_CREATE_ANDX`/`OPEN_ANDX`/`READ_ANDX` path)
- [ ] T025 [US1] Implement `Sharing/Smb/SmbServer.swift` — `NWListener` on port 1445 (research.md R5), one connection loop per `NWConnection`, dispatches frames to T024
- [ ] T026 [US1] Implement `Sharing/SharingModule.swift` (registers as `SharingModule`) — `startSharing`/`stopSharing`/`getSession`/`getRecentConnections` per the existing TurboModule spec, credentials via T010, session state machine including the new `'suspended'` value (data-model.md), observes `UIApplication.willResignActiveNotification`/`didBecomeActiveNotification` to tear down T025's listener and emit the state change (research.md R3) — checks a completed catalog snapshot exists (T021) before allowing `startSharing`, mirroring Android's `CATALOG_NOT_READY` guard
- [ ] T027 [US1] Wire the Tutorial screen's native data source (`getConnectionInstructions()`) to T026's live session state — no new JS-side screen work needed (already cross-platform)

**Checkpoint**: quickstart.md Scenarios 1, 3, 4, 5 pass on a physical iPhone against a real PS2 — sharing works, and backgrounding the app stops it cleanly and visibly rather than silently.

---

## Phase 4: User Story 2 - Catalogar, Diagnosticar e Preparar o Dispositivo (Priority: P2)

**Goal**: Diagnose the 7 mandatory OPL folders and free space, and let the user auto-create any missing folders.

**Independent Test**: quickstart.md Scenario 2 — point at a library missing folders, run diagnostics, confirm the missing list, tap "Preparar dispositivo," confirm the folders now exist in the Files app.

### Tests for User Story 2

- [ ] T028 [P] [US2] XCTest: `DiagnosticsModuleTests.swift` — missing-folder detection, readiness classification, and the 20s timeout guard (research.md/contracts: `Task`+`withThrowingTaskGroup` timeout racing, mirrors Android's `withTimeoutOrNull` fix)

### Implementation for User Story 2

- [ ] T029 [US2] Implement `Diagnostics/DiagnosticsModule.swift` (registers as `DiagnosticsModule`) — checks the 7 mandatory folders (DVD/CD/PS1/APPS/ART/CFG/VMC) and free space via T012's resolved URL, reuses T021's `CatalogScanModule` for the catalog-issue-count input to the readiness classification (mirrors `DiagnosticsModule.kt`'s reuse of `CatalogScanner`), wrapped in the T028-tested timeout guard
- [ ] T030 [US2] Implement `Diagnostics/ReadinessClassifier.swift` — pure classification logic (`ready`/`ready-with-warnings`/`requires-reorganization`/`incompatible`), direct port of the Kotlin equivalent
- [ ] T031 [US2] Implement `prepareDeviceStructure()` on `DiagnosticsModule.swift` — creates any missing mandatory folder via `FileManager.createDirectory` under the bookmark-resolved root, then re-runs T029's diagnostic

**Checkpoint**: quickstart.md Scenario 2 passes — diagnostics correctly flags missing folders and "Preparar dispositivo" resolves them in one pass.

---

## Phase 5: User Story 3 - Descobrir e Baixar Jogos do Catálogo Essentials (Priority: P3)

**Goal**: Browse the Essentials catalog, run Smart Fill against the real free space of the selected library, confirm the legal notice, and download through a durable transfer queue — plus Art Sync for already-cataloged games missing box art.

**Independent Test**: quickstart.md Scenarios 6 (iCloud on-demand handling reused here for downloads too) and 7 — browse/filter the catalog with art loading, generate a Smart Fill plan within the real free-space bound, confirm legal text, watch a download complete into the correct library subfolder.

### Tests for User Story 3

- [ ] T032 [P] [US3] XCTest: `SmartFillPlannerTests.swift` — rating-mode ordering, rating-mode filling remaining budget with lower tiers, random-mode selection, budget-never-exceeded — ported from `SmartFillPlannerTest.kt` (all 6 cases, including the two added when the rating/random mode split landed on Android)
- [ ] T033 [P] [US3] XCTest: `LibretroArtIndexTests.swift` — the `Named_Boxarts`-subtree-by-sha fetch strategy (research.md/contracts: fetching the whole repo tree 500s on GitHub's API for this 6.3GB repo; only the subtree-by-sha approach is valid — assert the implementation never calls the whole-tree endpoint)
- [ ] T034 [P] [US3] XCTest: `ZipCentralDirectoryParserTests.swift` — reuse the existing real-byte fixtures (`oplm_art_zip_tail_sample.bin`/`oplm_art_central_dir_sample.bin`) already committed for the Android test suite; same ZIP64 parsing assertions

### Implementation for User Story 3

- [ ] T035 [P] [US3] Port `GameScoring.kt`/`ArchiveFileMapper.kt`-equivalent pure logic → `Essentials/GameScoring.swift` (tier scoring, filename/media-type mapping — no platform dependency)
- [ ] T036 [US3] Implement `Essentials/EssentialsCatalogClient.swift` — `URLSession`-based Internet Archive metadata fetch + 8-way-bounded concurrent accessibility/art-enrichment pass using a Swift structured-concurrency semaphore (`TaskGroup` batching or an actor-based `AsyncSemaphore` — never a thread-blocking primitive, contracts/native-modules-ios.md's explicit callout of the Android thread-starvation lesson), 24h Room-cache-equivalent freshness check against T011's schema
- [ ] T037 [US3] Implement `Essentials/LibretroArtIndex.swift` — two-step fetch (root tree for the `Named_Boxarts` sha, then that subtree directly, research.md R2-equivalent GitHub-API finding documented in contracts/native-modules-ios.md), title-similarity matching ported from the Kotlin implementation
- [ ] T038 [US3] Implement `Essentials/SmartFillPlanner.swift` — rating/random mode selection against a real free-space read via T012, direct port of `SmartFillPlanner.kt`'s greedy-fill logic
- [ ] T039 [US3] Implement `Essentials/EssentialsModule.swift` (registers as `EssentialsModule`) — `listCatalog`/`refreshCatalog`/`getAvailableSpace`/`createSmartFillPlan`/`confirmAndEnqueue` per the existing TurboModule spec, legal-confirmation-text exact-match gate before enqueueing (mirrors Android's `LEGAL_CONFIRMATION_REQUIRED` check byte-for-byte against the same copy)
- [ ] T040 [US3] Implement `Transfer/TransferQueueModule.swift` (registers as `TransferModule`) — durable queue persisted via T011, `URLSession` background-configuration downloads for Essentials/Art Sync fetches (contracts/native-modules-ios.md notes this — unlike the SMB listener — has real iOS background-continuation support since it's a bounded system-managed transfer), single-writer enforcement via T008, `onTransferQueueEvent` progress
- [ ] T041 [P] [US3] Port `ZipCentralDirectoryParser.kt` → `Art/ZipCentralDirectoryParser.swift` (ZIP64 EOCD/locator/central-directory/local-header parsing, pure byte logic, no platform dependency)
- [ ] T042 [US3] Implement `Art/RemoteZipArtIndex.swift` — HTTP range-request fetch of the ZIP64 index and per-entry art bytes from the archive.org ZIP (`URLSession` with the same generous timeout margin already tuned on Android after a real timeout was hit)
- [ ] T043 [US3] Implement `Art/ArtSyncModule.swift` (registers as `ArtSyncModule`) — `planArtSync`/`startArtSync` per the existing TurboModule spec, 4-way-bounded concurrent downloads (same structured-concurrency requirement as T036), writes into the `ART` folder via T012

**Checkpoint**: quickstart.md Scenario 7 passes — Essentials browsing, Smart Fill, legal-gated downloads, and Art Sync all work against real data on a physical iPhone.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide consistency and the mandatory hardware validation gate — not a new feature, but not optional either (spec.md SC-007).

- [ ] T044 [P] Update `mobile/README.md` with iOS build/run instructions alongside the existing Android instructions
- [ ] T045 [P] Confirm CI (`.github/workflows/`) builds the iOS target alongside the existing Android debug-APK build, publishing an iOS artifact (unsigned/dev build, matching the existing "not code-signed, for testing" posture of the Android continuous build) — coordinate with whatever the repo's actual CI/signing setup allows; this task's scope is "confirm and wire," not "set up Apple Developer Program enrollment," which is out of this plan's control
- [ ] T046 Run the full XCTest suite (T014-T020, T028, T032-T034) and confirm all pass before starting quickstart.md's manual scenarios
- [ ] T047 Execute quickstart.md Scenario 1 (library selection) on a physical iPhone
- [ ] T048 Execute quickstart.md Scenario 2 (catalog/diagnose/prepare) on a physical iPhone
- [ ] T049 Execute quickstart.md Scenario 3 (start sharing, real PS2 browse/boot) — **the Hardware Smoke Test's core case**; if it fails at the network-menu stage or at login specifically, check the two carried-over Android regressions first (quickstart.md Scenario 3 steps 7-8) before treating it as a new bug
- [ ] T050 Execute quickstart.md Scenario 4 (connection state accuracy) on a physical iPhone + real PS2
- [ ] T051 Execute quickstart.md Scenario 5 (clean stop on backgrounding) — confirm the `'suspended'` state fires and the PS2 sees a clean disconnect, not a hang
- [ ] T052 Execute quickstart.md Scenario 6 (iCloud on-demand file) with a deliberately-evicted file in a real iCloud Drive-backed library
- [ ] T053 Execute quickstart.md Scenario 7 (Essentials/Smart Fill/downloads) on a physical iPhone
- [ ] T054 Record findings from T047-T053 (pass/fail, any new port/permission/timing surprises) in a "Correction found during on-device implementation" note in `research.md`, matching the format Android's own research.md already uses — this is how the next person avoids rediscovering the same bug from scratch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (needs a buildable Xcode project to add Swift files to). **Blocks all user stories** — T013 (`LibraryModule`) is named directly in every story's Given clause.
- **User Story 1 (Phase 3)**: Depends on Phase 2. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and on T021 (`CatalogScanModule`, built in US1) for its catalog-issue-count input — this is the one real cross-story dependency, matching Android's own `DiagnosticsModule.kt` reusing `CatalogScanner`. If strict independence is required, T021 can be pulled forward into Phase 2 instead; left in US1 here because spec.md's own US1 acceptance scenario 2 already requires a completed catalog before sharing can start, so US1 delivers it first in practice.
- **User Story 3 (Phase 5)**: Depends on Phase 2 only (does not depend on US1/US2's own modules, only on the shared Foundational infra) — genuinely independent, can be built in parallel with US1/US2 by a separate contributor.
- **Polish (Phase 6)**: Depends on whichever user stories are in scope for a given release being complete.

### Parallel Opportunities

- All `[P]`-marked Foundational tasks (T007-T012, T014-T016) touch different files and can run in parallel once T003/T006 (Phase 1) are done.
- Within US1: T017-T020 (tests) and T022-T023 (pure ports) are `[P]`; T024-T027 have real sequential dependencies (each needs the previous file to exist).
- US3 is almost entirely parallel-safe internally (T032-T037, T041 are `[P]`) since Essentials and Art Sync are separate subsystems that only share T011/T012/T008 from Foundational.
- **US2 and US3 can be staffed in parallel by different contributors** once Phase 2 and (for US2 specifically) T021 are done — they touch entirely disjoint file sets.

---

## Parallel Example: User Story 1

```bash
# Once Foundational (Phase 2) is done, these can start together:
Task: "XCTest FrameCodecTests.swift"
Task: "XCTest NtlmV1Tests.swift"
Task: "Port FrameCodec.kt -> Sharing/Smb/FrameCodec.swift"
Task: "Port NtlmV1.kt -> Sharing/Smb/NtlmV1.swift"

# CommandHandlersTests.swift (T019) waits on T022/T023 existing (imports them),
# but can be written test-first against their planned signatures if TDD is preferred.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational) — a real device build with library selection working.
2. Complete Phase 3 (US1) — sharing works end to end against a real PS2, including the foreground-only constraint being handled gracefully.
3. **STOP and run quickstart.md Scenarios 1/3/4/5 on real hardware** before adding anything else — this is the feature's core value and its primary technical risk (protocol correctness + background-execution behavior), both unverifiable by code review alone.
4. Demo/ship the MVP if ready — US2 and US3 are real added value but not required for the app to be useful.

### Incremental Delivery

1. Setup + Foundational → a device build with persistent library selection.
2. - US1 → MVP: share a library with a real PS2 (biggest platform risk, done first).
3. - US2 → diagnose/prepare device (small, low-risk addition).
4. - US3 → Essentials/Smart Fill/transfers/Art Sync (largest single addition by file count, but lowest platform risk — mostly `URLSession`/pure-logic ports with no iOS-specific unknowns).
5. Each increment is independently demoable per its own quickstart.md scenarios.

### Parallel Team Strategy

With multiple contributors: one completes Setup + Foundational alone (it's small and blocking), then splits — one person on US1 (the highest-risk, highest-priority path, should get the most experienced hands), one on US3 (large but low-risk, good for someone newer to the codebase), and US2 either folded into the US1 contributor's follow-up work (since it needs T021) or picked up by whoever finishes first.

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task.
- `[Story]` labels trace every implementation task back to spec.md's prioritized user stories.
- Every task that "ports" a Kotlin file names its exact source path — this is deliberate: the Kotlin implementation is already hardware-validated wire-format/domain-logic knowledge, and the task is to carry that correctness forward, not to re-derive it.
- Commit after each task or logical group, per the repo's existing convention (see git history — Android's SMB fixes each landed as their own focused commit with a message explaining the specific bug found).
- The Hardware Smoke Test (T049 and its surrounding scenarios) is not a formality — per Constitution Principle V and the lesson already learned twice in this repository (desktop spec 005, Android spec 006), no user story here is "done" until it passes on real hardware.
