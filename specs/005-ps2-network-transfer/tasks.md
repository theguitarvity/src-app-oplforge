# Tasks: PS2 Network Library Sharing

**Input**: Design documents from `/specs/005-ps2-network-transfer/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/network-share-ipc.md, quickstart.md

**Tests**: Included — this codebase's existing specs (001–004) consistently include test tasks, and Constitution Principle V requires automated tests for new domain logic (the SMB1 parser especially) plus integration tests at altered UI/bridge/service boundaries.

> Revised after `/speckit-analyze` (see report in conversation history): adds explicit write-access acknowledgment (FR-014), generic auth-failure handling (FR-015), `HistoryEntry` integration (Constitution Principle IV), and a lint gate in Polish.
>
> **Post-implementation fix** (found via real usage, not caught by tests at the time): `network-share:save-config`/`:start` originally had the main process re-discover "the" device via its own `listDevices()` scan, independent of whatever device the user had already selected in `useDeviceStore`. This caused `LIBRARY_STRUCTURE_INVALID`/wrong-device failures whenever the two disagreed. Fixed by making `libraryRootPath` an explicit, required field of `SaveNetworkShareConfigInput`, sourced from `useDeviceStore().activeDevice.path` in the renderer — consistent with how every other device-scoped operation in this app already works (`copyGame`, `runDiagnostics`, etc.). Added a new `DEVICE_NOT_SELECTED` error code and UI guard. See `contracts/network-share-ipc.md`'s Design Note.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencies and shared type/contract scaffolding

- [x] T001 Add `ftp-srv` dependency in `package.json`
- [x] T002 [P] Add `NetworkShareConfig` (incl. `writeAccessAcknowledgedAt`), `NetworkShareStatus`, `ProtocolStatus`, `ConnectedClient`, `NetworkShareEvent`, `SetupInstructions` types and extend the `OplApi` interface in `src/types/opl.ts` (per `data-model.md` and `contracts/network-share-ipc.md`)
- [x] T003 [P] Add zod input schemas for `network-share:save-config`, `network-share:start`, `network-share:acknowledge-write-access`, `network-share:get-setup-instructions` in `electron/ipc/schemas.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement local-network source-address enforcement (RFC1918 `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) in `electron/services/network-share/local-network-guard.ts`
- [x] T005 [P] Implement local-network interface/address discovery helper (used for binding and for setup-instructions display) in `electron/services/network-share/network-interfaces.ts`
- [x] T006 [P] Implement credential encrypt/decrypt via Electron `safeStorage` in `electron/services/network-share/credential-store.ts`
- [x] T007 Implement `NetworkShareConfig` persistence, defaulting to sharing off and `writeAccessAcknowledgedAt` unset (per FR-007/SC-005/FR-014) in `electron/services/network-share/config-store.ts` (depends on T006)
- [x] T008 Implement `network-share.service.ts` orchestrator skeleton (status state machine, event emitter, start/stop lifecycle hooks for both protocol servers) in `electron/services/network-share/network-share.service.ts` (depends on T004, T005, T007)
- [x] T009 Register `network-share.ipc.ts` handlers for `network-share:get-config`, `:save-config`, `:get-status` and forward `network-share:event` in `electron/ipc/network-share.ipc.ts` (depends on T008, T003)
- [x] T010 Extend `electron/preload.ts` contextBridge surface with the new `OplApi` network-share methods (depends on T009)
- [x] T011 [P] Create `network-share-store.ts` Zustand store, mirroring `device-store.ts`/`log-store.ts` conventions, in `src/stores/network-share-store.ts` (depends on T002)
- [x] T012 Wire `before-quit` shutdown of both servers in `electron/main.ts` (depends on T008)

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Enable Library Sharing for a Network-Connected PS2 (Priority: P1) 🎯 MVP

**Goal**: Turn on sharing from OPL Forge, explicitly acknowledge write access, see the exact connection details, and have a PS2 browse and launch titles from the shared library via SMB (the load-bearing protocol per `research.md` R1).

**Independent Test**: Turn sharing on, acknowledge write access, follow the in-app tutorial to configure the PS2's OPL SMB client, browse from the PS2, and boot a title (`quickstart.md` Scenarios 1–2).

### Tests for User Story 1

- [x] T013 [P] [US1] Unit test for the SMB1 frame parser/codec in `electron/services/network-share/smb/frame-codec.test.ts`
- [x] T014 [P] [US1] Integration test for `network-share.service` start/stop with SMB and FTP both enabled in `electron/services/network-share/network-share.service.test.ts`
- [x] T015 [P] [US1] Component test for enabling sharing, acknowledging write access, and viewing connection details in `src/components/network/NetworkShareStatus.test.tsx`
- [x] T016 [P] [US1] Test for generic auth-failure rejection (wrong username/password rejected without revealing which, no `ConnectedClient` created) across both protocols in `electron/services/network-share/auth-failure.test.ts` (FR-015, `quickstart.md` Scenario 9) — caught 2 real bugs: SMB was announcing `ConnectedClient` before auth succeeded, and `stop()` could hang on a lingering socket; both fixed in `smb-server.ts`

### Implementation for User Story 1

- [x] T017 [US1] Implement the SMB1 frame codec (message parsing/framing for the subset OPL's client uses) in `electron/services/network-share/smb/frame-codec.ts` (depends on T013)
- [x] T018 [US1] Implement SMB1 command handlers (negotiate, session setup with generic-failure auth per FR-015, tree connect, browse, read, write — confined to `libraryRootPath`) in `electron/services/network-share/smb/command-handlers.ts` (depends on T017)
- [x] T019 [US1] Implement the SMB server socket lifecycle (bind via local-network guard, per-connection handling) in `electron/services/network-share/smb/smb-server.ts` (depends on T018, T004)
- [x] T020 [US1] [P] Implement the FTP server wrapping `ftp-srv`, filesystem scoped to `libraryRootPath`, local-network guard applied, **and `ftp-srv`'s auth callback wired to the configured username/password with the same generic-failure behavior as SMB (FR-015)**, in `electron/services/network-share/ftp/ftp-server.ts` (depends on T004)
- [x] T021 [US1] Implement `network-share:acknowledge-write-access` IPC handler, writing `writeAccessAcknowledgedAt` via `config-store.ts` (FR-014) in `electron/ipc/network-share.ipc.ts` (depends on T007, T009)
- [x] T022 [US1] Wire both servers into `network-share.service.ts` start/stop orchestration, with independent per-protocol failure handling; `start` MUST fail with `WRITE_ACCESS_NOT_ACKNOWLEDGED` if `writeAccessAcknowledgedAt` is unset (FR-014) in `electron/services/network-share/network-share.service.ts` (depends on T019, T020, T008, T021)
- [x] T023 [US1] Implement `network-share:start`/`:stop` IPC handlers with `LIBRARY_STRUCTURE_INVALID`/`PORT_IN_USE`/`BIND_FAILED`/`ALREADY_RUNNING`/`WRITE_ACCESS_NOT_ACKNOWLEDGED` error mapping in `electron/ipc/network-share.ipc.ts` (depends on T022, T009)
- [x] T024 [US1] Implement `network-share:get-setup-instructions` IPC handler generating tutorial steps from current bound status (FR-012) in `electron/ipc/network-share.ipc.ts` (depends on T023)
- [x] T025 [US1] Append a `HistoryEntry` (via the existing `history.service.ts`) on sharing start and stop (Constitution Principle IV) in `electron/services/network-share/network-share.service.ts` (depends on T022)
- [x] T026 [US1] Create `NetworkShareStatus.tsx` (off/running state + connection details display) in `src/components/network/NetworkShareStatus.tsx` (depends on T011, T010)
- [x] T027 [US1] Add the explicit write-access acknowledgment step (FR-014) — a distinct confirmation from the username/password form, shown before the first `network-share:start` — in `src/components/network/NetworkShareStatus.tsx` (depends on T026, T021)
- [x] T028 [US1] Create `NetworkShareSetupTutorial.tsx` guided step-by-step component (FR-012) in `src/components/network/NetworkShareSetupTutorial.tsx` (depends on T024)
- [x] T029 [US1] Add UI messaging clarifying that FTP alone does not enable OPL game browsing/launching — SMB is required (R1 finding, `quickstart.md` Scenario 8) in `src/components/network/NetworkShareStatus.tsx` (depends on T026)
- [x] T030 [US1] Implement write-conflict detection and `write-conflict` event emission (FR-013) in the SMB/FTP write paths, surfaced via `network-share.service.ts` in `electron/services/network-share/network-share.service.ts` (depends on T018, T020)
- [x] T031 [US1] Add a network sharing entry point/navigation into the app (e.g. under Dispositivos or Ferramentas, consistent with the `004-ia-ux-redesign` IA if merged) (depends on T026) — added as a "Rede" tab in `src/pages/SettingsPage.tsx`

**Checkpoint**: User Story 1 is fully functional and independently testable — including real hardware validation against this project's own PS2/OPL (`quickstart.md` Scenario 2, called out in `plan.md` Constitution Check Principle V).

---

## Phase 4: User Story 2 - See Connection & Sharing Status at a Glance (Priority: P2)

**Goal**: Reliable, near-real-time status (off / running-idle / running-connected) and human-readable failure messages, so users don't have to trust the PS2's own unreliable network screen.

**Independent Test**: Start sharing alone (expect idle), connect a PS2 (expect connected within 10s), and trigger a port conflict (expect a plain-language error) — `quickstart.md` Scenarios 3 and 6.

### Tests for User Story 2

- [x] T032 [P] [US2] Unit test for client activity classification (idle/browsing/transferring) in `electron/services/network-share/client-activity.test.ts`
- [x] T033 [P] [US2] Component test for the connected-client indicator updating in `src/components/network/NetworkShareStatus.test.tsx` — covered via the connection-details assertion in T015's test (real status transitions from the fake API)

### Implementation for User Story 2

- [x] T034 [US2] Implement connected-client tracking (connect/disconnect/activity) in the SMB server in `electron/services/network-share/smb/smb-server.ts` (depends on T019)
- [x] T035 [US2] [P] Implement connected-client tracking (connection/command events) in the FTP server in `electron/services/network-share/ftp/ftp-server.ts` (depends on T020)
- [x] T036 [US2] Emit `protocol-status-changed`/`client-connected`/`client-disconnected`/`client-activity-changed` events within 10s of a state change (SC-002) in `electron/services/network-share/network-share.service.ts` (depends on T034, T035)
- [x] T037 [US2] Map start failures to human-readable messages (FR-008) in `src/components/network/NetworkShareStatus.tsx` (depends on T023, T026)
- [x] T038 [US2] Add the connected-clients indicator (running-idle vs. running-connected) to `src/components/network/NetworkShareStatus.tsx` (depends on T036)

**Checkpoint**: User Stories 1 and 2 both work independently and together.

---

## Phase 5: User Story 3 - Keep Sharing Local and Under Explicit Control (Priority: P2)

**Goal**: Sharing stays off by default, rejects any connection from outside the local network, and stops cleanly on disable/quit.

**Independent Test**: Fresh config shows sharing off; a simulated non-local-source connection is rejected before protocol negotiation; quitting the app stops both servers — `quickstart.md` Scenarios 4 and 5.

### Tests for User Story 3

- [x] T039 [P] [US3] Unit test for local-network-guard RFC1918 accept/reject behavior in `electron/services/network-share/local-network-guard.test.ts`
- [x] T040 [P] [US3] Integration test verifying sharing is off after a fresh config load and stops cleanly on simulated app-quit in `electron/services/network-share/network-share.service.test.ts`

### Implementation for User Story 3

- [x] T041 [US3] Enforce local-network-guard rejection before protocol negotiation in the SMB server in `electron/services/network-share/smb/smb-server.ts` (depends on T019, T004)
- [x] T042 [US3] [P] Enforce local-network-guard rejection before protocol negotiation in the FTP server in `electron/services/network-share/ftp/ftp-server.ts` (depends on T020, T004)
- [x] T043 [US3] Confirm/lock the default-off, no-auto-start-without-opt-in behavior in `electron/services/network-share/config-store.ts` (depends on T007)
- [x] T044 [US3] Confirm the `before-quit` hook stops both servers with clean active-connection teardown in `electron/main.ts` (depends on T012, T022)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full-suite verification, and hardware/security validation

- [x] T045 [P] Add a network sharing usage section to `README.md` — includes a privileged-port (445/21) callout not originally anticipated in the plan
- [x] T046 Run `pnpm lint`, `pnpm test:run`, and `pnpm build`; verify zero failures/type/lint errors (Constitution "Fluxo de Desenvolvimento" gate 5) — 278/278 tests pass, 0 TS errors, build succeeds; lint clean for all `network-share` code (fixed one `no-useless-assignment` in `command-handlers.ts`). 17 pre-existing lint errors remain in unrelated `004-ia-ux-redesign` scaffolding files that predate this feature — out of scope, not touched
- [~] T047 Execute `specs/005-ps2-network-transfer/quickstart.md` Scenarios 1–9 — Scenarios 1, 3, 4, 5, 6, 7, 9 validated via automated integration tests (real TCP servers, real SMB1/FTP handshakes); Scenario 8 (FTP-secondary warning) validated live in the browser preview against the actual dev server. **Scenario 2 (real PS2/OPL hardware boot test) still requires you** — this session has no access to your physical PS2; see the note in the final report
- [x] T048 [P] Security audit pass: grep for credential logging (including failed-auth attempts per FR-015), confirm SMB/FTP handlers confine all paths to `libraryRootPath` with no traversal possible — clean: no `console`/`log` calls anywhere in `network-share/`, password never appears in error messages/history/IPC responses, both SMB (`resolveSharePath`) and FTP (`ftp-srv`'s built-in `FileSystem`) confinement verified by code reading

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational completion.
  - US1 (P1) has no dependency on US2/US3 and is the MVP.
  - US2 (P2) builds on the SMB/FTP servers US1 introduces (client tracking hooks into the same server files) but is independently testable once US1's servers exist.
  - US3 (P2) likewise builds on US1's server implementations for the guard-enforcement tasks, but is independently testable (off-by-default and rejection behavior don't require US2's status UI).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- T002, T003 (Setup) in parallel.
- T005, T006 (Foundational) in parallel after T004; T011 in parallel with T009/T010's IPC work once T002 is done.
- T013, T014, T015, T016 (US1 tests) in parallel.
- T020 (FTP server) in parallel with T017–T019 (SMB codec/handlers/server) — different files, both only depend on T004.
- T032, T033 (US2 tests) in parallel.
- T035 in parallel with T034 — different files.
- T039, T040 (US3 tests) in parallel.
- T042 in parallel with T041 — different files.
- T045, T048 (Polish) in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit test for SMB1 frame codec in electron/services/network-share/smb/frame-codec.test.ts"
Task: "Integration test for network-share.service start/stop in electron/services/network-share/network-share.service.test.ts"
Task: "Component test for sharing status in src/components/network/NetworkShareStatus.test.tsx"
Task: "Auth-failure test in electron/services/network-share/auth-failure.test.ts"

# SMB and FTP servers together (independent files, same T004 dependency):
Task: "Implement SMB1 frame codec in electron/services/network-share/smb/frame-codec.ts"
Task: "Implement FTP server wrapping ftp-srv in electron/services/network-share/ftp/ftp-server.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks everything).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: run `quickstart.md` Scenarios 1, 2, 8, and 9 against the real PS2/OPL hardware already available to this project.
5. Ship the MVP — a user can enable sharing and actually browse/launch games on their PS2.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → validate independently (including real hardware) → this is the MVP.
3. US2 → adds reliable status visibility → validate independently.
4. US3 → adds default-off/local-only guarantees → validate independently.
5. Polish → docs, full lint/test/build gate, full quickstart pass, security audit.

---

## Notes

- The purpose-built SMB1 server (T017–T019) is the highest-risk work in this plan (`research.md` R3) — unit tests cover parsing/framing, but Scenario 2's real-hardware pass against this project's own PS2 is the actual proof of compatibility and cannot be skipped or replaced by mocks.
- Credentials (`username`/`password`) must never appear in logs, `HistoryEntry`, or plaintext config — enforced starting at T006/T007 and re-checked at T048. Failed-auth attempts (FR-015) must never log the attempted password either.
- Write access is gated behind an explicit, one-time acknowledgment (FR-014, T021/T027) — distinct from simply setting a username/password — before `network-share:start` will ever succeed.
- [P] tasks touch different files with no unmet dependencies; sequential tasks either share a file or build directly on a preceding task's output.
