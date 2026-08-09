# Tasks: OPL Forge UX / Information Architecture Redesign

**Input**: Design documents from `/specs/004-ia-ux-redesign/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project routing layout updates and component folder scaffolding

- [x] T001 Update application router and page exports in `src/app/routes.tsx` or `src/App.tsx`
- [x] T002 [P] Define navigation items and route contracts in `src/types/navigation.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and layout shell required by all user stories

- [x] T003 Evolve active device workspace state management in `src/stores/device-store.ts`
- [x] T004 [P] Evolve background activity progress and log streaming state in `src/stores/log-store.ts`
- [x] T005 Refactor primary sidebar navigation to 6 top-level items without scrollbar in `src/components/Sidebar.tsx`
- [x] T006 [P] Create compact Status Bar component in `src/components/activity/ActivityStatusBar.tsx`
- [x] T007 Create expandable Activity Drawer component in `src/components/activity/ActivityDrawer.tsx`
- [x] T008 Update main application layout shell with status bar and device selector in `src/layouts/AppShell.tsx`

---

## Phase 3: User Story 1 - Device Context & Workspace Management (Priority: P1) 🎯 MVP

**Goal**: Transform application home into an intent-driven Device Workspace with action-oriented empty states and storage metrics.

**Independent Test**: Connect/disconnect storage drive; verify home view adapts between Empty State and Active Workspace with capacity gauges and quick actions.

### Tests for User Story 1

- [x] T009 [P] [US1] Unit test for Device Store workspace state in `src/stores/device-store.test.ts`
- [x] T010 [P] [US1] Component test for Empty State actions in `src/components/device/DisconnectedEmptyState.test.tsx`

### Implementation for User Story 1

- [x] T011 [P] [US1] Create Disconnected Empty State component in `src/components/device/DisconnectedEmptyState.tsx`
- [x] T012 [P] [US1] Create Device Workspace Header & Storage Gauge in `src/components/device/DeviceWorkspaceHeader.tsx`
- [x] T013 [US1] Create Device Workspace Overview tab in `src/components/device/DeviceOverviewTab.tsx`
- [x] T014 [US1] Refactor `src/pages/DashboardPage.tsx` (Home route) to conditionally render Empty State vs Active Device Workspace
- [x] T015 [US1] Refactor `src/pages/DevicesPage.tsx` into a multi-tab Device Workspace hub — implemented as `Visão Geral` / `Gerenciar Dispositivos` / `Diagnóstico` (3 tabs; spec's `Jogos` and `Arquivos OPL` sub-tabs from FR-007 were not split out separately — known gap, see report)

---

## Phase 4: User Story 2 - Unified Game Library & Item Contextual Tools (Priority: P1)

**Goal**: Provide a unified filterable game library (PS2, PS1, Apps) with status badges and inline game detail actions.

**Independent Test**: Browse games in Grid and List view, filter by status or type, open Game Detail drawer, and trigger contextual operations (Validate, Defrag, Rename, PCSX2).

### Tests for User Story 2

- [ ] T016 [P] [US2] Contract test for Library filtering & status badges in `src/components/library/GameLibraryView.test.tsx` — not created (no dedicated contract test for the filter/badge logic in `GameLibraryPage.tsx`)
- [x] T017 [P] [US2] Component test for Game Detail Drawer actions in `src/components/library/GameDetailDrawer.test.tsx`

### Implementation for User Story 2

- [x] T018 [P] [US2] Update library item types and status definitions in `src/types/library.ts`
- [x] T019 [P] [US2] Create Grid View Game Card component in `src/components/library/GameCard.tsx`
- [x] T020 [P] [US2] Create List View Game Row component in `src/components/library/GameRow.tsx`
- [x] T021 [US2] Create Game Detail Slide-Over Drawer in `src/components/library/GameDetailDrawer.tsx`
- [x] T022 [US2] Wire contextual action buttons (Validate CRC, Check Defrag, Rename OPL, Launch PCSX2) in `src/components/library/GameDetailDrawer.tsx` — wired to real IPC contracts (`hashCatalogFile`, `listFragmentationGames`+`diagnoseFragmentation`, `auditOplNaming`+`createOplNamingPlan`+`confirmOplNaming`, `planValidation`+`startValidation`)
- [x] T023 [US2] Refactor `src/pages/GameLibraryPage.tsx` to support unified PS2/PS1/Apps browsing, search, and view toggles — now sources data from the real `scanCatalog` contract (PS2 only; PS1/Apps filter tabs remain in the UI but the catalog scanner does not yet classify PS1/Apps items — known gap, see report)

---

## Phase 5: User Story 3 - Guided Device Preparation Wizard (Priority: P2)

**Goal**: Provide a safe, step-by-step wizard for formatting and initializing OPL storage drives.

**Independent Test**: Launch preparation wizard, verify target volume label display, and confirm format lock requires explicit checkbox before execution.

### Tests for User Story 3

- [x] T024 [P] [US3] Unit test for Preparation Wizard confirmation lock in `src/components/device/PrepWizard.test.tsx`

### Implementation for User Story 3

- [x] T025 [US3] Create step-by-step wizard container in `src/components/device/PrepWizard.tsx`
- [x] T026 [US3] Implement target drive inspection & safety confirmation step — implemented as Step 3 inline in `PrepWizard.tsx` rather than a separate `PrepConfirmStep.tsx` file
- [x] T027 [US3] Implement format execution & progress steps — implemented as Steps 4/5 inline in `PrepWizard.tsx` rather than a separate `PrepExecutionStep.tsx` file; wired to the real `prepareDevice({ devicePath })` contract, which creates the OPL folder structure only (no raw disk formatting is performed by the app)
- [x] T028 [US3] Connect Preparation Wizard to `src/pages/DevicesPage.tsx` and Empty State CTAs

---

## Phase 6: User Story 4 - Non-Intrusive Activity Drawer & Progress Feedback (Priority: P2)

**Goal**: Replace permanent bottom log panel with a dynamic 36px status bar and slide-up log drawer.

**Independent Test**: Run a file copy or diagnostic scan; verify compact status bar progress and toggle the Activity Drawer to view raw streamed logs.

### Tests for User Story 4

- [x] T029 [P] [US4] Component test for Activity Status Bar & Drawer toggle in `src/components/activity/ActivityStatusBar.test.tsx`

### Implementation for User Story 4

- [x] T030 [US4] Connect background IPC file transfer & scan progress events to `src/components/activity/ActivityStatusBar.tsx` — via existing `useElectronEvents()` → `log-store.ts` (`onLog`/`onProgress`)
- [x] T031 [US4] Implement log filtering (`INFO`, `WARN`, `ERROR`) and log export actions in `src/components/activity/ActivityDrawer.tsx` — export implemented as copy-to-clipboard
- [ ] T032 [US4] Add user-friendly human-readable error formatting with "Ver Detalhes Técnicos" trigger — not implemented as a distinct per-error UI; the Activity Drawer's generic "Mostrar Detalhes" toggle auto-opens on ERROR-level logs but there is no dedicated technical-details expansion per error

---

## Phase 7: User Story 5 - Integrated OPL Components & Catalog Discovery (Priority: P3)

**Goal**: Renomear "Essentials" para "Componentes OPL" e integrar a busca de metadados no Catálogo.

**Independent Test**: Access Componentes OPL under Ferramentas to review OPL runtimes; search Catalog to apply metadata/artwork directly to a library game.

### Implementation for User Story 5

- [x] T033 [P] [US5] Create OPL Components list component in `src/components/tools/OplComponentsList.tsx` — UI scaffold only, static mock data; not yet wired to `listEssentialsCatalog`/`registerOfficialOpl`
- [x] T034 [US5] Create Device Diagnostics health check view in `src/components/tools/DeviceDiagnosticsView.tsx`
- [x] T035 [US5] Refactor `src/pages/ToolsPage.tsx` to host sub-tabs — implemented as `Diagnóstico` / `Componentes OPL` (no separate `Utilitários` sub-tab)
- [x] T036 [US5] Refactor `src/pages/CatalogPage.tsx` into a 3-tab hub (`Descobrir & Instalar`, `Metadados & Artes`, `Sincronizar Artes`) embedding the real, previously-orphaned `EssentialsCatalogPage` (game discovery/install to device) and `ArtManagerPage` (`queryArtIndex`/`createArtSyncPlan`/`startArtSync`) — these pages predate this feature and were fully functional but had become unreachable when the redesign's router replaced their routes with redirects; `Metadados & Artes` (single-game cover lookup) remains a static mock

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final design system validation, accessibility checks, and test suite execution

- [ ] T037 [P] Audit dark theme CSS variables (`#0B0B0E`, `#121218`, `#7C3AED`) across all redesigned components — not yet performed as a dedicated pass
- [ ] T038 Execute manual quickstart validation scenarios from `specs/004-ia-ux-redesign/quickstart.md` — only a lightweight smoke test was run (all 6 routes loaded in-browser with no console errors); full scenarios require real device/IPC hardware via Electron and were not run
- [x] T039 Run full automated test suite (`pnpm test:run`) and verify zero typecheck errors (`pnpm build`) — 239/239 tests pass, `tsc --noEmit` clean, `pnpm build` (renderer + electron main/preload) succeeds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational phase.
  - US1 (Device Workspace) and US2 (Unified Library) can be developed in parallel after Phase 2.
  - US3 (Prep Wizard) depends on US1 device state.
  - US4 (Activity Drawer) can run in parallel with US1/US2.
  - US5 (Components & Catalog) can run after US2.
- **Polish (Phase 8)**: Depends on completion of all user stories.

---

## Implementation Strategy & MVP Scope

### MVP Scope (User Story 1 & User Story 2)

1. Complete Setup (Phase 1) & Foundational (Phase 2).
2. Complete User Story 1 (Device Workspace) & User Story 2 (Unified Library + Game Detail Drawer).
3. **VALIDATE**: Run `quickstart.md` Scenarios 1, 2, and 3.
4. Proceed to US3 (Prep Wizard), US4 (Activity Drawer), and US5 (Components/Catalog).
