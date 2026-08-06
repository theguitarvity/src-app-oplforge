# Contract: OPL Forge privileged API

## Contract principles

- Types live in `src/types/opl.ts`; every IPC input is schema-validated in the main process.
- Renderer sends opaque IDs plus a selected device ID; main process resolves and revalidates paths.
- No generic filesystem, command execution or arbitrary IPC channel is exposed.
- Long operations return an operation ID and emit typed progress/events.
- Errors are serializable `{ code, message, recoverable, details? }`; stack traces and sensitive paths do not cross by default.
- Mutating calls require a current snapshot/revision and confirmation token where specified.

## Catalog and diagnostics

### `catalog:scan:start`

Input: `{ deviceId, oplProfileId }`

Output: `{ scanId, priorSnapshotId? }`

Effects: read-only. Starts confined recursive scan. Never mutates the device.

### `catalog:scan:cancel`

Input: `{ scanId }`

Output: `{ status: "cancelled"|"already-finished" }`

### `catalog:snapshot:get`

Input: `{ deviceId, oplProfileId, snapshotId?: string }`

Output: complete `CatalogSnapshot | null`. Without snapshot ID, returns current completed snapshot only.

### `catalog:override-game-id`

Input: `{ snapshotId, itemId, gameId, expectedFileIdentity, confirmation: true }`

Output: `{ override, item }`

Validation: normalized ID, current device, unchanged file identity. Writes only application metadata, never the device.

### `catalog:item:hash`

Input: `{ snapshotId, itemId }`

Output: `{ operationId }`. Full hash is streamed and invalidated if identity changes.

### `diagnostics:run`

Input: `{ deviceId, oplProfileId, snapshotId?: string }`

Output: `{ operationId }`

Completion output: `DeviceDiagnostic` with classification, findings and evidence. Unknown mandatory checks cannot yield ready.

## Installation and reorganization

### `installation:plan`

Input: `{ deviceId, sourcePathToken, oplProfileId, requestedFormat?: "ISO"|"ZSO"|"USBExtreme" }`

Output: media/ID evidence, source hash, chosen format, capacity calculation, final display path, warnings and `{ planId, revision }`.

### `installation:confirm`

Input: `{ planId, revision, legalConfirmation: true, replacementConfirmation?: true }`

Output: `{ operationId }`

Preconditions: same device identity/capacity/profile/source; replacement requires explicit token. Completion returns manifest, source/destination hashes, structural and fragmentation evidence.

### `installation:cancel`

Input: `{ operationId }`; output reports transition. Cancellation preserves last valid installation.

### `reorganization:plan`

Input: `{ deviceId, backupDestinationToken, snapshotId }`

Output: inventory, bytes required/available, both resolved display targets, risks and `{ planId, revision }`.

### `reorganization:confirm`

Input: `{ planId, revision, confirmation: true }`; output `{ operationId }`.

Precondition: external destination differs from device and capacity remains sufficient. No rewrite before backup verification.

## Art

### `art:index:refresh`

Input: `{ oplProfileId, sourceId }`; output `{ operationId }` and eventually a versioned source index.

### `art:sync:plan`

Input: `{ snapshotId, itemIds?: string[] }`

Output: per-game IDs/origins, available/existing types, expected downloads/destinations and `{ planId, revision }`.

### `art:sync:confirm`

Input: `{ planId, revision, confirmation: true }`; output `{ operationId }`.

Every asset is staged and PNG-validated. Invalid content never replaces existing valid art.

## OPL profiles

### `opl:profiles:list|get|register-official`

Registration input identifies an official release/commit and selected variant. Output includes exact version, URL, ELF SHA-256, obtained date and capabilities. Installing/updating a memory card is a separate confirmed operation.

### `opl:update:plan`

Input: `{ oplProfileId, memoryCardPathToken }`.

Output: exact release provenance, current/new ELF hashes, cloned target identity, warnings and `{ planId, revision }`. It performs no memory-card mutation.

### `opl:update:confirm`

Input: `{ planId, revision, confirmation: true }`; output `{ operationId }`.

Preconditions: official origin and SHA-256 remain valid, target clone is unchanged and replacement can be staged. Cancellation or validation failure preserves the prior card image.

## PCSX2 and reports

### `pcsx2:detect`

Input: optional user-selected executable token. Output: profiles with exact version, architecture, SHA-256 and support status.

### `validation:plan`

Input: `{ snapshotId, itemId, oplProfileId, pcsx2ProfileId, biosPathToken, memoryCardPathToken, milestone }`

Output: sanitized prerequisites, required space, BIOS hash/region, boot mode options and `{ planId, revision }`. BIOS path/bytes are not returned.

### `validation:start`

Input: `{ planId, revision, confirmation: true, bootMode: "memory-card"|"elf-fallback" }`

Output: `{ runId }`. Creates isolated datapath, cloned card and minimal USB image.

### `validation:checkpoint:confirm`

Input: `{ runId, checkpoint, result: "passed"|"failed"|"not-verified", screenshotToken?, note? }`

Output: updated checkpoint with actor `manual` and evidence hashes.

### `validation:stop`

Input: `{ runId }`; output process/result status and artifact manifest.

### `reports:generate|get|record-hardware-smoke`

Generation input references completed snapshot/diagnostic and optional validation run. Hardware smoke input requires report revision, console/adapter/profile, observations, milestone and confirmation. Output preserves three independent result fields.

## Events

All events include `operationId`, `timestamp` and monotonic `sequence`.

| Event                    | Payload                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `catalog:scan:progress`  | `scanId`, phase, counts, provisional item batch                   |
| `catalog:scan:completed` | `scanId`, new `snapshotId`, diff summary                          |
| `catalog:scan:failed`    | `scanId`, controlled error; prior snapshot remains current        |
| `operation:progress`     | label, phase, percent/bytes when meaningful, cancellable          |
| `operation:completed`    | result reference and warnings                                     |
| `operation:failed`       | controlled error and recovery state                               |
| `validation:checkpoint`  | run ID, step, automation result, evidence, manual action required |
| `validation:process`     | run ID, started/exited/crashed/timeout and sanitized details      |

## Concurrency and staleness

- At most one mutating device operation holds the device lock.
- Scans may be cancelled by mutation; mutation requires a completed current snapshot.
- Every plan is bound to device identity, snapshot/revision, source identity and capacity observation.
- Stale plans fail with `STALE_REVISION`; changed/removed device fails with `DEVICE_CHANGED`.
- Provisional catalog items cannot initiate mutating operations.
