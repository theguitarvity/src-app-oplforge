# Data Model: Funcionalidades-Chave do Forge no Android

Derived from `spec.md` Key Entities, refined with `research.md` decisions. Naming-compatible with `src/types/opl.ts` desktop concepts (`CatalogGame`, `SmartFillPlan`, `DeviceDiagnostic`, `ReadinessStatus`) without importing from it, following spec 006's established pattern.

## CatalogListing

One item in the remote Essentials catalog (spec FR-001–FR-004; desktop's `CatalogGame`/`CatalogSourceLink` merged into one mobile-facing shape).

| Field        | Type                             | Notes                                                                                                     |
| ------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `id`         | `string`                         | Stable per-file identifier (derived from IA identifier + filename, base64url — matches desktop's scheme). |
| `title`      | `string`                         | Cleaned display title (extension/separators stripped, matches desktop's `linkTitle()`).                   |
| `fileName`   | `string`                         | Original filename from the IA listing.                                                                    |
| `url`        | `string`                         | Direct download URL.                                                                                      |
| `sizeBytes`  | `number \| undefined`            | From IA metadata or HEAD `content-length`, whichever is more recent/accurate.                             |
| `mediaType`  | `'ps2-dvd' \| 'ps2-cd' \| 'ps1'` | Drives destination folder (DVD/CD/PS1) on download.                                                       |
| `scoreTier`  | `string`                         | Desktop-equivalent tier (`S`/`A`/`B`/...), used by Smart Fill and default sort.                           |
| `accessible` | `boolean`                        | Result of the last HEAD check (R2).                                                                       |
| `checkedAt`  | `string`                         | ISO timestamp of the last accessibility check.                                                            |

**Validation rules**:

- `accessible: false` items MUST still be visible (so the user understands why something is missing) but MUST NOT be selectable for download (spec edge case).
- The listing is a read-through cache (24h TTL, R2) — never blocks the UI on a network round-trip if a fresh-enough cache exists.

## TransferItem

One queued/active/completed transfer — a download (US1) or a local import (US2); both flow through the same entity (data-model.md R5).

| Field                     | Type                                                           | Notes                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                      | `string`                                                       | Stable identifier, also the WorkManager work name/tag.                                                                                                           |
| `kind`                    | `'download' \| 'import'`                                       | Distinguishes an HTTP source from a local SAF source.                                                                                                            |
| `source`                  | `{ url: string } \| { treeUri: string }`                       | HTTP URL for downloads; a source SAF document URI for imports.                                                                                                   |
| `destinationLogicalPath`  | `string`                                                       | Target path within the library (e.g. `DVD/Title.iso`), same shape as spec 006's `CatalogEntry.logicalPath`.                                                      |
| `title`                   | `string`                                                       | Display title.                                                                                                                                                   |
| `expectedBytes`           | `number \| undefined`                                          | For progress percentage and Smart Fill accounting.                                                                                                               |
| `transferredBytes`        | `number`                                                       | Live progress.                                                                                                                                                   |
| `state`                   | `'queued' \| 'running' \| 'paused' \| 'failed' \| 'completed'` | Drives US4's queue UI.                                                                                                                                           |
| `legalReceiptId`          | `string \| undefined`                                          | Set for `kind: 'download'` items only — proof the per-item legal confirmation (R4) was captured before enqueue.                                                  |
| `partFiles`               | `string[]`                                                     | SAF document URIs of USBExtreme part files, populated only when the item exceeded the destination filesystem's size limit (R7); empty for single-file transfers. |
| `errorMessage`            | `string \| undefined`                                          | Plain-language failure reason (FR-030-equivalent discipline from spec 006 — never a raw stack trace).                                                            |
| `createdAt` / `updatedAt` | `string`                                                       | ISO timestamps.                                                                                                                                                  |

**Validation rules**:

- A `download` item MUST have a `legalReceiptId` before it can transition out of `queued` (FR-002).
- `state` transitions to `running` MUST hold the shared `WriteLock` (R6) for `destinationLogicalPath` for the duration of any write; a second item targeting the same path MUST queue behind it, never write concurrently.
- On `failed`, any partial `partFiles`/destination content MUST be rolled back (deleted), never left as a corrupt partial artifact (FR-007) — mirrors desktop's staging-then-promote journal.
- `state` MUST survive app/process restart unchanged except `running` → `queued` (a transfer that was mid-flight when the process died re-queues rather than claiming to still be running) — this is what makes the queue "durable" per SC-003.

## DiagnosticsReport

Result of one Diagnostics run (spec FR-010; desktop's `DeviceDiagnostic`).

| Field               | Type                                                                              | Notes                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                | `string`                                                                          | Report identifier.                                                                                                       |
| `missingFolders`    | `string[]`                                                                        | Subset of `['DVD','CD','PS1','APPS','ART','CFG','VMC']` not found in the library root.                                   |
| `freeBytes`         | `number \| undefined`                                                             | Free space in the library's filesystem, when obtainable via SAF/`StatFs`.                                                |
| `catalogSnapshotId` | `string`                                                                          | References the `CatalogSnapshot` (spec 006 data-model.md) this report is based on — reuses, doesn't duplicate, the scan. |
| `readiness`         | `'ready' \| 'ready-with-warnings' \| 'requires-reorganization' \| 'incompatible'` | Desktop-parity four-state classification (research.md R8), not a simplified three-state one.                             |
| `checkedAt`         | `string`                                                                          | ISO timestamp.                                                                                                           |

**Relationship**: `DiagnosticsReport (1) ──based on──> CatalogSnapshot (1, spec 006)`. Running Diagnostics does NOT trigger a new catalog scan by itself if a recent-enough completed snapshot already exists — it reuses the latest one, same "don't redo work the user already did" principle as spec 006's `getLatestCompleted()`.

## Relationships

```
CatalogListing (0..n) ──user selects──> TransferItem (kind: download, 0..n)
Local SAF document (chosen via picker) ──user selects──> TransferItem (kind: import, 0..n)
TransferItem completion ──triggers──> re-catalog prompt (reuses spec 006 CatalogModule.startScan(), not duplicated here)
LibrarySelection (1, spec 006) ──diagnosed by──> DiagnosticsReport (0..n)
CatalogSnapshot (1, spec 006) ──feeds──> DiagnosticsReport (0..n)
TransferItem writes / SMB PS2 reads (spec 006/007) ──serialized by──> WriteLock (1, shared singleton, spec 007 extended)
```

No new top-level entity duplicates a spec 006 concept — `CatalogSnapshot`/`CatalogEntry`/`LibrarySelection` are reused as-is; this spec only adds what's genuinely new (remote catalog, transfer queue, diagnostics report).
