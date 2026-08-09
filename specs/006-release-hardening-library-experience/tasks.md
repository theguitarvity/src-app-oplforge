# Tasks: Release Hardening, OPL Connectivity and Library Experience

**Input**: Design documents from `/specs/006-release-hardening-library-experience/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Required by the feature specification. Within each story, create the listed regression/contract/integration tests first and confirm they fail for the reported gap before implementing behavior.

**Organization**: Tasks are grouped by user story so each journey can be implemented and validated as an independent increment. Physical hardware and signed-release checks remain explicit manual gates rather than being represented as automated success.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it changes different files and has no dependency on an unfinished task in the same phase.
- **[Story]**: Maps the task to one of the eight user stories in spec.md.
- Every task names the concrete file or directory it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the shared structure, fixtures and release inputs needed by later story slices.

- [X] T001 Add the Feature 006 test fixture directories and README contracts in `tests/fixtures/release/README.md`, `tests/fixtures/smb/README.md`, `tests/fixtures/art/README.md`, and `tests/fixtures/import/README.md`
- [X] T002 [P] Add the committed release identity manifest with initial public/internal mapping fields in `release-manifest.json`
- [X] T003 [P] Add platform identity source inventory and deterministic generation notes in `build/README.md`
- [X] T004 [P] Add reusable temporary local-folder/import fixture helpers in `tests/helpers/temp-local-library.ts`
- [X] T005 [P] Add sanitized SMB trace fixture conventions and prohibited-field assertions in `tests/helpers/smb-trace.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, validation, operation events and safe destination authorization before story-specific services use them.

**⚠️ CRITICAL**: Complete this phase before starting implementation tasks in any user story.

- [X] T006 Add shared Release Identity, Update Policy/Session, Local Art View, Library Health, Download Target, Import Job/Item, and unified Operation Summary/Event contracts in `src/types/opl.ts` and `src/types/opl-finalization.ts`
- [X] T007 Add strict Zod schemas for update, local-art, target-v2, import, folder-authorization, and operation commands in `electron/ipc/schemas.ts`
- [X] T008 [P] Add serializable error codes and redaction helpers for update, SMB, art, download, and import domains in `electron/services/errors/controlled-error.ts` and `electron/services/logger.ts`
- [X] T009 [P] Add revisioned/monotonic unified operation snapshot and event publisher primitives in `electron/services/operations/operation-event.publisher.ts`
- [X] T010 [P] Add opaque local-folder authorization storage and root identity revalidation in `electron/services/paths/local-folder-authorization.service.ts`
- [X] T011 Add validated folder authorization IPC to the trusted dialog flow in `electron/ipc/dialog.ipc.ts`, `electron/preload.ts`, and `src/services/api.ts`
- [X] T012 [P] Add contract tests rejecting unknown fields, arbitrary feed URLs/paths, invalid revisions, and unsafe byte/progress values in `tests/contract/feature-006-ipc-foundation.contract.test.ts`
- [X] T013 [P] Add schema-version migration fixtures for persisted download v1 and new v2 records in `tests/fixtures/downloads/schema-v1.json` and `tests/fixtures/downloads/schema-v2-local.json`
- [X] T014 Register shared operation event forwarding without exposing privileged values in `electron/main.ts`, `electron/preload.ts`, and `src/services/api.ts`

**Checkpoint**: Shared contracts and privilege boundaries are ready; story phases may now proceed according to the dependencies below.

---

## Phase 3: User Story 1 - Connect a Real PS2 over SMB (Priority: P1) 🎯 MVP

**Goal**: Make the existing SMB1 server compatible with a pinned real OPL client through negotiation, session, tree connection, listing, open, and 64-bit reads.

**Independent Test**: Start sharing, connect a physical PS2 with the documented profile, list games, open one image, sustain reads including an offset beyond 4 GiB, and observe no `0xc000006d` for the supported credentials.

### Tests for User Story 1

- [ ] T015 [P] [US1] Add a regression fixture/test proving the current share-level `SESSION_SETUP_ANDX` password mismatch and expected tree-connect authentication in `electron/services/network-share/auth-failure.test.ts`
- [ ] T016 [P] [US1] Add wire codec tests for `OPEN_ANDX`, `ECHO`, UID/TID validation, malformed length fields, and TRANS2 page bounds in `electron/services/network-share/smb/frame-codec.test.ts`
- [ ] T017 [P] [US1] Add sparse DVD9 boundary tests for READ/WRITE high+low offsets around `0xffffffff` in `electron/services/network-share/smb/smb-server.test.ts`
- [ ] T018 [P] [US1] Add an OPL handshake integration test from NBT/direct-host through listing and initial read in `tests/integration/smb-opl-handshake.test.ts`

### Implementation for User Story 1

- [ ] T019 [US1] Make NEGOTIATE and `SESSION_SETUP_ANDX` coherent with the share-level/OEM profile and allocate a nonzero UID in `electron/services/network-share/smb/command-handlers.ts`
- [ ] T020 [US1] Validate share name/password generically in `TREE_CONNECT_ANDX`, allocate TID, and keep guest/anonymous disabled by default in `electron/services/network-share/smb/command-handlers.ts`
- [ ] T021 [US1] Replace process-global fixed identifiers with connection-owned UID/TID/FID/SID allocation and inbound validation in `electron/services/network-share/smb/command-handlers.ts`
- [ ] T022 [P] [US1] Add `OPEN_ANDX`, `ECHO`, and required status/command constants in `electron/services/network-share/smb/protocol-constants.ts`
- [ ] T023 [US1] Implement OPL-compatible `OPEN_ANDX` and `ECHO` handlers with confined paths and handle cleanup in `electron/services/network-share/smb/command-handlers.ts`
- [ ] T024 [US1] Bound FIND_FIRST2/FIND_NEXT2 and query responses by SearchCount, MaxDataCount, and negotiated frame size in `electron/services/network-share/smb/command-handlers.ts`
- [ ] T025 [US1] Combine READ/WRITE high and low offsets safely, cap counts, and return correct EOF/status semantics in `electron/services/network-share/smb/command-handlers.ts`
- [ ] T026 [US1] Preserve both RFC1002 session request and direct-host traffic while closing all session resources on every disconnect/error path in `electron/services/network-share/smb/smb-server.ts`
- [ ] T027 [US1] Update the supported compatibility profile and setup instructions for the pinned OPL version in `electron/services/network-share/network-share.service.ts` and `src/components/network/NetworkShareSetupTutorial.tsx`
- [ ] T028 [US1] Run the automated US1 SMB suites and record the exact passing commands and remaining physical-hardware gate in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: The protocol implementation passes deterministic OPL fixtures; physical hardware validation remains the final independent test and is recorded in US8.

---

## Phase 4: User Story 2 - Receive a Coherent, Updatable Release (Priority: P1)

**Goal**: Deliver deterministic product identity, a coherent installed version, and an in-app N→N+1 update journey.

**Independent Test**: Install release N in clean Windows, verify every identity surface, publish eligible signed N+1, detect/download/apply it explicitly, and restart as N+1.

### Tests for User Story 2

- [ ] T029 [P] [US2] Add unit tests for public `1.A.B.C` parsing, bounds, reversible internal SemVer mapping, and monotonic ordering in `tests/unit/release-version.test.ts`
- [ ] T030 [P] [US2] Add updater state-machine and policy persistence tests covering offline, draft, interrupted download, and active-operation blockers in `tests/unit/update-state.test.ts`
- [ ] T031 [P] [US2] Add strict updater IPC contract tests proving the renderer cannot set feed URLs or install without confirmation in `tests/contract/update-ipc.contract.test.ts`
- [ ] T032 [P] [US2] Add an adapter-backed N→N+1 lifecycle integration test in `tests/integration/update-flow.test.ts`

### Implementation for User Story 2

- [ ] T033 [US2] Implement release manifest parsing, reversible mapping, and identity validation in `scripts/release-version.ts`
- [ ] T034 [P] [US2] Configure explicit Windows executable/NSIS installer/uninstaller/header icons and deterministic artifact naming in `electron-builder.yml`
- [ ] T035 [P] [US2] Add platform-ready icon generation/verification script from versioned sources in `scripts/generate-icons.ts` and `build/README.md`
- [ ] T036 [US2] Set `com.oplforge.app` as App User Model ID before window creation and register update startup wiring in `electron/main.ts`
- [ ] T037 [P] [US2] Implement versioned local Update Policy persistence in `electron/services/updates/update-policy.store.ts`
- [ ] T038 [US2] Implement the packaged-only `electron-updater` state machine, trusted provider lifecycle, sanitization, and explicit install in `electron/services/updates/update.service.ts`
- [ ] T039 [P] [US2] Implement revisioned update event publication in `electron/services/updates/update-event.publisher.ts`
- [ ] T040 [US2] Register validated update handlers/subscriptions through `electron/ipc/update.ipc.ts`, `electron/preload.ts`, and `src/services/api.ts`
- [ ] T041 [P] [US2] Implement version/current-candidate/update-progress dialog components in `src/components/updates/UpdateDialog.tsx` and `src/components/updates/UpdateProgress.tsx`
- [ ] T042 [US2] Integrate manual check, available-update prompt, postpone, and explicit restart/install into `src/pages/SettingsPage.tsx`
- [ ] T043 [US2] Add release identity/provider configuration and updater metadata generation in `package.json`, `release-manifest.json`, and `electron-builder.yml`
- [ ] T044 [US2] Execute clean-install identity inspection and controlled installed N→N+1 validation, recording platform evidence in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Users can recognize, install, update, postpone, and recover from update failures without manual reinstallation.

---

## Phase 5: User Story 3 - Show Existing Art and Useful Statuses (Priority: P1)

**Goal**: Display validated device-local covers consistently and separate artwork/metadata completeness from structural readiness.

**Independent Test**: Scan known COV/COV2/invalid/duplicate fixtures, compare grid/list/detail and status causes, remove the device mid-scan, and exercise approximately 500 games without a UI freeze over two seconds.

### Tests for User Story 3

- [ ] T045 [P] [US3] Add local ART index tests for one-pass enumeration, PNG validation, COV→COV2 precedence, duplicates, case, symlinks, and device removal in `tests/unit/local-art-index.test.ts`
- [ ] T046 [P] [US3] Add custom protocol security tests for valid, stale, traversal, unknown, root-swapped, and MIME/nosniff cases in `tests/unit/local-art-protocol.test.ts`
- [ ] T047 [P] [US3] Add catalog IPC contract tests for `artView` and independent health causes without absolute paths in `tests/contract/catalog-ipc.contract.test.ts`
- [ ] T048 [P] [US3] Add fixture-backed grid/list/detail and 500-game responsiveness integration tests in `tests/integration/local-art-library.test.ts` and `tests/integration/catalog-performance.test.ts`

### Implementation for User Story 3

- [ ] T049 [US3] Implement one-pass device-local ART indexing, validation, deterministic duplicate resolution, and snapshot promotion in `electron/services/catalog/local-art-index.service.ts`
- [ ] T050 [US3] Join LocalArtIndexSnapshot by normalized Game ID during catalog scan and preserve the last complete snapshot on failure in `electron/services/catalog/catalog-scanner.service.ts` and `electron/services/catalog/catalog.service.ts`
- [ ] T051 [US3] Implement the revision-bound confined `opl-art:` protocol handler with strict headers and root revalidation in `electron/services/art/local-art-protocol.service.ts`
- [ ] T052 [US3] Register the custom scheme before app ready, bind it to the promoted index, and restrict the renderer CSP `img-src` in `electron/main.ts` and `index.html`
- [ ] T053 [US3] Replace collapsed art booleans/catch-all status with Game Art View and Library Health mappings in `src/types/library.ts` and `src/pages/GameLibraryPage.tsx`
- [ ] T054 [P] [US3] Render opaque covers with lazy loading, revision cache-busting, and placeholder fallback in `src/components/library/GameCard.tsx`
- [ ] T055 [P] [US3] Render the same selected cover and explicit health/art/metadata causes in `src/components/library/GameRow.tsx` and `src/components/library/GameDetailDrawer.tsx`
- [ ] T056 [US3] Remove `file://` game-path rendering and ensure stale-device URLs are revoked/ignored across Library query lifecycle in `src/pages/GameLibraryPage.tsx`
- [ ] T057 [US3] Measure the 500-game scenario and record scan count, UI stalls, memory observations, and any bounded limitation in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Local artwork is visible and safe; art absence no longer produces a structural "Atenção" state.

---

## Phase 6: User Story 4 - Download to This Computer (Priority: P1)

**Goal**: Allow a durable download to finish in an authorized local folder without any active OPL device while preserving the existing device route.

**Independent Test**: With no device connected, choose a folder, interrupt/restart, finish atomically with original basename/format, and confirm no OPL layout or automatic PCSX2 launch.

### Tests for User Story 4

- [ ] T058 [P] [US4] Add download target-v2 migration/state-transition tests for v1 OPL tasks and local tasks in `tests/unit/download-state-machine.test.ts` and `tests/unit/download-task-store.test.ts`
- [ ] T059 [P] [US4] Add local destination tests for basename sanitization, authorization/root identity, space, fail/rename collision, atomic promotion, and symlink changes in `tests/unit/local-destination.test.ts`
- [ ] T060 [P] [US4] Extend download IPC contract tests with the discriminated target and legal-receipt rules in `tests/contract/opl-finalization-ipc.contract.test.ts`
- [ ] T061 [P] [US4] Add no-device, restart, missing-folder, ENOSPC, collision, and OPL-route regression scenarios in `tests/integration/local-download-recovery.test.ts`

### Implementation for User Story 4

- [ ] T062 [US4] Implement persisted download schema v1→v2 migration to the discriminated target union in `electron/services/downloads/download-task.store.ts`
- [ ] T063 [US4] Extend download state transitions/progress windows with local promotion and verification phases in `electron/services/downloads/download-state-machine.ts`
- [ ] T064 [US4] Update coordinator duplicate detection, filtering, scheduling, recovery, and device resolution by target kind in `electron/services/downloads/download-coordinator.service.ts` and `electron/services/downloads/download-recovery.service.ts`
- [ ] T065 [US4] Implement authorized-root validation, same-filesystem staging, collision policy, atomic promotion, and size/hash verification in `electron/services/downloads/local-destination.service.ts`
- [ ] T066 [US4] Branch the post-transfer processor between unchanged OPL finalization and local promotion in `electron/main.ts`
- [ ] T067 [US4] Update enqueue/list schemas and IPC to accept target-v2 while keeping the bounded persisted-v1 compatibility path in `electron/ipc/schemas.ts` and `electron/ipc/download.ipc.ts`
- [ ] T068 [P] [US4] Add the clear "Baixar para: Dispositivo OPL / Este computador" target and folder/collision controls in `src/components/catalog/DownloadPlanModal.tsx`
- [ ] T069 [P] [US4] Show target kind, safe destination label, local phases, and explicit optional PCSX2 action in `src/components/downloads/DownloadPipelineCard.tsx`
- [ ] T070 [US4] Pass local targets through Essentials legal confirmation and enqueue flows without requiring activeDevice in `src/pages/EssentialsCatalogPage.tsx`
- [ ] T071 [US4] Re-run durable download/cache/device finalization regressions and record v1 migration/local recovery evidence in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Local download is independently usable without hardware and does not alter the proven OPL finalization route.

---

## Phase 7: User Story 5 - Observe Existing-Game Imports (Priority: P1)

**Goal**: Make single and batch local imports durable, staged, recoverable, and continuously visible through the existing Activity Drawer.

**Independent Test**: Import seven varied files, see byte-weighted/item progress, cancel safely, simulate source/space/I/O failures and crash boundaries, restart, and reconcile exactly one result per item.

### Tests for User Story 5

- [ ] T072 [P] [US5] Add ImportJob/Item transition, monotonic progress, throughput/ETA stability, and batch weighting tests in `tests/unit/import-state-machine.test.ts`
- [ ] T073 [P] [US5] Add atomic store/journal migration and idempotent crash-boundary replay tests in `tests/unit/import-job-store.test.ts` and `tests/unit/import-journal.test.ts`
- [ ] T074 [P] [US5] Add strict import CRUD/cancel/retry/recovery IPC contract tests in `tests/contract/import-ipc.contract.test.ts`
- [ ] T075 [P] [US5] Add seven-item progress, cancellation, source mutation, ENOSPC, I/O error, restart, and out-of-order-event integration tests in `tests/integration/import-progress-recovery.test.ts`

### Implementation for User Story 5

- [ ] T076 [P] [US5] Implement pure ImportJob/Item state transitions and byte-weighted progress calculations in `electron/services/imports/import-state-machine.ts`
- [ ] T077 [P] [US5] Implement versioned atomic ImportJob persistence and paging in `electron/services/imports/import-job.store.ts`
- [ ] T078 [US5] Implement mutation-before-journal boundaries, staging references, idempotent replay, and cleanup policies in `electron/services/imports/import-journal.service.ts`
- [ ] T079 [US5] Implement streaming copy with abort signal, source fingerprint recheck, 1 s/16 MiB checkpoints, smoothed speed, and reliable ETA in `electron/services/imports/import-copy.service.ts`
- [ ] T080 [US5] Implement batch orchestration, isolated item failures, safe-phase cancellation, promotion verification, retry, and startup reconciliation in `electron/services/imports/import-job.service.ts`
- [ ] T081 [P] [US5] Publish revisioned Import Operation Summary/Event payloads and terminal phase events in `electron/services/imports/import-event.publisher.ts`
- [ ] T082 [US5] Register validated import create/list/get/confirm/cancel/retry/recovery IPC in `electron/ipc/import.ipc.ts`, `electron/preload.ts`, and `src/services/api.ts`
- [ ] T083 [US5] Initialize/reconcile/stop ImportJob services in the coordinated application lifecycle in `electron/main.ts`
- [ ] T084 [P] [US5] Replace blocking import submission with job creation and item/global progress UI in `src/pages/Ps2ImportPage.tsx`
- [ ] T085 [P] [US5] Render restored import summaries, current item, counts, bytes, speed, ETA, error and safe cancel actions in `src/components/activity/ActivityDrawer.tsx` and `src/components/activity/ActivityStatusBar.tsx`
- [ ] T086 [US5] Route or deprecate legacy direct copy-game paths only after job parity while preserving PS1/app behavior in `electron/ipc/file.ipc.ts` and `electron/services/file.service.ts`
- [ ] T087 [US5] Execute every documented journal boundary failure and record recovery/cancellation evidence in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Imports are observable and recoverable; the renderer never blocks on an opaque copy loop.

---

## Phase 8: User Story 6 - Control the Update Policy (Priority: P2)

**Goal**: Persist and honor the four update policies while always keeping installation/restart explicit and manual check available.

**Independent Test**: Select each policy, restart, expose an eligible update, and verify the exact check/download prompt behavior plus persistent manual check.

### Tests for User Story 6

- [ ] T088 [P] [US6] Add policy migration/default/revision and restart persistence cases in `tests/unit/update-policy-store.test.ts`
- [ ] T089 [P] [US6] Add Settings UI tests for all four policy labels, manual check, download consent, and install consent in `src/pages/SettingsPage.test.tsx`
- [ ] T090 [P] [US6] Add integration tests mapping each policy to check/download behavior while update install remains explicit in `tests/integration/update-policy.test.ts`

### Implementation for User Story 6

- [ ] T091 [US6] Complete policy migration/default and optimistic revision handling in `electron/services/updates/update-policy.store.ts`
- [ ] T092 [US6] Schedule or suppress packaged startup checks and automatic downloads according to policy in `electron/services/updates/update.service.ts`
- [ ] T093 [US6] Add all four policy controls, saved-state/error feedback, and always-visible manual check to `src/pages/SettingsPage.tsx`
- [ ] T094 [US6] Block automatic restart, surface active long operations, and require explicit resolution/confirmation in `src/components/updates/UpdateDialog.tsx`
- [ ] T095 [US6] Record restart persistence and policy behavior results for packaged builds in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Update convenience is configurable without weakening consent or trusted-source boundaries.

---

## Phase 9: User Story 7 - Publish Predictable Releases (Priority: P2)

**Goal**: Give maintainers a tag-validated, signed, allowlisted and reproducible multiplatform release pipeline.

**Independent Test**: Trigger a matching `v1.A.B.C` release and inspect all version/signature/artifact/update references; deliberately mismatched input fails before publication.

### Tests for User Story 7

- [ ] T096 [P] [US7] Add manifest/tag/package/artifact mismatch and allowlist fixture tests in `tests/unit/release-manifest.test.ts`
- [ ] T097 [P] [US7] Add workflow static contract tests for tag-only publication, validation dependency, exact Windows `.exe`, metadata retention, and no run-number identity in `tests/contract/release-workflow.contract.test.ts`
- [ ] T098 [P] [US7] Add artifact metadata reference/hash/size inventory tests in `tests/integration/release-artifact-inventory.test.ts`

### Implementation for User Story 7

- [ ] T099 [US7] Implement prebuild manifest/tag/package validation and generated packaging environment output in `scripts/validate-release.ts`
- [ ] T100 [P] [US7] Implement exact artifact inventory, updater-reference, checksum, and unexpected-file rejection in `scripts/validate-artifacts.ts`
- [ ] T101 [P] [US7] Implement platform signature/notarization verification commands with explicit smoke-vs-public modes in `scripts/verify-signatures.ts`
- [ ] T102 [US7] Refactor public release trigger to validated tags, add a single validation job, and remove `github.run_number` identity in `.github/workflows/release.yml`
- [ ] T103 [US7] Stage and upload exact per-platform deliverables including updater metadata/blockmaps while excluding unpacked/portable/intermediate files in `.github/workflows/release.yml`
- [ ] T104 [US7] Add production signing/notarization secret gates and preserve unsigned non-public smoke packaging in `.github/workflows/release.yml` and `electron-builder.yml`
- [ ] T105 [US7] Publish one stable GitHub Release only after all matrix inventory/signature gates and use public version for release/artifact names in `.github/workflows/release.yml`
- [ ] T106 [US7] Add branch packaging smoke without public release creation and keep lint/test/build gates in `.github/workflows/ci.yml`
- [ ] T107 [US7] Document maintainer version bump, signing secrets, tag, rollback, artifact inventory, and updater metadata procedure in `docs/releasing.md`
- [ ] T108 [US7] Execute a dry-run/sandbox release and record manifest, signatures, inventory, checksums and reproduction observations in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Maintainers have one reproducible version/release path and users see one Windows installer.

---

## Phase 10: User Story 8 - Diagnose OPL Connectivity Safely (Priority: P2)

**Goal**: Provide configurable sanitized protocol diagnostics and a durable physical-hardware compatibility record.

**Independent Test**: Reproduce accepted/rejected handshakes, inspect correlated safe fields, export no auth material, and complete the physical OPL smoke record independently of desktop clients.

### Tests for User Story 8

- [ ] T109 [P] [US8] Add diagnostic redaction tests forbidding passwords, challenges, responses, auth packet hex, and raw signed URLs in `electron/services/network-share/smb/smb-server.test.ts`
- [ ] T110 [P] [US8] Add debug-level persistence/IPC contract tests and controlled invalid-level errors in `electron/ipc/network-share.ipc.test.ts`
- [ ] T111 [P] [US8] Add reconnect, two-client isolation, wrong/empty credentials, interrupted read, and sanitized event integration tests in `tests/integration/smb-hardware-profile.test.ts`

### Implementation for User Story 8

- [ ] T112 [US8] Define SMB compatibility profile, diagnostic event, and Hardware Smoke Record contracts in `src/types/opl.ts`
- [ ] T113 [US8] Emit correlation ID, phase, command, dialect/security, auth mechanism name, status, IDs, offset/count and duration without raw payloads in `electron/services/network-share/smb/smb-server.ts`
- [ ] T114 [US8] Add persisted standard/detailed SMB debug setting and expose validated controls in `electron/services/network-share/config-store.ts` and `electron/ipc/network-share.ipc.ts`
- [ ] T115 [P] [US8] Add debug controls, protocol milestones, failure guidance, and sanitized export action in `src/components/network/NetworkShareStatus.tsx`
- [ ] T116 [US8] Implement Hardware Smoke Record validation/persistence/export separately from desktop evidence in `electron/services/network-share/hardware-smoke.service.ts` and `electron/ipc/network-share.ipc.ts`
- [ ] T117 [P] [US8] Add the physical test form/result view with OPL commit, console/adapter, milestones, DVD9 boundary and evidence references in `src/components/network/NetworkHardwareSmoke.tsx`
- [ ] T118 [US8] Capture and sanitize a real PS2 trace for auth matrix, listing, OPEN_ANDX, sustained reads, DVD9, reconnect and two-client behavior in `tests/fixtures/smb/hardware/README.md`
- [ ] T119 [US8] Execute the mandatory PS2+OPL physical smoke and record pass/fail evidence without promoting unverified milestones in `specs/006-release-hardening-library-experience/validation-results.md`

**Checkpoint**: Support diagnostics are actionable and secret-free; only the real hardware record can mark the selected OPL profile supported.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Close integration, security, performance, documentation and release gates across all selected stories.

- [ ] T120 [P] Add cross-domain path traversal, symlink swap, stale revision, log redaction, renderer-isolation, and no-library-telemetry regressions in `tests/integration/security-regressions.test.ts`
- [ ] T121 [P] Add update/import/download/SMB operation reconciliation and event ordering regressions in `tests/integration/pipeline-observability.test.ts`
- [ ] T122 [P] Update user documentation for local downloads, update policies, library art/status, import progress, and OPL SMB setup in `README.md` and `docs/opl-finalization.md`
- [ ] T123 Reconcile every FR-001–FR-067 and SC-001–SC-015 against automated/manual evidence in `specs/006-release-hardening-library-experience/validation-results.md`
- [ ] T124 Run `pnpm lint`, `pnpm exec tsc --noEmit`, affected unit/contract/integration suites, and `pnpm build`, recording exact results in `specs/006-release-hardening-library-experience/validation-results.md`
- [ ] T125 Run `specs/006-release-hardening-library-experience/quickstart.md` Scenarios 1–9 and distinguish passed, failed, and not-verified hardware/signing/platform gates in `specs/006-release-hardening-library-experience/validation-results.md`
- [ ] T126 Audit constitution compliance, migrations, secrets, signing, legal receipts, staging, recovery, and renderer privilege boundaries in `specs/006-release-hardening-library-experience/validation-results.md`
- [ ] T127 [P] Update the feature design documents for any implementation-proven deviation without weakening acceptance criteria in `specs/006-release-hardening-library-experience/plan.md`, `data-model.md`, and `contracts/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: No dependencies.
- **Phase 2 — Foundational**: Depends on Phase 1 and blocks all story implementation.
- **US1, US2, US3, US4, US5**: May begin after Phase 2 and can run in parallel with separate owners.
- **US6**: Depends on the core update service and UI from US2.
- **US7**: Depends on Release Identity and builder/updater metadata from US2; it can otherwise run in parallel with US3–US5.
- **US8**: Depends on the corrected protocol path from US1, though diagnostic model/UI tests can begin after Phase 2.
- **Polish**: Depends on every story selected for the release; final physical/signing gates cannot be inferred from automated tests.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -----------------> US8 --┐
                    -> US2 -------> US6 -----------|
                         `--------> US7 -----------|--> Polish
                    -> US3 ------------------------|
                    -> US4 ------------------------|
                    `-> US5 -----------------------┘
```

### Within Each User Story

1. Write the listed tests and confirm the gap is reproduced.
2. Add/migrate models and state machines.
3. Implement privileged services and persistence.
4. Expose strict IPC/preload/API contracts.
5. Integrate existing UI surfaces.
6. Run the independent test and record evidence before declaring the story complete.

### Parallel Opportunities

- T002–T005 can run concurrently after T001.
- T008–T010, T012–T013 can run concurrently while shared types/schemas are stabilized.
- After Phase 2, US1–US5 can be owned independently.
- Test tasks marked [P] in every story are intentionally in separate files and can be authored concurrently.
- In US2, icon/build configuration, policy storage, events and UI components can proceed in parallel after shared contracts.
- In US3, card and row/detail rendering can proceed in parallel after the art view contract.
- In US4, modal and pipeline-card UI can proceed in parallel with the local destination service after target contracts.
- In US5, pure state/store tasks and UI presentation can proceed concurrently before orchestration integration.
- US6 and US7 can proceed concurrently once US2 core updater/identity tasks are complete.
- US8 UI/record work can proceed while US1 hardware preparation finishes, but T118–T119 require US1 protocol completion.

## Parallel Execution Examples

### User Story 1

```text
T015 auth regression | T016 wire codec | T017 DVD9 boundary | T018 handshake integration
then T022 constants can run while T019–T021 establish session semantics
```

### User Story 2

```text
T029 version tests | T030 state tests | T031 IPC tests | T032 lifecycle integration
then T034 builder identity | T035 icon tooling | T037 policy store | T039 events | T041 UI
```

### User Story 3

```text
T045 index tests | T046 protocol security | T047 contract | T048 library/performance
then T054 card rendering | T055 row/detail rendering
```

### User Story 4

```text
T058 migration/state | T059 local destination | T060 IPC | T061 recovery integration
then T068 target modal | T069 task card while T062–T067 implement main-process flow
```

### User Story 5

```text
T072 state/progress | T073 store/journal | T074 IPC | T075 integration
then T076 state machine | T077 store | T081 publisher | T084 import UI | T085 Activity UI
```

### User Stories 6–8

```text
US6: T088 policy store | T089 Settings UI | T090 policy integration
US7: T096 manifest | T097 workflow contract | T098 artifact inventory
US8: T109 redaction | T110 debug IPC | T111 connection integration
```

## Implementation Strategy

### MVP First — User Story 1

1. Complete Setup and Foundational phases.
2. Complete US1 through automated protocol regressions.
3. Stop and execute the physical PS2 independent test; do not call the story complete if hardware is unavailable.
4. Demonstrate OPL listing/open/read as the network MVP.

### Incremental Delivery

1. **Network MVP**: US1, followed by US8 evidence when hardware is available.
2. **Distribution slice**: US2 provides installed identity/update; US6 adds policy; US7 hardens publication.
3. **Library slice**: US3 makes existing devices visually useful and statuses trustworthy.
4. **Acquisition slice**: US4 permits local downloads without device.
5. **Operations slice**: US5 makes local imports durable and observable.
6. Complete Polish and all release/hardware gates only after the desired slices pass independently.

### Parallel Team Strategy

After Foundation:

- Stream A: US1 then US8 (SMB/hardware).
- Stream B: US2 then US6/US7 (identity/update/release).
- Stream C: US3 (catalog/art/library).
- Stream D: US4 then US5 (download/import operations), or split these if capacity permits.

## Notes

- `[P]` means a task can execute without editing a file currently required by an unfinished sibling task.
- Story labels provide traceability to spec.md; setup/foundation/polish tasks intentionally have no story label.
- Automated tests cannot replace clean-install resource inspection, production signing, installed N→N+1, or physical PS2 evidence.
- Preserve unrelated working-tree changes and existing persisted data through explicit migrations.
- Commit after each task or coherent test-first implementation group.
