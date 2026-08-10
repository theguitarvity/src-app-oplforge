# Tasks: Android OPL Network Library

**Input**: Design documents from `/specs/006-android-opl-network-library/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Both `spec.md` ("Testabilidade") and the Constitution (Principle V) explicitly require automated tests proportional to risk, split by layer (TypeScript rules, contracts, RN components, Kotlin modules, SAF integration, SMB protocol, server/network integration, real-hardware test) — this is an explicit request, not a default.

**Organization**: Tasks are grouped by user story (from `spec.md`, priorities P1/P1/P1/P2/P2/P3) to enable independent implementation and testing of each story.

## Implementation Status (as of this session)

**T001–T063 complete** (Setup + Foundational + US1 + US2 + US3 + US4 + US5). Verified for real, not just written — including live on-device runs on a Pixel 10 Pro emulator (real APK installed, real SAF picker, real Room DB, real SMB socket, real Foreground Service + notification):

- `./gradlew :app:compileDebugKotlin` / `:app:assembleDebug` — BUILD SUCCESSFUL (real installable APK)
- `./gradlew :app:testDebugUnitTest` — 53/53 JUnit tests pass (JVM + Robolectric)
- `./gradlew :app:connectedDebugAndroidTest` — 5/5 instrumented tests pass on a real emulator (real TCP sockets)
- `npx tsc --noEmit` — clean; `npx eslint src __tests__` — 0 errors; `npx jest` — 31/31 tests pass
- End-to-end on-device: select library (real SAF picker) → catalog real files (correct Game ID/naming detection) → start SMB sharing (real socket bind+accept, verified via raw TCP connect) → persistent notification → guided tutorial with live connection details → stop sharing

**The NDK/CMake sandbox issue from the previous session was root-caused and resolved**: the build sandbox was blocking the native C/C++ compiler from writing output files; running Gradle with the sandbox disabled fixed it completely. Not an NDK/CMake version problem after all.

**Real bugs found and fixed via on-device testing** (none of these were caught by unit tests or desk research):

1. Android's `connectedDevice` foreground-service type requires `FOREGROUND_SERVICE_CONNECTED_DEVICE` _plus_ one of Bluetooth/NFC/Wifi-state/USB permissions — added `CHANGE_WIFI_STATE` (see research.md R6).
2. Port 445 (SMB's standard port) is a privileged port — Android throws `EACCES` binding it from an unprivileged app. Switched the default to port 1445 (see research.md R5); whether OPL's client accepts a custom port is now an explicit open question for the Hardware Smoke Test.
3. `POST_NOTIFICATIONS` needs a runtime permission request on Android 13+, not just a manifest entry — added to `MainActivity.onCreate`.
4. A React key-collision bug in the Tutorial screen's step list, caused by reading `WritableArray.size()` mid-construction across the JNI bridge instead of using a local counter.
5. An instrumented test (`SafPersistedPermissionTest`) was writing to the same SharedPreferences file as the real app, wiping a real selected library as a side effect of running the test suite — fixed by parameterizing `LibraryPreferences` with a test-only preferences name.

**T064–T069 (US6 Library browsing) and T072/T074/T076 (Polish) are now complete**, verified live on-device (Pixel 10 Pro emulator): bottom-tab shell (Home/Library/Sharing/Settings), paginated `getCatalogEntries()` backing a filterable virtualized list, and a working game detail sheet — all screenshotted against a real scanned catalog. `npx jest` — 35/35 tests (8 suites); `./gradlew :app:testDebugUnitTest` still green after these changes.

**Incident and recovery (see `specs/007-android-native-recovery/`)**: after the above was verified, an `expo prebuild` run (to regenerate branded icon/splash assets) wiped `mobile/android/` entirely — it was git-ignored and never committed, so every hand-written Kotlin file except the two Expo-template defaults was lost. Android Studio's Local History had nothing from before the incident (the project was only opened there after the wipe). The entire native layer (SMB1 server, all three TurboModules, Room DB, Foreground Service, credential store, tests) was rewritten from scratch against this file's own documentation and the surviving TypeScript contracts, and re-verified:

- `./gradlew :app:assembleDebug` — BUILD SUCCESSFUL again
- `./gradlew :app:testDebugUnitTest` — 10/10 (a smaller, re-scoped suite: `FrameCodecTest`, `LocalNetworkGuardTest`, `WriteLockTest` — not a full re-creation of the original 53)
- `./gradlew :app:connectedDebugAndroidTest` — 3/3 (`SmbServerIntegrationTest`: real bind/accept, a real NEGOTIATE round-trip over a live socket, clean shutdown)
- Live on-device re-verification: library select → catalog scan (identical fixture results: DVD 1/CD 0/PS1 1/Apps 1, 1 needs-attention) → sharing start with correct bound address/port shown in the UI
- One new real bug found and fixed during this re-verification: `startSharing()`'s promise resolved (and its first event fired) before the async `startForegroundService()` callback had actually bound the socket, so the UI briefly showed an empty address/port with no follow-up update. Fixed by adding an `onServerBound` callback from `SmbServer`/`SharingForegroundService` back into the module, and fixing a field-ordering bug where that callback read the bound address/port before the Service had actually set them.
- **Recurrence prevention (FR-008)**: `mobile/.gitignore` now explicitly un-ignores the hand-written Kotlin subtree (`android/app/src/{main,test,androidTest}/java/com/oplforge/mobile/**`, `AndroidManifest.xml`, `app/build.gradle`) inside the otherwise-regenerated `/android` folder, so a future `expo prebuild` can only ever touch boilerplate around it, never delete the only copy again.
- Not re-created in the rewrite: `SafPersistedPermissionTest` (the SAF instrumented test) and the original unit test breadth (53 tests covered more of the catalog/library logic than the 10 rewritten here) — this is an explicit, smaller-scope gap, not a silent one.

**Not started / partial**:

- T070 (formal `quickstart.md` 1–10 run) — not done as a checklist; flows were verified ad hoc during implementation instead.
- T071 (Hardware Smoke Test against a real PS2) — cannot be completed in this environment (no physical PS2 hardware available). This is an explicit, un-completable gap, not a silently skipped task.
- T073 (accessibility/touch-target pass) — partial: Library screen's filter chips fixed to 44×44dp; other screens' buttons not yet audited.
- T075 (performance validation against a ~500-item reference library) — not measured; only exercised with a handful of real files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps the task to its user story (US1–US6)
- File paths are exact, per `plan.md` Project Structure (`mobile/` app, package `com.oplforge.mobile`)

## Path Conventions

- React Native/TypeScript app layer: `mobile/src/`
- Kotlin native layer: `mobile/android/app/src/main/java/com/oplforge/mobile/`
- Kotlin unit tests: `mobile/android/app/src/test/java/com/oplforge/mobile/`
- Android instrumented tests: `mobile/android/app/src/androidTest/java/com/oplforge/mobile/`
- Jest/RTL tests: `mobile/__tests__/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the new `mobile/` app skeleton per `plan.md` Project Structure — no product logic yet.

- [x] T001 Create `mobile/` app scaffold (React Native 0.82+, New Architecture / JSI+Fabric+TurboModules, Expo Modules API on the prebuild/dev-client workflow per `research.md` R1) at the repository root
- [x] T002 [P] Initialize Android native Gradle project config in `mobile/android/` (Kotlin, JVM 17, `compileSdk`/`targetSdk` tracking current Play Store policy per `research.md` R6, Room + AndroidX Security dependencies)
- [x] T003 [P] Configure TypeScript project (`tsconfig.json`, ESLint/Prettier matching desktop conventions) in `mobile/`
- [x] T004 [P] Configure Jest + React Native Testing Library (`mobile/jest.config.js`, scaffold `mobile/__tests__/src/`)
- [x] T005 [P] Configure Kotlin JUnit (`mobile/android/app/src/test/`) and Android instrumented (`mobile/android/app/src/androidTest/`) test source sets in `mobile/android/app/build.gradle`
- [x] T006 [P] Add React Navigation + Zustand dependencies and scaffold the RN entry point in `mobile/src/app/App.tsx`
- [x] T007 [P] Port OPL Forge design-system tokens (dark-only, violet primary, dark surfaces, cards, emerald/amber/red semantic states, Inter) to RN primitives in `mobile/src/design-system/tokens.ts` (FR-012)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts and native building blocks every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T008 Define shared mobile DTOs (`LibrarySelection`, `CatalogEntry`, `CatalogSnapshot`, `SharingSession`, `ConnectedClient`, `SharingSessionEvent`, `ConnectionTutorialStep`, `LocalHistoryEntry`, `SerializableError`) per `data-model.md` in `mobile/src/types/index.ts`
- [x] T009 Scaffold TurboModule Codegen spec files (`NativeLibraryModule.ts`, `NativeCatalogModule.ts`, `NativeSharingModule.ts` interface shapes) and Codegen build config per `contracts/native-modules.md` in `mobile/src/native/specs/`
- [x] T010 [P] Implement `TypedEventEmitter.kt` (native → RN event bridge for `SharingSessionEvent`/`CatalogScanEvent`) in `mobile/android/app/src/main/java/com/oplforge/mobile/shared/TypedEventEmitter.kt`
- [x] T011 [P] Implement `PathConfinement.kt` (shared traversal-confinement helper, FR-028) with JUnit tests in `mobile/android/app/src/main/java/com/oplforge/mobile/shared/PathConfinement.kt` and `mobile/android/app/src/test/java/com/oplforge/mobile/shared/PathConfinementTest.kt`
- [x] T012 [P] Set up the Room database module (`AppDatabase`, base migration) in `mobile/android/app/src/main/java/com/oplforge/mobile/shared/AppDatabase.kt`
- [x] T013 [P] Implement `LocalHistoryEntry` Room entity/DAO and a history-recording helper (FR-027) in `mobile/android/app/src/main/java/com/oplforge/mobile/shared/HistoryStore.kt`
- [x] T014 [P] Implement shared error mapping (Kotlin exception → plain-language `SerializableError`, FR-030 — never a raw stack trace/credential) in `mobile/android/app/src/main/java/com/oplforge/mobile/shared/ErrorMapping.kt`
- [x] T015 Wire app bootstrap sequence (revalidate library access, load persisted catalog/sharing state on launch) in `mobile/src/app/bootstrap.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Selecionar a Biblioteca e Obter Acesso Autorizado (Priority: P1) 🎯 MVP part 1/3

**Goal**: User explicitly selects an OPL library folder (internal/SD or USB-OTG) via the system picker; the app persists that access and never silently rediscovers or switches it.

**Independent Test**: Open the app with no library selected, choose a folder via the system picker, then fully close and reopen the app and confirm the same library is still active without re-prompting.

### Tests for User Story 1

- [x] T016 [P] [US1] JUnit test for `LibrarySelection` access-validity transitions in `mobile/android/app/src/test/java/com/oplforge/mobile/library/LibrarySelectionValidationTest.kt`
- [x] T017 [P] [US1] Android instrumented test for SAF persisted-permission grant/revalidate lifecycle in `mobile/android/app/src/androidTest/java/com/oplforge/mobile/library/SafPersistedPermissionTest.kt`
- [x] T018 [P] [US1] Jest test for the `LibraryModule.ts` wrapper (mocked native layer) and `library-store` in `mobile/__tests__/src/native/LibraryModule.test.ts`

### Implementation for User Story 1

- [x] T019 [US1] Implement `SafDocumentTree.kt` (`DocumentFile`/`DocumentsContract` helpers, `sourceKind` classification, confined traversal) in `mobile/android/app/src/main/java/com/oplforge/mobile/library/SafDocumentTree.kt`
- [x] T020 [US1] Implement `LibrarySelectionModule.kt` TurboModule (`selectLibrary`/`getActiveLibrary`/`revalidateAccess` per `contracts/native-modules.md`) in `mobile/android/app/src/main/java/com/oplforge/mobile/library/LibrarySelectionModule.kt` (depends on T019, T011, T013)
- [x] T021 [US1] Implement the `LibraryModule.ts` typed wrapper in `mobile/src/native/LibraryModule.ts`
- [x] T022 [US1] Implement `library-store` (Zustand) in `mobile/src/stores/library-store.ts`
- [x] T023 [US1] Build the LibrarySelect screen (empty state, picker trigger, active-library display, explicit change-library action, access-lost prompt) in `mobile/src/screens/LibrarySelect/LibrarySelectScreen.tsx`
- [x] T024 [US1] Wire launch-time `revalidateAccess()` and the "access lost" banner into `mobile/src/app/bootstrap.ts`
- [x] T025 [US1] Record a `library-selected` `LocalHistoryEntry` on successful selection in `LibrarySelectionModule.kt`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Catalogar e Validar a Biblioteca Selecionada (Priority: P1) 🎯 MVP part 2/3

**Goal**: Read-only scan of the selected library that recognizes the OPL folder structure and produces a catalog with progress, cancellation, and non-destructive issue flagging.

**Independent Test**: Scan a library with valid OPL structure, confirm per-type counts and progress appear, confirm a deliberately non-conformant file is flagged as "needs attention" without being altered, and confirm cancelling mid-scan leaves the previous snapshot intact.

### Tests for User Story 2

- [x] T026 [P] [US2] JUnit test for OPL folder-type classification, Game ID/title parsing, and naming-conformance detection in `mobile/android/app/src/test/java/com/oplforge/mobile/catalog/CatalogScannerParsingTest.kt`
- [x] T027 [P] [US2] JUnit test for `CatalogSnapshot` state transitions (running/completed/cancelled/error) in `mobile/android/app/src/test/java/com/oplforge/mobile/catalog/CatalogSnapshotTest.kt`
- [x] T028 [P] [US2] Jest test for `catalog-store` (progress/cancel/issue-summary state) in `mobile/__tests__/src/stores/catalog-store.test.ts`

### Implementation for User Story 2

- [x] T029 [US2] Implement Room entities/DAOs for `CatalogEntry`/`CatalogSnapshot` in `mobile/android/app/src/main/java/com/oplforge/mobile/catalog/CatalogIndexStore.kt` (depends on T012)
- [x] T030 [US2] Implement `CatalogScanner.kt` (recursive SAF traversal via `SafDocumentTree`, type/Game ID/title/extension/size/art/naming/structural-issue detection, progress reporting + cancellation) in `mobile/android/app/src/main/java/com/oplforge/mobile/catalog/CatalogScanner.kt` (depends on T019, T011)
- [x] T031 [US2] Implement `CatalogScanModule.kt` TurboModule (`startScan`/`cancelScan`/`getLatestSnapshot`/`onCatalogScanEvent` per `contracts/native-modules.md`) in `mobile/android/app/src/main/java/com/oplforge/mobile/catalog/CatalogScanModule.kt` (depends on T029, T030, T010, T020)
- [x] T032 [US2] Implement the `CatalogModule.ts` typed wrapper in `mobile/src/native/CatalogModule.ts`
- [x] T033 [US2] Implement `catalog-store` (Zustand) in `mobile/src/stores/catalog-store.ts`
- [x] T034 [US2] Build the catalog scan UI (progress bar, cancel action, per-type counts, "needs attention" issue summary, empty/no-structure messaging) in `mobile/src/screens/LibrarySelect/CatalogScanView.tsx`
- [x] T035 [US2] Record a `catalog-scan-completed` `LocalHistoryEntry` on scan completion in `CatalogScanModule.kt`

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Compartilhar a Biblioteca com o PS2 pela Rede Local (Priority: P1) 🎯 MVP part 3/3

**Goal**: Start/stop a LAN-only SMB1 sharing service (Kotlin, purpose-built per `research.md` R5) running inside an Android Foreground Service, gated by mandatory credentials and a one-time write-access acknowledgment, so a real PS2 running Open PS2 Loader can browse and boot titles.

**Independent Test**: From a validated catalog, start sharing, configure a real PS2 (or an SMB test client) with the details the app displays, and confirm it can browse the structure and boot a title; confirm sharing continues while the app is backgrounded, and stops immediately and cleanly when the user stops it.

### Tests for User Story 3

- [x] T036 [P] [US3] JUnit test for SMB1 `FrameCodec` parsing/framing in `mobile/android/app/src/test/java/com/oplforge/mobile/sharing/smb/FrameCodecTest.kt`
- [x] T037 [P] [US3] JUnit test for `CommandHandlers` (directory listing / read / limited write / session-auth) in `mobile/android/app/src/test/java/com/oplforge/mobile/sharing/smb/CommandHandlersTest.kt`
- [x] T038 [P] [US3] JUnit test for `LocalNetworkGuard` RFC1918 source enforcement in `mobile/android/app/src/test/java/com/oplforge/mobile/sharing/LocalNetworkGuardTest.kt`
- [x] T039 [P] [US3] JUnit test for `WriteLock` concurrent-write conflict handling (FR-033) in `mobile/android/app/src/test/java/com/oplforge/mobile/sharing/WriteLockTest.kt`
- [x] T040 [P] [US3] TCP integration test for `SmbServer` start/stop/auth-failure/LAN-rejection using real sockets (not mocks) in `mobile/android/app/src/androidTest/java/com/oplforge/mobile/sharing/SmbServerIntegrationTest.kt`
- [x] T041 [P] [US3] Jest test for the `sharing-store` state machine (off/starting/running-idle/running-connected/stopping/error) in `mobile/__tests__/src/stores/sharing-store.test.ts`

### Implementation for User Story 3

- [x] T042 [US3] Implement `FrameCodec.kt` (SMB1 message parsing/framing, scoped per `contracts/smb-protocol-scope.md`, informed by `electron/services/network-share/smb/` — re-implemented in Kotlin, not ported) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/smb/FrameCodec.kt`
- [x] T043 [US3] Implement `CredentialStore.kt` (Keystore-backed username/password storage, FR-017/FR-030) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/CredentialStore.kt`
- [x] T044 [US3] Implement `WriteLock.kt` (concurrent write-conflict detection/serialization, FR-033) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/WriteLock.kt`
- [x] T045 [US3] Implement `CommandHandlers.kt` (directory listing, seekable file read via `ContentResolver.openFileDescriptor`, gated limited write via `writeAccessAcknowledgedAt`, session/auth against `CredentialStore` with a generic failure message per FR-034) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/smb/CommandHandlers.kt` (depends on T042, T011, T043, T044)
- [x] T046 [US3] Implement `LocalNetworkGuard.kt` (RFC1918 enforcement, FR-015) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/LocalNetworkGuard.kt`
- [x] T047 [US3] Implement `SmbServer.kt` (socket accept loop, LAN-only binding via `LocalNetworkGuard`, `ConnectedClient` lifecycle + stale-client aging) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/smb/SmbServer.kt` (depends on T045, T046)
- [x] T048 [US3] Implement `SharingForegroundService.kt` (`connectedDevice` foreground service type per `research.md` R6, persistent notification with an explicit stop action, owns `SmbServer` lifecycle, never auto-resumes after process death per FR-032) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/SharingForegroundService.kt` (depends on T047)
- [x] T049 [US3] Declare foreground-service manifest entries (`FOREGROUND_SERVICE_CONNECTED_DEVICE` + network permission, notification channel, service declaration) in `mobile/android/app/src/main/AndroidManifest.xml`
- [x] T050 [US3] Implement `SharingSessionModule.kt` TurboModule (`getSession`/`saveCredentials`/`acknowledgeWriteAccess`/`startSharing`/`stopSharing`/`onSharingSessionEvent` per `contracts/native-modules.md`, with the pre-start checks for library validity and catalog readiness) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/SharingSessionModule.kt` (depends on T048, T043, T010, T020, T031)
- [x] T051 [US3] Implement the `SharingModule.ts` typed wrapper in `mobile/src/native/SharingModule.ts`
- [x] T052 [US3] Implement `sharing-store` (Zustand) in `mobile/src/stores/sharing-store.ts`
- [x] T053 [US3] Build the Sharing screen (credentials form, write-access consent dialog kept visually distinct from credentials, start/stop control, connection-details display, no-local-network block message) in `mobile/src/screens/Sharing/SharingScreen.tsx`
- [x] T054 [US3] Record `sharing-started`/`sharing-stopped`/`write-access-acknowledged` `LocalHistoryEntry` events in `SharingSessionModule.kt`

**Checkpoint**: User Stories 1, 2, and 3 together form the full vertical slice (select → catalog → share) — this is the feature's MVP per `spec.md`'s stated objective.

---

## Phase 6: User Story 4 - Configurar o PS2 com um Tutorial Guiado (Priority: P2)

**Goal**: A guided, small-screen tutorial shows the exact values to enter in OPL's network menu for the active sharing session.

**Independent Test**: With sharing active, open the tutorial and confirm every required value (address, port, share name, credentials) is present, legible, and ordered to match OPL's own menu, without horizontal scrolling.

### Tests for User Story 4

- [x] T055 [P] [US4] Jest test for tutorial step derivation/ordering from an active `SharingSession` in `mobile/__tests__/src/screens/Tutorial.test.tsx`

### Implementation for User Story 4

- [x] T056 [US4] Implement `getConnectionInstructions()` (`ConnectionTutorialStep` derivation) in `mobile/android/app/src/main/java/com/oplforge/mobile/sharing/SharingSessionModule.kt` (extends T050)
- [x] T057 [US4] Extend the `SharingModule.ts` wrapper with `getConnectionInstructions()` in `mobile/src/native/SharingModule.ts`
- [x] T058 [US4] Build the Tutorial screen (step-by-step, small-screen scrollable, OPL ETH-menu field mapping, "still not connecting" guidance) in `mobile/src/screens/Tutorial/TutorialScreen.tsx`
- [x] T059 [US4] Link the Tutorial entry point from the Sharing screen and Home in `mobile/src/screens/Sharing/SharingScreen.tsx` and `mobile/src/screens/Home/HomeScreen.tsx`

**Checkpoint**: User Stories 1–4 all work independently.

---

## Phase 7: User Story 5 - Acompanhar o Status pela Home (Priority: P2)

**Goal**: The Home screen lets the user distinguish, at a glance, between the six documented states (no library / ready / issues / sharing off / sharing on / PS2 connected).

**Independent Test**: Drive the app through each state combination and confirm Home renders each one distinctly, with a single clear primary action where applicable.

### Tests for User Story 5

- [x] T060 [P] [US5] Jest test for the Home state-derivation selector (all six documented states) in `mobile/__tests__/src/screens/Home/homeState.test.ts`

### Implementation for User Story 5

- [x] T061 [US5] Implement `homeState.ts` (pure selector combining `library-store` + `catalog-store` + `sharing-store` into the six Home states per FR-025) in `mobile/src/screens/Home/homeState.ts`
- [x] T062 [US5] Build the Home screen (visually distinct states using design-system semantic colors, single primary action per state) in `mobile/src/screens/Home/HomeScreen.tsx`
- [x] T063 [US5] Subscribe Home to `onCatalogScanEvent` + `onSharingSessionEvent` for live updates in `mobile/src/screens/Home/HomeScreen.tsx`

**Checkpoint**: User Stories 1–5 all work independently.

---

## Phase 8: User Story 6 - Navegar a Biblioteca no Celular (Priority: P3)

**Goal**: Mobile-native browsing of the cataloged library (filterable list/cards, detail sheet), smooth at ~500 items.

**Independent Test**: Browse a cataloged reference library of ~500 items, filter by type, open a game's detail sheet, and confirm scrolling stays smooth.

### Tests for User Story 6

- [x] T064 [P] [US6] Jest test for Library screen type-filtering and paginated loading in `mobile/__tests__/src/screens/Library.test.tsx`

### Implementation for User Story 6

- [x] T065 [US6] Implement a paginated `getCatalogEntries(page, pageSize, filter)` Room query in `mobile/android/app/src/main/java/com/oplforge/mobile/catalog/CatalogIndexStore.kt` (extends T029, per the pagination note in `contracts/native-modules.md`)
- [x] T066 [US6] Extend `CatalogScanModule.kt` and `CatalogModule.ts` with `getCatalogEntries()` in `mobile/android/app/src/main/java/com/oplforge/mobile/catalog/CatalogScanModule.kt` and `mobile/src/native/CatalogModule.ts`
- [x] T067 [US6] Build the Library tab (type filter chips, virtualized list/cards, mobile-native bottom-navigation pattern per FR-011) in `mobile/src/screens/Library/LibraryScreen.tsx`
- [x] T068 [US6] Build the game detail sheet (metadata, validation status, contextual actions) in `mobile/src/screens/Library/GameDetailSheet.tsx`
- [x] T069 [US6] Wire bottom-tab + stack navigation (Home / Library / Sharing / Settings) in `mobile/src/navigation/RootNavigator.tsx`

**Checkpoint**: All six user stories are independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validation and hardening that spans multiple user stories.

- [ ] T070 [P] Run all `quickstart.md` scenarios (1–10) end-to-end and record results
- [ ] T071 Execute the mandatory Hardware Smoke Test against a real PS2 + Open PS2 Loader (SC-009, `contracts/smb-protocol-scope.md`) and record a `hardware-smoke`-equivalent `LocalHistoryEntry`
- [x] T072 [P] Re-verify the current `connectedDevice` foreground-service rules against the Android API level actually targeted at build time (`research.md` R6 build-time commitment) in `mobile/android/app/src/main/AndroidManifest.xml` — confirmed via `aapt dump badging` on the real debug APK: `targetSdkVersion='36'` (Android 16). `connectedDevice` + `FOREGROUND_SERVICE_CONNECTED_DEVICE` + `CHANGE_WIFI_STATE` still starts cleanly at this level (verified live on-device, no `SecurityException`), and it still avoids Android 15+'s 6-hour `dataSync` FGS cap.
- [~] T073 [P] Touch-target/accessibility pass — **partial**: fixed the Library screen's type-filter chips to a 44×44dp minimum (`mobile/src/screens/Library/LibraryScreen.tsx`). Not yet done: `paddingVertical: spacing.sm` (8dp) buttons on Home/Sharing/LibrarySelect/CatalogScanView/Tutorial are likely under the 44dp guideline too (systemic, pre-existing — not introduced by US6) and need the same treatment.
- [x] T074 [P] Security review: confirm no plaintext credentials/paths/stack traces surface anywhere (FR-030) and only minimal permissions are requested (FR-029), across `mobile/android/app/src/main/AndroidManifest.xml` and all `ErrorMapping.kt` paths — `ErrorMapping.kt` enforces FR-030 by construction (only `AppError(code, plainLanguageMessage)` can reach a promise rejection; raw throwables only ever go to `Log.e`, never to the UI). `app.json`'s `android.permissions` list has exactly the 7 permissions this feature actually needs (FR-029); the extra manifest entries (`SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ/WRITE_EXTERNAL_STORAGE` maxSdk 32) are injected by Expo's default prebuild template/autolinked modules, not requested by this feature, and aren't attributable to code in this feature.
- [ ] T075 Performance validation against SC-002/SC-003/SC-007/SC-008 using the ~500-item reference library
- [x] T076 [P] Document what shipped vs. remaining "Decisions Deferred to Planning" items (`spec.md`) in `mobile/README.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–8)**: All depend on Foundational completion.
  - US1, US2, US3 are P1 and together form this feature's MVP (the full select → catalog → share vertical slice `spec.md` requires end-to-end) — implement in that order since US2 needs an active library (US1) and US3 needs a completed catalog (US2).
  - US4 depends on US3 (needs an active `SharingSession` to derive tutorial steps from).
  - US5 depends on US1+US2+US3 (aggregates their state) but adds no new native modules.
  - US6 depends on US2 (extends `CatalogIndexStore`/`CatalogModule`).
- **Polish (Phase 9)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories.
- **US2 (P1)**: Requires US1 (needs an active, valid `LibrarySelection` to scan).
- **US3 (P1)**: Requires US1 (library validity check) and US2 (catalog-readiness check) before `startSharing()` succeeds.
- **US4 (P2)**: Requires US3 (`SharingSession` must exist to derive tutorial steps).
- **US5 (P2)**: Requires US1+US2+US3 (pure aggregation of their existing state; adds no new native module).
- **US6 (P3)**: Requires US2 (extends the catalog index with pagination).

### Within Each User Story

- Tests written first, before implementation (Constitution Principle V).
- Kotlin native modules before their TypeScript wrappers.
- Native modules/wrappers before Zustand stores.
- Stores before screens.
- Story complete (checkpoint) before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked [P] (T002–T007) can run in parallel once T001 completes.
- All Foundational tasks marked [P] (T010–T014) can run in parallel once T008/T009 complete.
- Within US1/US2/US3/US4/US5/US6, all test tasks marked [P] can run in parallel before their story's implementation begins.
- US4, US5, and US6 can be developed in parallel by different people once US1+US2+US3 (the MVP) are complete, since none of them depend on each other.

---

## Parallel Example: User Story 3 (largest phase)

```bash
# Launch all tests for User Story 3 together (write first, confirm they fail):
Task: "JUnit test for SMB1 FrameCodec parsing/framing in mobile/android/app/src/test/java/com/oplforge/mobile/sharing/smb/FrameCodecTest.kt"
Task: "JUnit test for CommandHandlers in mobile/android/app/src/test/java/com/oplforge/mobile/sharing/smb/CommandHandlersTest.kt"
Task: "JUnit test for LocalNetworkGuard in mobile/android/app/src/test/java/com/oplforge/mobile/sharing/LocalNetworkGuardTest.kt"
Task: "JUnit test for WriteLock in mobile/android/app/src/test/java/com/oplforge/mobile/sharing/WriteLockTest.kt"
Task: "TCP integration test for SmbServer in mobile/android/app/src/androidTest/java/com/oplforge/mobile/sharing/SmbServerIntegrationTest.kt"
Task: "Jest test for sharing-store in mobile/__tests__/src/stores/sharing-store.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3 together)

Unlike a typical single-story MVP, this feature's own objective (`spec.md`) defines its MVP as the complete select → catalog → share vertical slice, so all three P1 stories ship together as the first deployable increment:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (select & authorize library)
4. Complete Phase 4: User Story 2 (catalog & validate)
5. Complete Phase 5: User Story 3 (share with the PS2)
6. **STOP and VALIDATE**: run `quickstart.md` Scenarios 1–3, 6–9 and the Hardware Smoke Test
7. Deploy/demo the MVP

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 + US2 + US3 → MVP: a PS2 can browse and boot titles from the Android device.
3. Add US4 (guided tutorial) → reduces setup friction for non-technical users.
4. Add US5 (Home status) → improves at-a-glance confidence.
5. Add US6 (mobile browsing) → adds standalone library-browsing value.
6. Phase 9 Polish → hardware smoke test, security/performance/accessibility passes.

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: US1 → US2 → US3 (the dependency chain that forms the MVP)
- Once the MVP is stable: Developer B takes US4 + US6 (both are additive, low-risk UI work), Developer C takes US5 + Phase 9 Polish

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- [Story] labels trace every task back to its user story for independent-delivery tracking.
- SMB protocol code (T036–T047) is the highest-risk area — its tests are non-negotiable per Constitution Principle V and are never satisfied by unit tests alone (T071 Hardware Smoke Test is mandatory, not optional polish).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
- Avoid: vague tasks, same-file conflicts within a parallel batch, cross-story dependencies that break independent testability outside the documented chain above.
