# Validation Results: Diagnóstico e correção de fragmentação OPL

**Date**: 2026-08-02
**Branch**: `002-opl-fragmentation-repair`
**Status**: Automated validation passed; real-volume certification and moderated usability study pending external execution

## Quality Gates

| Gate                  | Result | Evidence                                                       |
| --------------------- | ------ | -------------------------------------------------------------- |
| Build and typecheck   | PASS   | `pnpm build`; Vite and Electron bundles generated successfully |
| Lint                  | PASS   | `pnpm lint`; zero errors                                       |
| Unit tests            | PASS   | `pnpm test:unit`; 26 files, 74 tests                           |
| Contract tests        | PASS   | `pnpm test:contract`; 7 files, 19 tests                        |
| Integration tests     | PASS   | `pnpm test:integration`; 15 files, 28 tests                    |
| Full regression suite | PASS   | `pnpm test:run`; 50 files, 135 tests                           |
| Diff whitespace check | PASS   | `git diff --check`                                             |

The production build emitted the existing non-blocking Vite chunk-size warning for the main renderer bundle. No exception is required because the build completed and the feature performance test measures initial progress independently.

## Quickstart Scenarios

| Scenario                      | Automated status | Evidence                                                                                                                               | External evidence still required                                              |
| ----------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1. Read-only diagnosis        | PASS             | `fragmentation-diagnosis.test.ts`, classifier and renderer tests prove six states, summary, 500 items and unchanged hashes/mtimes/tree | None                                                                          |
| 2. Plan and confirmation      | PASS             | planner, IPC contract and renderer tests cover stale revision, one-use plan and exact literals                                         | None                                                                          |
| 3. ISO/ZSO repair             | PASS             | `fragmentation-repair.test.ts` and transaction tests cover candidate validation, promotion and auxiliary preservation                  | Real removable-volume smoke before certification                              |
| 4. Persistent fragmentation   | PASS             | transaction tests reject `STILL_FRAGMENTED` without promotion                                                                          | None                                                                          |
| 5. Sequential batch           | PASS             | batch unit/integration/UI tests cover one active item, space recheck and mixed outcomes                                                | None                                                                          |
| 6. Multipart USBExtreme       | PASS             | USBExtreme unit/integration/UI tests cover partial parts, `ul.cfg` last and fault boundaries                                           | Real removable-volume smoke before certification                              |
| 7. Crash, unplug and recovery | PASS             | recovery journal/unit/integration tests cover interruption, absent device, rollback and no auto-promotion                              | Physical unsafe-unplug exercise before certification                          |
| 8. Capability matrix          | PARTIAL          | Golden Linux/Windows parsers, malformed output, permission errors, macOS blocked and deny-by-default matrix pass                       | Certification on real FAT32/exFAT volumes for each OS/tool/driver combination |
| 9. UI and accessibility       | PASS automated   | 13 renderer tests cover keyboard, focus, names, progress, event ordering, reconnect and cleanup                                        | Moderated study below                                                         |

## Moderated Usability Study — Pending

T077 cannot be completed without at least 10 representative human participants. No participant or result has been simulated.

Use one shared script for every participant:

1. Select the prepared removable-device fixture.
2. Identify all fragmented or partially fragmented games.
3. Explain the free-space requirement and one exclusion from the plan.
4. Initiate an individual correction using the explicit confirmation.
5. Return to the diagnosis and choose whether to initiate or cancel the batch action.

Record for each participant: anonymous participant ID, representative-user rationale, completion of each step without help, observed failure point, elapsed time and notes. T077 passes only if at least 9 of 10 participants complete the required journey without external help. Store no personal data beyond what is necessary for the study.

## Constitutional Re-audit

| Principle/gate                       | Result | Evidence                                                                                                                         |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Sensitive-operation confirmation     | PASS   | Strict plan/recovery literals, revision checks and UI focus/gating tests                                                         |
| Isolation and least privilege        | PASS   | Filesystem/tool access remains in main process; narrow preload methods; IPC schemas reject unknown/unsafe input                  |
| Typed contracts and layer boundaries | PASS   | Shared `OplApi` types, Zod handlers and renderer access through `src/services/api.ts`                                            |
| Integrity, traceability and recovery | PASS   | Same-filesystem candidates, durable journal, late promotion, rollback, recovery-pending, redacted audit and terminal rediagnosis |
| Incremental verified evolution       | PASS   | Unit, contract, integration, renderer, security, performance and full regression suites pass                                     |
| Safe paths and authorized scope      | PASS   | Traversal, symlink swap, remount and unauthorized cleanup regressions pass                                                       |
| Platform limitations                 | PASS   | Deny-by-default versioned matrix and macOS limitation documented in `docs/fragmentation-repair-support.md`                       |

No constitutional exception was used.

## Modified Scope Audit

Feature-specific code is confined to:

- `electron/services/fragmentation-repair/`
- `electron/ipc/fragmentation-repair.ipc.ts`
- `src/components/fragmentation-repair/`
- `src/pages/FragmentationRepairPage.tsx`
- fragmentation-specific tests and fixtures
- `docs/fragmentation-repair-support.md`

Shared integration points are limited to `electron/main.ts`, `electron/preload.ts`, `electron/ipc/schemas.ts`, `src/types/opl.ts`, `src/services/api.ts`, `src/app/main.tsx` and `src/components/Sidebar.tsx`. The legacy `ReorganizationService` was not changed for this feature.

## Auxiliary Preservation Evidence

- Diagnosis integration tests compare the device tree, hashes and mtimes before and after read-only scans.
- Individual repair integration tests assert ART/CFG and unrelated files remain unchanged.
- USBExtreme tests assert contiguous parts are not rewritten and `ul.cfg` changes only when explicitly justified.
- Security tests assert modified paths remain relative and sensitive absolute paths are redacted from events/audit.

## Release Blockers

1. Complete the moderated usability study with at least 10 representative users and a success rate of at least 90%.
2. Certify every enabled OS/filesystem/tool/driver combination on disposable real FAT32/exFAT media, including safe-unplug recovery. Until then the deny-by-default capability matrix must not claim broader support.
