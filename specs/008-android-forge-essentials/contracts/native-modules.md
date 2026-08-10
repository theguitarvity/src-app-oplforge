# Contract: React Native ↔ Kotlin Native Module Boundary (Extension)

Extends `specs/006-android-opl-network-library/contracts/native-modules.md` with three new TurboModules. Same rules apply: no method accepts/returns a raw filesystem path (only SAF URIs and logical paths), no method logs/returns a plaintext credential, errors reject with a `SerializableError`-shaped value, long-running state changes are pushed via native events, not polling.

## EssentialsModule (`mobile/src/native/EssentialsModule.ts`)

Backed by `EssentialsCatalogClient.kt` + `GameScoring.kt` + `SmartFillPlanner.kt`.

### `listCatalog(query)`

Request: `{ search?: string; tier?: string; mediaType?: string }` (mirrors desktop's `CatalogQuery`).

Response: `Promise<CatalogListing[]>` — served from the 24h cache (research.md R2) when fresh, otherwise triggers a refresh first.

Errors: `CATALOG_FETCH_FAILED` (network/IA metadata endpoint unreachable — plain-language, never the raw HTTP/parse error).

### `refreshCatalog()`

Forces a re-fetch of the IA metadata listing plus a re-check of per-item accessibility (research.md R2). Response: `Promise<CatalogListing[]>`.

### `createSmartFillPlan(targetBytes)`

Response: `Promise<{ availableBytes: number; selectedItems: CatalogListing[]; estimatedTotalBytes: number; remainingBytes: number; warnings: string[] }>` — mirrors desktop's `SmartFillPlan`, computed against the active library's actual free space (spec 006 `LibrarySelection`).

Errors: `NO_LIBRARY_SELECTED`, `LIBRARY_ACCESS_INVALID` (same fail-fast pattern as spec 006's `CatalogModule.startScan()`).

### `confirmAndEnqueue(items, legalConfirmationText)`

Request: the selected `CatalogListing[]` plus the exact legal confirmation string the user acknowledged (research.md R4 — compared byte-for-byte against the required text).

Response: `Promise<TransferItem[]>` — the newly created queue entries (delegates to `TransferQueueModule` internally; exposed here too since this is the natural call site from the Essentials screen).

Errors: `LEGAL_CONFIRMATION_REQUIRED` (text missing or doesn't match), `INSUFFICIENT_SPACE` (fails fast before any network transfer starts, per spec FR-004).

## TransferQueueModule (`mobile/src/native/TransferModule.ts`)

Backed by `TransferWorker.kt` (WorkManager) + `TransferDao.kt`.

### `enqueueImport(sourceUri, destinationHint)`

Starts a local-file import (US2). `sourceUri` is a SAF document URI returned by the RN-side system file picker; `destinationHint` is an optional user override of the detected content type (dvd/cd/ps1/app), used when detection is ambiguous.

Response: `Promise<TransferItem>`.

Errors: `NO_LIBRARY_SELECTED`, `LIBRARY_ACCESS_INVALID`, `DUPLICATE_ITEM` (FR-009 — same content already present, surfaced before any copy starts, not as a silent overwrite).

### `getQueue()`

Response: `Promise<TransferItem[]>` — current state of all items (any `state`), most recent first.

### `cancel(transferId)` / `retry(transferId)`

Cancels a queued/running item (rolling back any partial write per FR-007), or retries a `failed` item. Both idempotent — calling on an already-terminal item is a no-op success, not an error (same convention as spec 006's `stopSharing()`).

Response: `Promise<TransferItem>`.

### `onTransferQueueEvent(callback)`

Subscribes to per-item progress/state-change events (`{ item: TransferItem; timestamp: string }`), same coarse-grained-snapshot-per-event style as spec 006's `onSharingSessionEvent`/`onCatalogScanEvent`. Returns an unsubscribe function.

## DiagnosticsModule (`mobile/src/native/DiagnosticsModule.ts`)

Backed by `DiagnosticsModule.kt`, reusing spec 006's `CatalogIndexStore`/`CatalogScanner` — does not duplicate scanning logic.

### `runDiagnostics()`

Runs the 7-mandatory-folder check + free-space check, reuses the latest completed `CatalogSnapshot` (triggering a fresh scan only if none exists yet — same fail-fast `NO_LIBRARY_SELECTED`/`LIBRARY_ACCESS_INVALID` errors as spec 006), and classifies readiness (research.md R8, four states).

Response: `Promise<DiagnosticsReport>`.

### `getLatestDiagnosticsReport()`

Response: `Promise<DiagnosticsReport | undefined>` — for the Home screen (spec 006 US5) to optionally surface readiness at a glance without forcing a fresh run.

## Shared constraints (extension-specific)

- `TransferWorker` writes MUST hold the shared `WriteLock` (spec 007, extended per research.md R6) for the full duration of any write to a given `destinationLogicalPath` — this is the same primitive `CommandHandlers.writeAndx` already uses, not a parallel one.
- No method in this contract returns a raw HTTP error body, stack trace, or IA-internal identifier as the primary error payload — same FR-030-equivalent discipline as spec 006.
- `confirmAndEnqueue`'s legal-confirmation check happens in Kotlin (server-side of the bridge), not only in the RN UI — a compromised or buggy RN layer MUST NOT be able to bypass the confirmation requirement, mirroring desktop's `addCatalogGamesToQueue` validating the string itself rather than trusting a boolean flag from the caller.
