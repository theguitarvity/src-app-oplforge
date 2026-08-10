# Implementation Plan: Funcionalidades-Chave do Forge no Android

**Branch**: `008-android-forge-essentials` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-android-forge-essentials/spec.md`

## Summary

Extend the existing Android app (spec 006) with the desktop features confirmed to have a real, working implementation: an Essentials game catalog backed by the Internet Archive `playstation2_essentials` collection (browse, Smart Fill, per-item legal confirmation, download), local file import with the same USBExtreme multi-part splitting the desktop uses for oversized files, a Diagnostics screen that formalizes the 7-mandatory-folder + readiness classification the desktop already does, and a durable transfer queue underpinning both download and import so nothing is lost across app restarts or corrupted by concurrent writes. The Component Manager is explicitly excluded — confirmed by code inspection to be a non-functional desktop mockup with nothing real to port. Everything operates on the same SAF-authorized library tree spec 006 already established; no new storage-access model is introduced.

## Technical Context

**Language/Version**: TypeScript 5.x (RN app layer, unchanged) + Kotlin (JVM 17, Android native layer, same toolchain as spec 006/007).

**Primary Dependencies**: OkHttp (HTTP client for the Internet Archive metadata JSON endpoint and per-item HEAD accessibility checks — replaces desktop's `fetch`); WorkManager (Android's durable, process-death-surviving background task API — the mobile equivalent of desktop's persistent download coordinator, since a plain foreground-service-only queue would not survive the same way desktop's Node process + JSON-file-backed coordinator does); Room (extends the spec 006 `AppDatabase` with new tables — no new database).

**Storage**: Same SAF-authorized library tree as spec 006 (read/write now, where spec 006 was read-mostly) + Room for `TransferItem` (persistent queue state), a cached `CatalogListing` index (mirrors desktop's `catalog-source-links.json`, TTL-based refresh), and `DiagnosticsReport` history.

**Testing**: Same layered strategy as spec 006/007 — JUnit for pure logic (IA JSON parsing, game scoring/sorting, USBExtreme layout codec, readiness classification), Android instrumented tests for SAF write paths (import copy, download-to-SAF, concurrent-write rejection), and a WorkManager `TestListenableWorkerBuilder`-based test for queue durability across simulated process death.

**Target Platform**: Same as spec 006 — Android 10+ (API 29+), no iOS.

**Project Type**: Extension of the existing `mobile/` app — no new app, no new repository top-level structure.

**Performance Goals**: SC-001/SC-002 (discover+confirm a download, or import a local file, in under the spec's target time) depend on the IA metadata fetch and SAF copy being non-blocking and cancellable; large-file copies/downloads MUST use chunked/streamed I/O (never buffering a full file in memory), the same discipline spec 006 already established for SMB reads (FR-026 there).

**Constraints**: Legal confirmation text is reused verbatim from the desktop's validated copy (constitution "O Essentials Catalog MUST manter confirmação legal explícita por item"), not reinvented; single-writer-per-file is enforced using the same `WriteLock` primitive spec 007 already rebuilt for SMB writes — extended to cover download/import writers too, so a PS2 SMB read and a Forge-initiated write can never race on the same file; FAT32/exFAT ~4GB file-size ceiling reuses the same USBExtreme multi-part strategy the desktop already validated, ported to Kotlin (not transliterated from the desktop's Node.js `fs`-based implementation, since SAF has no raw file-descriptor-range API the same way — implementation detail for Phase 1).

**Scale/Scope**: Same single-device, single-active-library premise as spec 006; catalog listing size matches the desktop's real Essentials collection (low hundreds of items).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Following spec 006's precedent: the current constitution (v1.0.0) is written in Electron-specific terms; this plan evaluates each principle's **intent**, not its literal text, exactly as spec 006's plan already established as this project's Android reinterpretation pattern.

1. **Principle I — Segurança em Operações Sensíveis** → **PASS**: Downloads/imports require the user to acknowledge ownership/authorization (constitution: "Downloads e importações MUST exigir que o usuário reconheça sua responsabilidade..." — FR-002 here reuses the desktop's exact validated legal-confirmation text, not a new one). No destructive/format operation exists in this feature.
2. **Principle II — Isolamento e Menor Privilégio** → **PASS (reinterpreted, same as spec 006)**: All network/SAF-write access stays behind the same typed TurboModule boundary spec 006 established (`mobile/src/native/`) — new modules (`EssentialsModule`, `TransferModule`, `DiagnosticsModule`) follow the identical pattern, no direct filesystem/network access from RN code.
3. **Principle III — Contratos Tipados e Limites de Camada** → **PASS**: New TurboModule spec files under `mobile/src/native/specs/` extend the existing Codegen contract; new DTOs (`CatalogListing`, `TransferItem`, `DiagnosticsReport`) live in `mobile/src/types/`, naming-compatible with `src/types/opl.ts` concepts (`CatalogGame`, `SmartFillPlan`, `DeviceDiagnostic`, `ReadinessStatus`) without importing from it.
4. **Principle IV — Integridade, Rastreabilidade e Recuperação** → **PASS**: FR-007/FR-011/FR-012 require staging-and-rollback for incomplete writes and a durable, resumable queue — this is the constitution's staging requirement ("Importações e downloads MUST usar staging quando a escrita parcial puder deixar o destino inconsistente") applied via WorkManager + a SAF-side staging convention (mirrors desktop's `.oplforge-staging/` journal pattern, adapted since SAF has no arbitrary hidden-folder guarantee the same way — Phase 1 detail).
5. **Principle V — Evolução Incremental Verificada** → **PASS (with commitment)**: New domain logic (IA JSON parsing/scoring, USBExtreme codec, readiness classifier, write-lock extension) MUST have JUnit tests; SAF write paths MUST have instrumented tests; the transfer queue's durability-across-restart guarantee MUST have a dedicated integration test — same rigor spec 006/007 already established, extended rather than relaxed.

No unjustified violations — Complexity Tracking section below is empty accordingly.

## Project Structure

### Documentation (this feature)

```text
specs/008-android-forge-essentials/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/                       # Phase 1 output
│   └── native-modules.md            # New/extended RN ↔ Kotlin TurboModule contracts
└── tasks.md                         # Phase 2 output (speckit-tasks — not created here)
```

### Source Code (repository root)

```text
mobile/                               # Existing app (spec 006/007) — extended, not replaced
├── android/app/src/main/java/com/oplforge/mobile/
│   ├── essentials/
│   │   ├── EssentialsCatalogClient.kt       # IA metadata JSON fetch (OkHttp) + HEAD accessibility checks
│   │   ├── GameScoring.kt                   # port of desktop's scoreArchiveFile/sortCatalogGames (JUnit-tested)
│   │   ├── SmartFillPlanner.kt              # byte-budget selection (JUnit-tested)
│   │   └── EssentialsModule.kt              # TurboModule: list/search/smartFill/confirmAndEnqueue
│   ├── transfer/
│   │   ├── TransferItemEntity.kt / TransferDao.kt   # Room: persistent queue state
│   │   ├── TransferWorker.kt                # WorkManager Worker: download (HTTP→SAF) or import (SAF→SAF) copy, chunked, resumable
│   │   ├── UsbExtremeCodec.kt               # port of desktop's codec.service.ts (JUnit-tested)
│   │   └── TransferQueueModule.kt           # TurboModule: enqueue/cancel/retry/observe queue
│   ├── diagnostics/
│   │   ├── ReadinessClassifier.kt           # port of desktop's readiness-classifier.ts (JUnit-tested)
│   │   └── DiagnosticsModule.kt             # TurboModule: run diagnostics, reusing CatalogScanner (spec 006)
│   └── shared/
│       └── (extends WriteLock from spec 007 to cover download/import writers, not just SMB)
├── src/
│   ├── native/                        # new typed wrappers: EssentialsModule.ts, TransferModule.ts, DiagnosticsModule.ts
│   ├── types/                         # + CatalogListing, TransferItem, DiagnosticsReport DTOs
│   ├── stores/                        # + essentials-store, transfer-store, diagnostics-store (Zustand, same convention)
│   └── screens/
│       ├── Essentials/                # US1 — catalog browse/search/Smart Fill/legal confirmation
│       ├── Transfers/                 # US4 — queue view with per-item progress/retry
│       └── Diagnostics/               # US3 — readiness report
└── __tests__/
    └── src/                           # + Jest coverage for the 3 new screens/stores
```

**Structure Decision**: Pure extension of the existing `mobile/` app established in spec 006 and rebuilt in spec 007 — same package (`com.oplforge.mobile`), same TurboModule boundary pattern, same Zustand/screens/navigation conventions. No new top-level project. Local import (US2) reuses the `TransferWorker`/queue infrastructure built for US1 (an import is just a same-device SAF→SAF "download" with a `file://`-equivalent source instead of `http://`), so it gets its own screen entry point but not a separate queue mechanism.

## Complexity Tracking

> No unjustified Constitution violations — this section intentionally left empty.
