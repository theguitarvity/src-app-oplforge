# Tasks: Funcionalidades-Chave do Forge no Android

**Input**: Design documents from `/specs/008-android-forge-essentials/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included — both `spec.md` and the Constitution (Principle V) require automated tests proportional to risk, split by layer (pure Kotlin domain logic, Android instrumented SAF/write tests, WorkManager durability integration tests, RN component/store tests), matching the discipline already established in specs 006/007.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P2/P2) to enable independent implementation and testing of each story. This spec extends the existing `mobile/` app (specs 006/007) — no new project, same package (`com.oplforge.mobile`), same TurboModule/Zustand/screens conventions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps the task to its user story (US1/US2/US3/US4)
- File paths are exact, per `plan.md` Project Structure

## Path Conventions

- Kotlin native layer: `mobile/android/app/src/main/java/com/oplforge/mobile/`
- Kotlin unit tests: `mobile/android/app/src/test/java/com/oplforge/mobile/`
- Kotlin instrumented tests: `mobile/android/app/src/androidTest/java/com/oplforge/mobile/`
- React Native/TypeScript app layer: `mobile/src/`
- Jest tests: `mobile/__tests__/src/`

---

## Phase 1: Setup

**Purpose**: Dependencies and scaffolding shared by every user story in this spec.

- [x] T001 Add OkHttp dependency (`com.squareup.okhttp3:okhttp`) to `mobile/android/app/build.gradle` for the Essentials HTTP client
- [x] T002 Add WorkManager dependencies (`androidx.work:work-runtime-ktx`, `androidx.work:work-testing`) to `mobile/android/app/build.gradle`
- [x] T003 [P] Create empty package directories `mobile/android/app/src/main/java/com/oplforge/mobile/{essentials,transfer,diagnostics}/`
- [x] T004 [P] Add Codegen spec stubs `mobile/src/native/specs/NativeEssentialsModule.ts`, `NativeTransferModule.ts`, `NativeDiagnosticsModule.ts` (TurboModule interfaces per `contracts/native-modules.md`, following the exact pattern of `mobile/src/native/specs/NativeCatalogModule.ts`)
- [x] T005 [P] Add new DTOs (`CatalogListing`, `TransferItem`, `DiagnosticsReport`) to `mobile/src/types/index.ts` per `data-model.md`

**Checkpoint**: Dependencies resolve, `./gradlew :app:compileDebugKotlin` still succeeds with the new empty packages, `npx tsc --noEmit` still passes with the new types/spec stubs.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story needs — Room schema, the durable transfer executor, and the write-safety extension. Per `plan.md`'s Structure Decision, the transfer _mechanism_ is foundational; each user story's own phase covers its user-facing behavior and tests.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Add `TransferItemEntity`/`TransferDao` to `mobile/android/app/src/main/java/com/oplforge/mobile/transfer/TransferItemEntity.kt` and `TransferDao.kt` per `data-model.md` TransferItem, and register both in `AppDatabase` (`mobile/android/app/src/main/java/com/oplforge/mobile/shared/AppDatabase.kt`, bump `version` and add a `Migration` since spec 006/007's `AppDatabase` already ships)
- [x] T007 Extend `WriteLock` (`mobile/android/app/src/main/java/com/oplforge/mobile/sharing/WriteLock.kt`, spec 007) to be usable from outside the `sharing` package, or promote it to `shared/WriteLock.kt` — single shared instance guards SMB writes (spec 007) and transfer writes (this spec) alike, per `research.md` R6
- [x] T008 Implement `TransferWorker.kt` (`mobile/android/app/src/main/java/com/oplforge/mobile/transfer/TransferWorker.kt`) — a `CoroutineWorker` that reads a `TransferItemEntity` by ID, performs a chunked/streamed copy (HTTP→SAF for `kind: download`, SAF→SAF for `kind: import`) while holding the shared `WriteLock` for `destinationLogicalPath`, reports progress via `setProgressAsync`, and updates the Room row's `state`/`transferredBytes` throughout
- [x] T009 Implement rollback-on-failure in `TransferWorker.kt`: any exception (network, I/O, cancellation) deletes partial SAF content/part files written so far and sets `state = failed` with a plain-language `errorMessage`, never leaving a partial artifact (FR-007)
- [x] T010 Implement `TransferQueueModule.kt` (`mobile/android/app/src/main/java/com/oplforge/mobile/transfer/TransferQueueModule.kt`) — TurboModule per `contracts/native-modules.md`: `getQueue()`, `cancel()`, `retry()`, `onTransferQueueEvent()`, enqueue helpers used internally by `EssentialsModule`/import flow; observes `WorkManager.getWorkInfosByTagLiveData` and mirrors state into the Room table
- [x] T011 [P] Wire `TransferQueueModule` into `mobile/android/app/src/main/java/com/oplforge/mobile/OplForgePackage.kt`'s `createNativeModules()`
- [x] T012 [P] `mobile/src/native/TransferModule.ts` — typed wrapper over `NativeTransferModule` (T004), following the exact pattern of `mobile/src/native/SharingModule.ts`
- [x] T013 [P] `mobile/src/stores/transfer-store.ts` — Zustand store subscribing to `onTransferQueueEvent`, same convention as `sharing-store.ts`

**Checkpoint**: A hand-enqueued dummy `TransferItemEntity` (inserted directly in a test) can be observed transitioning `queued → running → completed` via `TransferQueueModule.getQueue()`, proving the executor works end-to-end before any user-facing feature uses it.

---

## Phase 3: User Story 1 - Descobrir e Instalar do Catálogo Essentials (Priority: P1) 🎯 MVP

**Goal**: Browse the Essentials catalog, confirm legally, download, and see the item land in the library.

**Independent Test**: Open the catalog, search, confirm legal text for one item, download it, recatalog, see it in the Library tab.

### Tests for User Story 1

- [x] T014 [P] [US1] Unit tests for IA metadata JSON parsing/media classification in `mobile/android/app/src/test/java/com/oplforge/mobile/essentials/EssentialsCatalogClientTest.kt` (mirrors desktop's `InternetArchiveDirectoryProvider` behavior per `research.md` R1)
- [x] T015 [P] [US1] Unit tests for game scoring/sorting in `mobile/android/app/src/test/java/com/oplforge/mobile/essentials/GameScoringTest.kt`
- [x] T016 [P] [US1] Unit tests for Smart Fill byte-budget selection in `mobile/android/app/src/test/java/com/oplforge/mobile/essentials/SmartFillPlannerTest.kt` (including the "nothing fits" warning case)
- [x] T017 [P] [US1] Unit test asserting `confirmAndEnqueue` rejects any string that doesn't byte-for-byte match the required legal confirmation text (`research.md` R4) in `mobile/android/app/src/test/java/com/oplforge/mobile/essentials/EssentialsModuleTest.kt`
- [x] T018 [P] [US1] Jest test for the Essentials screen (search/filter, legal confirmation gate, Smart Fill summary) in `mobile/__tests__/src/screens/Essentials.test.tsx`, mocking `EssentialsModule.ts`

### Implementation for User Story 1

- [x] T019 [P] [US1] `EssentialsCatalogClient.kt` (`mobile/android/app/src/main/java/com/oplforge/mobile/essentials/`) — OkHttp GET to `https://archive.org/metadata/playstation2_essentials`, parse `files[]`, classify media type, build direct URLs (`research.md` R1)
- [x] T020 [US1] Per-item accessibility check in `EssentialsCatalogClient.kt` — concurrent HEAD requests with 8s timeout, 24h-TTL cache backed by a new Room `CatalogListingCacheEntity` (`research.md` R2)
- [x] T021 [P] [US1] `GameScoring.kt` — port of desktop's `scoreArchiveFile`/`sortCatalogGames` (`research.md` R3)
- [x] T022 [P] [US1] `SmartFillPlanner.kt` — port of desktop's `createSmartFillPlan`, computing available bytes from the active `LibrarySelection` (spec 006) via SAF free-space query
- [x] T023 [US1] `EssentialsModule.kt` TurboModule — `listCatalog`, `refreshCatalog`, `createSmartFillPlan`, `confirmAndEnqueue` per `contracts/native-modules.md`; `confirmAndEnqueue` validates the legal text server-side (not trusting the RN caller) and fails fast on `NO_LIBRARY_SELECTED`/`LIBRARY_ACCESS_INVALID`/`INSUFFICIENT_SPACE` before enqueueing (FR-004)
- [x] T024 [US1] `confirmAndEnqueue` creates `TransferItemEntity` rows (`kind: download`, `legalReceiptId` set) and starts the corresponding `TransferWorker` via WorkManager (depends on T008/T010)
- [x] T025 [P] [US1] Wire `EssentialsModule` into `OplForgePackage.kt`
- [x] T026 [P] [US1] `mobile/src/native/EssentialsModule.ts` — typed wrapper over `NativeEssentialsModule`
- [x] T027 [P] [US1] `mobile/src/stores/essentials-store.ts` — Zustand store: catalog list, search/filter state, Smart Fill plan
- [x] T028 [US1] `mobile/src/screens/Essentials/EssentialsScreen.tsx` — searchable/filterable list, per-item legal confirmation dialog before triggering `confirmAndEnqueue`, Smart Fill entry point
- [x] T029 [US1] `mobile/src/screens/Essentials/SmartFillSheet.tsx` — byte-budget input, plan preview (selected items, remaining space), confirms through the same per-item legal gate as a direct download (FR-003)
- [x] T030 [US1] Wire the Essentials screen into navigation (`mobile/src/navigation/RootNavigator.tsx` or a stack push from the Library/Settings tab, per `plan.md`'s deferred design note)

**Checkpoint**: User Story 1 is fully functional and independently testable — `quickstart.md` Scenarios 1-4 pass live on-device.

---

## Phase 4: User Story 2 - Adicionar Jogos por Importação Local (Priority: P1)

**Goal**: Import a local file into the library via the system file picker, safely, with duplicate detection and oversized-file splitting.

**Independent Test**: Pick a local `.iso`, import, recatalog, see it in the Library tab; repeat with the same file and see a duplicate warning instead of a silent second copy.

### Tests for User Story 2

- [ ] T031 [P] [US2] Unit tests for the USBExtreme part-file layout in `mobile/android/app/src/test/java/com/oplforge/mobile/transfer/UsbExtremeCodecTest.kt` (port of desktop's `codec.service.ts` tests, adapted for SAF part-file bookkeeping per `research.md` R7)
- [ ] T032 [P] [US2] Instrumented test: importing a local SAF file produces byte-identical content at the destination, in `mobile/android/app/src/androidTest/java/com/oplforge/mobile/transfer/ImportInstrumentedTest.kt`
- [ ] T033 [P] [US2] Instrumented test: importing the same content twice surfaces `DUPLICATE_ITEM` instead of duplicating, same file as T032
- [ ] T034 [P] [US2] Jest test for the local-import entry point (file picker trigger, duplicate warning, destination-type override) in `mobile/__tests__/src/screens/Import.test.tsx`

### Implementation for User Story 2

- [ ] T035 [P] [US2] `UsbExtremeCodec.kt` (`mobile/android/app/src/main/java/com/oplforge/mobile/transfer/`) — pure-Kotlin port of desktop's multi-part layout logic (`research.md` R7)
- [ ] T036 [US2] Extend `TransferWorker.kt` (T008) to invoke `UsbExtremeCodec` when the source size exceeds the destination filesystem's limit, populating `TransferItem.partFiles`
- [x] T037 [US2] Duplicate detection in `TransferQueueModule.kt` (or a small `DuplicateDetector.kt` helper) — checks the active `CatalogSnapshot` (spec 006) for an existing entry with matching content before enqueueing an import
- [x] T038 [US2] `enqueueImport(sourceUri, destinationHint)` on `TransferQueueModule.kt` per `contracts/native-modules.md` — resolves content type (reusing spec 006's naming/type detection where possible), fails fast on `NO_LIBRARY_SELECTED`/`LIBRARY_ACCESS_INVALID`/`DUPLICATE_ITEM`
- [x] T039 [US2] `mobile/src/screens/Library/ImportGameButton.tsx` (or equivalent entry point in the existing Library screen) — triggers the RN system document picker, calls `TransferModule.enqueueImport`
- [x] T040 [US2] Duplicate-warning UI surfaced from `DUPLICATE_ITEM` (a confirmation dialog, not a silent block) in the same component as T039

**Checkpoint**: User Stories 1 AND 2 both work independently — `quickstart.md` Scenarios 5-6 pass live on-device.

---

## Phase 5: User Story 3 - Diagnóstico da Biblioteca (Priority: P2)

**Goal**: A dedicated Diagnostics report — mandatory-folder check, free space, four-state readiness classification — reusing spec 006's catalog scan rather than duplicating it.

**Independent Test**: Run Diagnostics against a library missing a mandatory folder, see it called out explicitly with the correct readiness state.

### Tests for User Story 3

- [x] T041 [P] [US3] Unit tests for the four-state readiness classifier in `mobile/android/app/src/test/java/com/oplforge/mobile/diagnostics/ReadinessClassifierTest.kt` (port of desktop's `readiness-classifier.ts` test cases, per `research.md` R8 — asserts all four states, not a simplified three)
- [ ] T042 [P] [US3] Instrumented test: a library missing `ART`/`CFG`/`VMC` reports exactly those as missing, in `mobile/android/app/src/androidTest/java/com/oplforge/mobile/diagnostics/DiagnosticsInstrumentedTest.kt`
- [ ] T043 [P] [US3] Jest test for the Diagnostics screen (missing-folder list, readiness badge, re-run after fix) in `mobile/__tests__/src/screens/Diagnostics.test.tsx`

### Implementation for User Story 3

- [x] T044 [P] [US3] `ReadinessClassifier.kt` (`mobile/android/app/src/main/java/com/oplforge/mobile/diagnostics/`) — port of desktop's `readiness-classifier.ts`, four states (`research.md` R8)
- [x] T045 [US3] `DiagnosticsModule.kt` TurboModule — `runDiagnostics()` (7-folder check + free space + reuse of spec 006's `CatalogIndexStore.getLatestCompleted()`, triggering a fresh scan only if none exists) and `getLatestDiagnosticsReport()`, per `contracts/native-modules.md`
- [x] T046 [P] [US3] Add `DiagnosticsReportEntity`/DAO to Room (extends T006's migration) for report history
- [x] T047 [P] [US3] Wire `DiagnosticsModule` into `OplForgePackage.kt`
- [x] T048 [P] [US3] `mobile/src/native/DiagnosticsModule.ts` — typed wrapper
- [x] T049 [US3] `mobile/src/screens/Diagnostics/DiagnosticsScreen.tsx` — missing-folder list, free space, four-state readiness badge (grouping `requires-reorganization`/`incompatible` visually if that reads better, per `data-model.md`, without changing the underlying classification)
- [x] T050 [US3] Surface `getLatestDiagnosticsReport()` on the Home screen (spec 006 US5, `mobile/src/screens/Home/HomeScreen.tsx`) as an optional at-a-glance readiness indicator

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — `quickstart.md` Scenario 9 passes live on-device.

---

## Phase 6: User Story 4 - Fila de Transferências Durável (Priority: P2)

**Goal**: A visible, controllable queue proving the durability/safety guarantees built in Phase 2 (Foundational) — this phase is about the user-facing surface and its dedicated tests, since the underlying mechanism (T006-T010) already exists by this point.

**Independent Test**: Start a transfer, force-stop the app, reopen, confirm the item persisted and is resumable/retryable; start two transfers to the same destination and confirm they never write concurrently.

### Tests for User Story 4

- [ ] T051 [P] [US4] WorkManager durability integration test — a queued item survives a simulated process restart (`TestListenableWorkerBuilder`/`WorkManagerTestInitHelper`), in `mobile/android/app/src/androidTest/java/com/oplforge/mobile/transfer/TransferDurabilityTest.kt`
- [ ] T052 [P] [US4] Instrumented test — two transfers targeting the same destination path never write concurrently (asserts via `WriteLock` conflict signal), same file as T051 or a sibling `ConcurrentWriteTest.kt`
- [ ] T053 [P] [US4] Instrumented test — a transfer write and a concurrent spec-006 SMB read of the same file never corrupt data (integration across both features, per FR-013)
- [ ] T054 [P] [US4] Jest test for the Transfers screen (queue list, per-item progress, retry/cancel, failed-state display) in `mobile/__tests__/src/screens/Transfers.test.tsx`

### Implementation for User Story 4

- [x] T055 [US4] `mobile/src/screens/Transfers/TransfersScreen.tsx` — queue list with per-item progress, state badge, retry/cancel actions calling `TransferModule.cancel()`/`retry()`
- [x] T056 [US4] Wire the Transfers screen into navigation, reachable from both the Essentials (US1) and Import (US2) flows after enqueueing
- [ ] T057 [US4] Persistent notification (or in-app badge) surfacing active-transfer count, consistent with spec 006's Foreground Service notification pattern for discoverability while backgrounded
- [x] T058 [US4] Verify (and fix if needed) that `TransferWorker`'s WorkManager constraints (`setRequiresStorageNotLow`) are configured so the OS itself won't silently starve transfers under low storage, surfacing that as a clear `state: failed` reason instead

**Checkpoint**: All four user stories are independently functional — `quickstart.md` Scenarios 7-8 pass live on-device.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening that spans multiple user stories.

- [ ] T059 [P] Run all `quickstart.md` scenarios (1-10) end-to-end and record results
- [ ] T060 [P] Security review: confirm the legal confirmation text (R4) can't be bypassed by a compromised/buggy RN layer (server-side validation in Kotlin, not just UI gating) — re-verify T023's design holds
- [ ] T061 [P] Touch-target/accessibility pass across the three new screens (Essentials, Diagnostics, Transfers), consistent with spec 006's Library screen fix
- [ ] T062 Performance validation: catalog fetch/HEAD-check latency, transfer throughput, and memory ceiling during large-file transfer (never buffering a full file — same discipline as spec 006 FR-026/SC-008)
- [ ] T063 [P] Update `mobile/README.md` with what shipped from this spec vs. any deferred items, following specs 006/007's documentation precedent
- [ ] T064 Confirm the Component Manager exclusion (FR-014) is not accidentally reintroduced anywhere in the new screens/navigation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the transfer executor, Room schema, and shared `WriteLock` are load-bearing for US1/US2/US4; US3 doesn't need them but still depends on Setup).
- **User Stories (Phase 3-6)**: All depend on Foundational completion.
  - US1 and US2 are both P1; US1 SHOULD be implemented first since US2 reuses `TransferWorker`/`TransferQueueModule` exactly as US1 exercises them first (plan.md Structure Decision), but US2 has no _functional_ dependency on US1's own screens/store.
  - US3 has no dependency on US1/US2/US4 — it only needs spec 006's `CatalogIndexStore`, already in place. Can be built in parallel with US1/US2.
  - US4's _mechanism_ (T006-T010) is built in Foundational; US4's _phase_ here is its user-facing surface plus the tests that prove the durability/safety guarantees — it can be built in parallel with US1/US2's screens once Foundational is done, but its tests are most meaningful once US1/US2 exist to generate real queue traffic.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- Tests before implementation (write first, confirm they fail, per Constitution Principle V).
- Kotlin domain logic (pure, unit-tested) before the TurboModule that wraps it.
- TurboModule before its `mobile/src/native/*.ts` wrapper.
- Wrapper before the Zustand store.
- Store before the screen that consumes it.

### Parallel Opportunities

- T001-T005 (Setup) are independent, all [P].
- T014-T018 (US1 tests) are independent, all [P] — write together before T019+.
- T019, T021, T022 (US1 Kotlin domain logic) are independent, all [P].
- T031-T034 (US2 tests) are independent, all [P].
- T041-T043 (US3 tests) are independent, all [P].
- T051-T054 (US4 tests) are independent, all [P].
- US3's entire phase can run in parallel with US1/US2's phases (no shared files, no dependency).

---

## Parallel Example: User Story 1

```bash
# Tests together first:
Task: "Unit tests for IA metadata JSON parsing in EssentialsCatalogClientTest.kt"
Task: "Unit tests for game scoring/sorting in GameScoringTest.kt"
Task: "Unit tests for Smart Fill in SmartFillPlannerTest.kt"
Task: "Unit test for legal-confirmation rejection in EssentialsModuleTest.kt"
Task: "Jest test for the Essentials screen"

# Then Kotlin domain logic together:
Task: "EssentialsCatalogClient.kt — IA metadata fetch + classification"
Task: "GameScoring.kt — port of scoreArchiveFile/sortCatalogGames"
Task: "SmartFillPlanner.kt — port of createSmartFillPlan"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — the transfer executor US1 depends on).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: `quickstart.md` Scenarios 1-4 on a real device.
5. This alone delivers the single most differentiating capability (spec.md's own framing) — a portable, no-PC library builder.

### Incremental Delivery

1. Setup + Foundational → transfer executor proven with a synthetic item (Phase 2 checkpoint).
2. US1 (Essentials) → validate → this is the MVP.
3. US2 (local import) → validate → both P1 stories done.
4. US3 (Diagnostics) → validate → can slot in anywhere after Foundational, including in parallel with US1/US2.
5. US4 (queue UI/durability tests) → validate → completes the full spec.
6. Polish.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Every Kotlin file touching native/CMake-adjacent Gradle tasks needs `dangerouslyDisableSandbox: true` in this environment (specs 006/007 precedent) — not a new constraint, just re-flagging since this spec adds new Gradle dependencies (T001/T002).
- The Component Manager (desktop mockup, no real backend) stays explicitly out of scope (FR-014, T064) — do not add it while implementing adjacent Settings/Tools UI.
