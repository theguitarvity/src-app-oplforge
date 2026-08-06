# Tasks: Diagnóstico e correção de fragmentação OPL

**Input**: Design documents from `/specs/002-opl-fragmentation-repair/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/fragmentation-repair-ipc.md`, `quickstart.md`

**Tests**: Obrigatórios por especificação, constituição e risco de integridade. Em cada história, escrever os testes indicados e confirmar que falham antes da implementação correspondente.

**Organization**: As tarefas são agrupadas por história de usuário. Histórias P1 precedem histórias P2; cada fase termina com um checkpoint independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode executar em paralelo por atuar em arquivos distintos e não depender de tarefa incompleta.
- **[Story]**: História coberta pela tarefa.
- Todos os itens possuem caminho de arquivo explícito.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar a estrutura isolada da feature e seus fixtures sem alterar a semântica da reorganização legada.

- [x] T001 Create the fragmentation-repair service barrel and directory structure in electron/services/fragmentation-repair/index.ts
- [x] T002 [P] Create synthetic ISO, ZSO, USBExtreme and failure-fixture documentation in tests/fixtures/fragmentation/README.md
- [x] T003 [P] Create deterministic extent-command golden fixture files in tests/fixtures/fragmentation/extents/linux-filefrag.txt and tests/fixtures/fragmentation/extents/windows-fsutil.txt
- [x] T004 [P] Create the fragmentation-repair UI component barrel in src/components/fragmentation-repair/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contratos, persistência e composição compartilhados por todas as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase.

- [x] T005 Define all shared diagnostic, capability, identity, plan, operation, journal, event, recovery and report types from data-model.md in src/types/opl.ts
- [x] T006 [P] Add strict Zod schemas for every fragmentation-repair request and literal confirmation in electron/ipc/schemas.ts
- [x] T007 [P] Add atomic versioned stores for diagnostics, plans, operations, journals and reports in electron/services/fragmentation-repair/store.ts
- [x] T008 [P] Add stable installation identity, relative-path canonicalization and duplicate Game ID helpers in electron/services/fragmentation-repair/identity.ts
- [x] T009 Implement dependency interfaces and the platform adapter factory including Windows selection in electron/services/fragmentation-repair/runtime.ts
- [x] T010 Scaffold dedicated IPC channel registration and shared controlled error serialization without story handlers in electron/ipc/fragmentation-repair.ipc.ts
- [x] T011 Register the base fragmentation-repair IPC module without starting recovery in electron/main.ts
- [x] T012 Expose only the typed fragmentation-repair methods and event unsubscribe bridge in electron/preload.ts
- [x] T013 Route renderer calls through the typed application API in src/services/api.ts
- [x] T014 [P] Add base contract tests for strict schemas, named channels, preload isolation, confirmation literals and safe errors in tests/contract/fragmentation-repair-ipc.contract.test.ts
- [x] T015 [P] Add unit tests for canonical installation identity, normalized paths and duplicate Game IDs in tests/unit/fragmentation-identity.test.ts

**Checkpoint**: Contratos compilam, inputs inválidos são rejeitados e a feature possui composição própria sem chamar `ReorganizationService`.

---

## Phase 3: User Story 1 - Diagnosticar sem alterar o dispositivo (Priority: P1) 🎯 MVP

**Goal**: Inventariar ISO, ZSO e USBExtreme, produzir os seis estados com evidências e resumo, sem escrever no dispositivo.

**Independent Test**: Executar diagnóstico em fixture com todos os formatos/estados, comparar árvore, hashes e mtimes antes/depois e verificar resumo conciliado.

### Tests for User Story 1

- [x] T016 [P] [US1] Add golden parser and capability-probe tests for Linux, Windows, macOS, malformed output, permission denial and unsupported volumes in tests/unit/fragmentation-capability.test.ts
- [x] T017 [P] [US1] Add state precedence, single-file, multipart partial-state and summary reconciliation tests in tests/unit/fragmentation-diagnostic.test.ts
- [x] T018 [P] [US1] Add read-only ISO, ZSO, USBExtreme, duplicate Game ID and 500-item diagnosis integration tests in tests/integration/fragmentation-diagnosis.test.ts
- [x] T019 [P] [US1] Add renderer tests for loading, empty, six-state, keyboard and accessible diagnostic UI in src/pages/FragmentationRepairPage.test.tsx

### Implementation for User Story 1

- [x] T020 [P] [US1] Strengthen Linux extent parsing with sync-aware complete coverage and adjacency evidence in electron/services/fragmentation/linux.adapter.ts
- [x] T021 [P] [US1] Strengthen Windows VCN/LCN parsing and complete coverage checks in electron/services/fragmentation/windows.adapter.ts
- [x] T022 [P] [US1] Preserve explicit unverifiable capability evidence for macOS in electron/services/fragmentation/macos.adapter.ts
- [x] T023 [US1] Implement the versioned deny-by-default OS/filesystem/tool allowlist and per-volume probe in electron/services/fragmentation-repair/capability-matrix.ts and electron/services/fragmentation-repair/capability.service.ts
- [x] T024 [US1] Implement read-only discovery and structural correlation for ISO, ZSO, exact USBExtreme parts and auxiliary fingerprints in electron/services/fragmentation-repair/diagnostic.service.ts
- [x] T025 [US1] Implement diagnostic state precedence, partial multipart aggregation and summary calculations in electron/services/fragmentation-repair/diagnostic-classifier.ts
- [x] T026 [US1] Compose the diagnostic runtime and wire diagnose/cancel persistence with sequenced progress events in electron/services/fragmentation-repair/runtime.ts and electron/ipc/fragmentation-repair.ipc.ts
- [x] T027 [P] [US1] Implement accessible summary cards and capability limitations in src/components/fragmentation-repair/DiagnosticSummary.tsx
- [x] T028 [P] [US1] Implement accessible per-game evidence table, filters and affected-file details in src/components/fragmentation-repair/GameDiagnosticTable.tsx
- [x] T029 [US1] Implement the independent device-selection and diagnosis journey with React Query in src/pages/FragmentationRepairPage.tsx
- [x] T030 [US1] Add the fragmentation repair route and navigation entry in src/app/main.tsx and src/components/Sidebar.tsx

**Checkpoint**: US1 entrega diagnóstico somente leitura para até 500 jogos, progresso em até 2 segundos e nenhum caminho de correção precisa estar implementado.

---

## Phase 4: User Story 2 - Corrigir um jogo com segurança (Priority: P1)

**Goal**: Planejar, confirmar e corrigir uma ISO ou ZSO individual mantendo a versão válida até prova e commit da candidata.

**Independent Test**: Corrigir separadamente ISO e ZSO fragmentadas, validar confirmação, tamanho, SHA-256, estrutura, extents, promoção tardia, auxiliares intocados e relatório final.

### Tests for User Story 2

- [x] T031 [P] [US2] Add plan eligibility, immutable revision, `max(64 MiB, 2%)` space-margin boundaries, stale source and confirmation tests in tests/unit/fragmentation-plan.test.ts
- [x] T032 [P] [US2] Add transaction state, candidate validation, still-fragmented, hash mismatch and promotion-gate tests in tests/unit/fragmentation-transaction.test.ts
- [x] T033 [P] [US2] Add ISO/ZSO success with mandatory final rediagnosis, insufficient space, file lock, source mutation and auxiliary-preservation integration tests in tests/integration/fragmentation-repair.test.ts
- [x] T034 [P] [US2] Add plan/confirm/cancel and report response contract cases in tests/contract/fragmentation-repair-ipc.contract.test.ts
- [x] T035 [P] [US2] Add keyboard, focus, explicit literal confirmation and failure-message UI tests in src/pages/FragmentationRepairPage.test.tsx

### Implementation for User Story 2

- [x] T036 [US2] Implement single-game eligibility, exclusions, candidate bytes plus `max(64 MiB, 2%)` free-space calculation and immutable plan persistence in electron/services/fragmentation-repair/plan.service.ts
- [x] T037 [US2] Implement durable monotonic journal transitions with temp-write, file sync, atomic rename and directory sync in electron/services/fragmentation-repair/journal.store.ts
- [x] T038 [US2] Implement same-filesystem exclusive candidate streaming, sync, size, SHA-256 and structural validation in electron/services/fragmentation-repair/candidate.service.ts
- [x] T039 [US2] Implement preflight revalidation under device lock for root identity, paths, fingerprints, capability, locks and space in electron/services/fragmentation-repair/transaction.service.ts
- [x] T040 [US2] Implement commit-intent, original backup rename, candidate promotion, active revalidation and safe cleanup for ISO/ZSO in electron/services/fragmentation-repair/transaction.service.ts
- [x] T041 [US2] Implement mandatory terminal rediagnosis before every success, failure or cancellation report plus per-game states, hashes, modified files and recovery instructions in electron/services/fragmentation-repair/report.service.ts
- [x] T042 [US2] Compose the individual-repair runtime and wire plan/confirm/cancel/get-operation/get-report handlers in electron/services/fragmentation-repair/runtime.ts and electron/ipc/fragmentation-repair.ipc.ts
- [x] T043 [P] [US2] Implement plan risks, files, space, recovery and explicit confirmation dialog in src/components/fragmentation-repair/RepairPlanDialog.tsx
- [x] T044 [P] [US2] Implement sequenced per-game progress, cancellation state and terminal result view in src/components/fragmentation-repair/RepairProgress.tsx
- [x] T045 [US2] Integrate individual repair actions, stale-plan refresh and report display in src/pages/FragmentationRepairPage.tsx

**Checkpoint**: US2 corrige ISO/ZSO individualmente e nunca declara sucesso quando a candidata permanece fragmentada ou diverge da origem.

---

## Phase 5: User Story 5 - Interromper com recuperação segura (Priority: P1)

**Goal**: Sobreviver a cancelamento, crash, remoção, falhas de I/O e journal ambíguo sem auto-retomar ou eliminar a última versão válida.

**Independent Test**: Injetar falha em cada boundary do journal, reiniciar/reconectar e provar original restaurado/preservado ou `recovery-pending` com instruções, nunca promoção automática.

### Tests for User Story 5

- [x] T046 [P] [US5] Add valid, torn, corrupt and monotonic journal migration tests in tests/unit/fragmentation-journal.test.ts
- [x] T047 [P] [US5] Add idempotent rollback, post-commit cleanup and ambiguous-authority tests in tests/unit/fragmentation-recovery.test.ts
- [x] T048 [P] [US5] Add kill, unplug, read/write failure, cancellation boundary, restart recovery and accessible-item final-rediagnosis integration tests in tests/integration/fragmentation-recovery.test.ts
- [x] T049 [P] [US5] Add list/resolve recovery authorization and manual-recovery contract tests in tests/contract/fragmentation-repair-ipc.contract.test.ts

### Implementation for User Story 5

- [x] T050 [US5] Implement state-aware cancellation that aborts before commit-intent and rolls back after it in electron/services/fragmentation-repair/transaction.service.ts
- [x] T051 [US5] Implement startup/reconnect journal discovery, authoritative-original selection and idempotent rollback in electron/services/fragmentation-repair/recovery.service.ts
- [x] T052 [US5] Implement recovery-pending handling for absent devices, corrupt journals, failed rollback and safe residue cleanup in electron/services/fragmentation-repair/recovery.service.ts
- [x] T053 [US5] Compose recovery runtime, register startup/reconnect recovery in electron/main.ts and wire list/resolve IPC with `RECUPERAR JOGO` confirmation in electron/ipc/fragmentation-repair.ipc.ts
- [x] T054 [US5] Add recovery banner, instructions and authorized actions to src/pages/FragmentationRepairPage.tsx

**Checkpoint**: US5 prova recovery idempotente em todos os estados; qualquer ambiguidade conserva dados e exige ação manual.

---

## Phase 6: User Story 3 - Corrigir todos os jogos elegíveis (Priority: P2)

**Goal**: Executar um plano consolidado sequencial, revalidar espaço por jogo, isolar falhas seguras e conciliar todos os resultados.

**Independent Test**: Processar três jogos onde o primeiro conclui, o segundo está bloqueado e o terceiro perde espaço, verificando um candidato por vez e relatório completo.

### Tests for User Story 3

- [x] T055 [P] [US3] Add deterministic ordering, one-active-item, per-item space recheck and failure-continuation unit tests in tests/unit/fragmentation-batch.test.ts
- [x] T056 [P] [US3] Add mixed-outcome sequential batch, cancellation and per-accessible-item final-rediagnosis integration tests in tests/integration/fragmentation-batch.test.ts
- [x] T057 [P] [US3] Add batch selection, exclusions, consolidated plan and per-item result UI tests in src/pages/FragmentationRepairPage.test.tsx

### Implementation for User Story 3

- [x] T058 [US3] Implement batch target expansion, deterministic order, exclusions and peak temporary space in electron/services/fragmentation-repair/plan.service.ts
- [x] T059 [US3] Implement strictly sequential orchestration, per-item preflight and safe continuation rules in electron/services/fragmentation-repair/batch.service.ts
- [x] T060 [US3] Implement batch result reconciliation for corrected, unchanged, skipped, failed, cancelled and recovery-pending items in electron/services/fragmentation-repair/report.service.ts
- [x] T061 [US3] Wire batch mode and event sequencing through electron/ipc/fragmentation-repair.ipc.ts
- [x] T062 [US3] Add `Corrigir todos`, consolidated plan, exclusions and per-item progress to src/pages/FragmentationRepairPage.tsx

**Checkpoint**: US3 mantém uma única transação ativa, não perde resultados e não continua quando o dispositivo ou recovery deixam de estar seguros.

---

## Phase 7: User Story 4 - Preservar instalações USBExtreme (Priority: P2)

**Goal**: Corrigir somente partes USBExtreme fragmentadas como grupo lógico, mantendo partes contíguas e `ul.cfg` consistentes.

**Independent Test**: Corrigir uma instalação de três partes com duas fragmentadas e injetar falha em cada rename, provando conjunto original válido ou recovery explícito.

### Tests for User Story 4

- [x] T063 [P] [US4] Add exact ul.cfg entry/path-set correlation, duplicate Game ID and multipart eligibility tests in tests/unit/fragmentation-usbextreme.test.ts
- [x] T064 [P] [US4] Add multipart candidate grouping, partial fragmentation and ul.cfg-last state-machine tests in tests/unit/fragmentation-transaction.test.ts
- [x] T065 [P] [US4] Add multipart success and fault injection after every journal/rename boundary in tests/integration/fragmentation-usbextreme.test.ts
- [x] T066 [P] [US4] Add USBExtreme part evidence and ul.cfg action rendering tests in src/pages/FragmentationRepairPage.test.tsx

### Implementation for User Story 4

- [x] T067 [US4] Extend diagnosis to correlate exact ul.cfg records with normalized part sets and reject shared-part collisions in electron/services/fragmentation-repair/diagnostic.service.ts
- [x] T068 [US4] Extend planning to select only fragmented parts and justify any indispensable ul.cfg action in electron/services/fragmentation-repair/plan.service.ts
- [x] T069 [US4] Implement all-candidates-before-commit multipart promotion, untouched contiguous parts and ul.cfg-last rollback in electron/services/fragmentation-repair/transaction.service.ts
- [x] T070 [US4] Extend recovery to validate complete part sets and restore exact ul.cfg authority in electron/services/fragmentation-repair/recovery.service.ts
- [x] T071 [US4] Add multipart part/evidence/ul.cfg details to src/components/fragmentation-repair/GameDiagnosticTable.tsx and src/components/fragmentation-repair/RepairPlanDialog.tsx

**Checkpoint**: US4 nunca mistura instalações por Game ID, nunca regrava partes contíguas e mantém `ul.cfg` consistente após sucesso ou falha.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Segurança, observabilidade, desempenho, documentação e gates finais da feature completa.

- [x] T072 [P] Add redacted audit events and history entries for diagnosis, confirmation, outcomes and recovery in electron/services/fragmentation-repair/audit.service.ts
- [x] T073 [P] Add renderer event ordering, reconnect refresh and listener-cleanup regression tests in src/pages/FragmentationRepairPage.test.tsx
- [x] T074 [P] Add traversal, symlink swap, remount identity, event-data leakage and unauthorized cleanup regressions in tests/integration/fragmentation-security.test.ts
- [x] T075 Add bounded-concurrency diagnosis, streaming backpressure and two-second initial progress optimizations in electron/services/fragmentation-repair/diagnostic.service.ts
- [x] T076 [P] Document matrix schema/version, certified OS/filesystem/tool combinations, deny-by-default behavior and macOS limitation in docs/fragmentation-repair-support.md
- [ ] T077 Execute all nine validation scenarios plus a moderated usability study with at least 10 representative users, record the shared script, participant outcomes and 90% success calculation in specs/002-opl-fragmentation-repair/validation-results.md
- [x] T078 Run `pnpm build`, `pnpm lint`, `pnpm test:unit`, `pnpm test:contract` and `pnpm test:integration` and record any approved exception in specs/002-opl-fragmentation-repair/validation-results.md
- [x] T079 Re-audit constitutional gates, scope of modified files and auxiliary hashes in specs/002-opl-fragmentation-repair/validation-results.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: sem dependências.
- **Phase 2 — Foundational**: depende da Phase 1 e bloqueia todas as histórias.
- **Phase 3 — US1**: depende da fundação; entrega o MVP somente leitura.
- **Phase 4 — US2**: depende da fundação e usa snapshots produzidos por US1.
- **Phase 5 — US5**: depende do journal/transação de US2; deve terminar antes de habilitar correção em produção.
- **Phase 6 — US3**: depende da transação individual US2 e das garantias de US5.
- **Phase 7 — US4**: depende da transação individual US2 e das garantias de US5; pode ocorrer em paralelo com US3.
- **Phase 8 — Polish**: depende de todas as histórias incluídas no release.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (diagnóstico/MVP)
                       ↓
                      US2 (correção individual)
                       ↓
                      US5 (recovery seguro)
                       ├────────→ US3 (lote)
                       └────────→ US4 (USBExtreme)
                                      ↓
                                    Polish
```

### Story Independence

- **US1** é demonstrável isoladamente e não escreve no dispositivo.
- **US2** usa um diagnóstico como entrada, mas pode ser testada com snapshot fixture sem UI de US1.
- **US5** usa uma transação/journal fixture e pode ser testada sem lote ou USBExtreme.
- **US3** usa a operação individual como unidade e pode ser testada somente com ISO/ZSO.
- **US4** usa a mesma transação individual e pode ser testada sem lote.

### Within Each Story

1. Escrever testes e confirmar falha.
2. Implementar modelos/regras locais.
3. Implementar serviço privilegiado.
4. Integrar IPC/preload/API.
5. Integrar UI.
6. Executar o independent test e preservar regressões anteriores.

## Parallel Opportunities

- Setup T002–T004 pode ocorrer em paralelo após T001.
- Fundação T006–T008, T014 e T015 atua em arquivos distintos; T009–T013 seguem a cadeia de composição.
- Em US1, T016–T019 e adapters T020–T022 são paralelos; UI T027/T028 é paralela após os tipos.
- Em US2, T031–T035 são paralelos; T043/T044 podem avançar após contrato/tipos enquanto serviços T036–T041 são implementados.
- Em US5, T046–T049 são paralelos; recovery T051/T052 segue o journal e a transação.
- US3 e US4 podem avançar em paralelo depois de US5, evitando edição simultânea dos arquivos compartilhados `plan.service.ts`, `transaction.service.ts`, `report.service.ts` e `FragmentationRepairPage.tsx`.
- Polish T072–T074 e T076 pode ocorrer em paralelo; gates T077–T079 são finais.

## Parallel Example: User Story 1

```text
Task T016: capability/parser tests in tests/unit/fragmentation-capability.test.ts
Task T017: classifier tests in tests/unit/fragmentation-diagnostic.test.ts
Task T018: read-only integration in tests/integration/fragmentation-diagnosis.test.ts
Task T019: renderer tests in src/pages/FragmentationRepairPage.test.tsx
Task T020: Linux adapter in electron/services/fragmentation/linux.adapter.ts
Task T021: Windows adapter in electron/services/fragmentation/windows.adapter.ts
Task T022: macOS adapter in electron/services/fragmentation/macos.adapter.ts
```

## Parallel Example: User Story 2

```text
Task T031: planner unit tests in tests/unit/fragmentation-plan.test.ts
Task T032: transaction unit tests in tests/unit/fragmentation-transaction.test.ts
Task T033: repair integration tests in tests/integration/fragmentation-repair.test.ts
Task T034: IPC contract tests in tests/contract/fragmentation-repair-ipc.contract.test.ts
Task T035: confirmation UI tests in src/pages/FragmentationRepairPage.test.tsx
```

## Parallel Example: User Story 5

```text
Task T046: journal corruption/migration tests in tests/unit/fragmentation-journal.test.ts
Task T047: rollback unit tests in tests/unit/fragmentation-recovery.test.ts
Task T048: crash/unplug integration in tests/integration/fragmentation-recovery.test.ts
Task T049: recovery IPC contract tests in tests/contract/fragmentation-repair-ipc.contract.test.ts
```

## Parallel Example: User Story 3

```text
Task T055: batch unit tests in tests/unit/fragmentation-batch.test.ts
Task T056: batch integration tests in tests/integration/fragmentation-batch.test.ts
Task T057: batch UI tests in src/pages/FragmentationRepairPage.test.tsx
```

## Parallel Example: User Story 4

```text
Task T063: USBExtreme identity tests in tests/unit/fragmentation-usbextreme.test.ts
Task T064: multipart transaction tests in tests/unit/fragmentation-transaction.test.ts
Task T065: USBExtreme fault injection in tests/integration/fragmentation-usbextreme.test.ts
Task T066: multipart UI tests in src/pages/FragmentationRepairPage.test.tsx
```

## Implementation Strategy

### MVP First — User Story 1

1. Complete Setup and Foundational phases.
2. Implement US1 diagnosis only.
3. Validate that the device tree, hashes and mtimes are unchanged.
4. Demo six states, summary, evidence and unsupported-platform behavior.
5. Do not expose repair actions yet.

### Safe Incremental Delivery

1. **MVP**: US1 read-only diagnosis.
2. **Controlled repair**: US2 behind explicit confirmation and capability gate.
3. **Production safety gate**: US5 recovery before enabling repair outside tests.
4. **Efficiency**: US3 sequential batch.
5. **Format completeness**: US4 multipart USBExtreme.
6. **Release**: Polish, real-volume certification and all quality gates.

### Parallel Team Strategy

After the foundation, one stream may implement US1 while another prepares failing US2 tests. After US5, US3 and US4 can proceed in parallel, but edits to shared services must be serialized or split into dedicated collaborators to avoid conflicts.

## Notes

- `[P]` never implies editing the same file concurrently.
- Tests precede the implementation they validate.
- No task authorizes formatting, generic defragmentation or weakening OPL checks.
- Legacy `ReorganizationService` remains unchanged.
- Real FAT32/exFAT certification is a release gate, not a substitute for automated tests.
- Commit after each task or coherent task group and stop at any checkpoint for independent validation.
