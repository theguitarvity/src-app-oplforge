# Research: Funcionalidades-Chave do Forge no Android

All items below were resolved by reading the desktop implementation directly (not guessed), since this feature ports real, already-validated desktop behavior rather than designing new domain logic from scratch.

## R1: Essentials catalog data source and protocol

**Decision**: Fetch `GET https://archive.org/metadata/playstation2_essentials` (Internet Archive's metadata JSON API — not HTML directory scraping), parse the `files[]` array (`name`, `size`, `mtime` fields), filter to supported extensions (`.iso`, `.bin`, `.cue`, `.torrent`, `.zip`, `.7z`), classify media type by filename pattern (`.iso` → `ps2-dvd`/`ps2-cd` by `(cd)`/`[cd]` marker in the name, `.bin`/`.cue` → `ps1`), and build direct download URLs as `https://archive.org/download/playstation2_essentials/<name>`.

**Rationale**: This is exactly what `InternetArchiveDirectoryProvider.ts` does on desktop — a plain JSON GET, no scraping, no auth. Directly reusable on Android via any HTTP client (OkHttp) + `kotlinx.serialization`/`org.json`.

**Alternatives considered**: None — this is a straight port of a working, validated integration; inventing a different protocol would be unjustified complexity per Constitution Principle V.

## R2: Per-item accessibility verification

**Decision**: `HEAD` each candidate file URL (8s timeout, 8-way concurrency) before showing it as downloadable, caching the result (`accessible`, `statusCode`, resolved `content-length`) for 24h, matching desktop's `checkLink()`/`getEssentialsSourceLinks()` TTL.

**Rationale**: Desktop already learned that IA links occasionally 404/expire; checking before offering a download avoids wasted user taps and matches spec 008 edge case ("item não estiver mais disponível").

## R3: Game scoring/sorting and Smart Fill

**Decision**: Port `scoreArchiveFile`/`sortCatalogGames` (tiering S/A/B/... by some desktop-defined heuristic) and `createSmartFillPlan` (greedy fill of S/A-tier games up to an available-bytes budget, deduplicated by normalized title) verbatim in logic, as pure Kotlin functions with no Android framework dependency — fully unit-testable without instrumentation.

**Rationale**: This is pure domain logic already validated on desktop; re-deriving different scoring rules would create a confusing mismatch between platforms for the same catalog.

**Open question for Phase 1 data-model**: the exact scoring formula (`GameScoringService.ts`) needs to be read in full during implementation to port faithfully — not resolved here since it's implementation detail, not a planning decision.

## R4: Legal confirmation text

**Decision**: Reuse the desktop's exact validated string verbatim: _"Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup."_ — the mobile UI presents this as an explicit per-item checkbox/dialog, and the native module rejects the enqueue call if the confirmation string doesn't match exactly, mirroring desktop's `addCatalogGamesToQueue` validation.

**Rationale**: Constitution: "O Essentials Catalog MUST manter confirmação legal explícita por item antes do enfileiramento" — this is a compliance-relevant string, not UI copy to be reworded per-platform.

## R5: Durable transfer queue mechanism

**Decision**: Android `WorkManager` (`androidx.work`), one `TransferWorker` (`CoroutineWorker`) per queued item, backed by a Room `TransferItemEntity` table as the source of truth for queue state (WorkManager's own state is ephemeral/opaque; Room gives us the same durable, inspectable state desktop's JSON-file-backed coordinator provides). Progress is reported via `setProgressAsync`, observed by the `TransferQueueModule` TurboModule via `WorkManager.getWorkInfosByTagLiveData` and re-emitted as `TransferQueueEvent` (same coarse-grained-snapshot style as spec 006's `SharingSessionEvent`).

**Rationale**: WorkManager is Android's standard mechanism for guaranteed, deferrable, retryable background work that survives process death and reboots (with `setRequiresStorageNotLow`/network constraints available for free) — the direct platform equivalent of desktop's persistent download coordinator running in the long-lived Electron main process. A plain coroutine in the existing `SharingForegroundService`-style Foreground Service would not survive app-swipe-away the same way.

**Alternatives considered**: A custom Foreground Service queue (rejected — WorkManager already solves persistence/retry/constraints, reinventing it would violate Principle V's "complexidade adicional MUST ser justificada"); JobScheduler directly (rejected — WorkManager is the modern wrapper Google recommends, better testability via `WorkManagerTestInitHelper`).

## R6: Single-writer-per-file across SMB and downloads/imports

**Decision**: Extend spec 007's `WriteLock` (currently scoped to SMB `WRITE_ANDX` handling) to also guard `TransferWorker`'s SAF writes — same `withWriteLock(path) { ... }` primitive, same conflict-detection semantics, keyed by the SAF document URI string. `TransferWorker` acquires the lock for the destination path before writing; the SMB `CommandHandlers.writeAndx` already does the same. Since both paths funnel through one shared `WriteLock` instance (already a companion/singleton in `SharingForegroundService`), no new coordination primitive is needed.

**Rationale**: FR-012/FR-013 and the constitution's write-safety requirements are the same problem spec 007 already solved for PS2-initiated writes; reusing it is the minimal-complexity choice.

## R7: USBExtreme multi-part splitting on SAF

**Decision**: Port `usbextreme/codec.service.ts`'s layout logic (splitting an oversized image into multiple `.XXX` part files plus a `ul.cfg` entry) as pure Kotlin (no Android framework dependency, JUnit-testable), but the actual byte-range writes go through `DocumentFile`/`ContentResolver.openFileDescriptor` (SAF) instead of desktop's raw `fs.createWriteStream` — SAF has no direct "write byte range N to N+k of file at path" API the way POSIX does, so each part is written as its own complete SAF document from a chunked read of the source, not a seek-and-write into a single pre-allocated file.

**Rationale**: This is the one place where the Android storage model genuinely differs from desktop's direct filesystem access, and the difference needs to be visible in the plan rather than papered over — Phase 1 data-model documents `TransferItem`'s part-file bookkeeping explicitly for this reason.

## R8: Readiness classification parity

**Decision**: Port `readiness-classifier.ts`'s four-state model verbatim — `ready` | `ready-with-warnings` | `requires-reorganization` | `incompatible` — not the three states informally described in spec.md's user-facing language ("pronta / precisa atenção / não pronta"). The spec's FR-010 explicitly requires "consistente com os mesmos critérios do desktop," so the real four-state desktop model wins; the UI can still group `requires-reorganization` and `incompatible` under a single "não pronta"-style visual treatment if that reads better, but the underlying classification MUST match desktop's logic exactly, not a simplified reinterpretation.

**Rationale**: Avoids two different "is my library ready" answers between desktop and mobile for the same underlying data shape.

## R9: Testing strategy

**Decision**: Same four-layer strategy as spec 006/007 — (1) JUnit for `GameScoring`, `SmartFillPlanner`, `UsbExtremeCodec`, `ReadinessClassifier` (all pure Kotlin); (2) Android instrumented tests for SAF write paths (import copy produces byte-identical content, concurrent-write rejection via `WriteLock`, USBExtreme part files land in the right SAF folder); (3) a WorkManager integration test using `TestListenableWorkerBuilder`/`WorkManagerTestInitHelper` to prove a queued item survives a simulated process restart; (4) Jest for the three new RN screens/stores, following the existing mock-the-native-wrapper pattern from spec 006's `Tutorial.test.tsx`/`Library.test.tsx`.

**Rationale**: Proportional to risk per Constitution Principle V — no new testing philosophy invented, same one already working for this codebase.
