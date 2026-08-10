# Data Model: Android OPL Network Library

Derived from `spec.md` Key Entities, refined with the platform decisions from `research.md` (SAF-backed library reference, Room for the catalog index, Keystore-backed credentials, Kotlin SMB1 server). Field names favor consistency with `src/types/opl.ts` concepts on desktop (e.g. `GameMediaType`) where the same concept applies, without importing from it — see `plan.md` Structure Decision.

## LibrarySelection

Represents the OPL library the user has authorized on this device (spec FR-001–FR-005). Persisted in the lightweight preferences store (`research.md` R7); the underlying access grant itself is managed by Android (R3), not stored by the app.

| Field             | Type                                                | Notes                                                                                                                                         |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `treeUri`         | `string`                                            | The SAF tree URI returned by `ACTION_OPEN_DOCUMENT_TREE`. Opaque to the UI — never parsed into a POSIX path (FR-001).                         |
| `displayName`     | `string`                                            | Human-readable folder name/path fragment for display only (from `DocumentFile.getName()`/breadcrumb), not used for file operations.           |
| `sourceKind`      | `'internal' \| 'sd-card' \| 'usb-otg' \| 'unknown'` | Best-effort classification for display/diagnostics (FR-005); never gates functionality — SAF access rules are identical regardless of source. |
| `accessGrantedAt` | `string`                                            | ISO timestamp of `takePersistableUriPermission()` success.                                                                                    |
| `accessValid`     | `boolean`                                           | Result of the launch-time cross-check against `getPersistedUriPermissions()` (FR-004). `false` triggers the "access lost" state.              |
| `lastValidatedAt` | `string`                                            | ISO timestamp of the last validity check.                                                                                                     |

**Validation rules**:

- Exactly one `LibrarySelection` is active at a time (spec Assumption: single active library in this MVP).
- Selecting a new library replaces the previous one only via the explicit "change library" action (FR-001/FR-002) — never automatically.
- `accessValid = false` MUST block catalog scanning and sharing start until the user re-selects (FR-004).

## CatalogEntry

Represents one recognized item in the library (spec FR-006–FR-009). Persisted in Room.

| Field               | Type                              | Notes                                                                                           |
| ------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `id`                | `string`                          | Stable per catalog-item identifier (derived from document URI + relative path).                 |
| `contentType`       | `'dvd' \| 'cd' \| 'ps1' \| 'app'` | Derived from which OPL folder (`DVD`/`CD`/`PS1`/`APPS`) the item lives under (FR-006).          |
| `gameId`            | `string \| undefined`             | Extracted from filename when present, OPL Game ID format (e.g. `SLUS_212.59`).                  |
| `title`             | `string`                          | Derived title (from filename, OPL naming convention when conformant).                           |
| `extension`         | `string`                          | File extension/format as found (e.g. `iso`, `bin`, `elf`).                                      |
| `sizeBytes`         | `number`                          | File size in bytes.                                                                             |
| `logicalPath`       | `string`                          | Path relative to the library root (for display/navigation, not a POSIX filesystem path).        |
| `hasArt`            | `boolean`                         | Whether matching art exists under `ART/` (FR-006/FR-008).                                       |
| `namingConformance` | `'conforms' \| 'needs-attention'` | Basic OPL naming-convention check (FR-008).                                                     |
| `structuralIssues`  | `string[]`                        | Non-destructive list of detected problems (FR-009), e.g. `misplaced-folder`, `missing-game-id`. |

**Validation rules**:

- Cataloging MUST NOT alter any underlying file (FR-007/FR-009) — `CatalogEntry` is a read-only derived record.
- An item with unrecoverable ambiguity (can't determine type/location) is still recorded, flagged via `structuralIssues`, never silently dropped (FR-009).

## CatalogSnapshot

Aggregate result of one scan run (spec FR-010). Persisted in Room; a new scan creates a new snapshot rather than mutating a prior one in place, so a cancelled/failed scan never corrupts the last-known-good state.

| Field          | Type                                                 | Notes                                                                    |
| -------------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `id`           | `string`                                             | Snapshot identifier.                                                     |
| `state`        | `'running' \| 'completed' \| 'cancelled' \| 'error'` | Drives the US2/US5 UI.                                                   |
| `startedAt`    | `string`                                             | ISO timestamp.                                                           |
| `completedAt`  | `string \| undefined`                                | ISO timestamp, set on terminal states.                                   |
| `countsByType` | `Record<'dvd' \| 'cd' \| 'ps1' \| 'app', number>`    | Per-type item counts (US2 AS1).                                          |
| `issueCount`   | `number`                                             | Count of entries with `structuralIssues` non-empty or `needs-attention`. |
| `error`        | `SerializableError \| undefined`                     | Set when `state = 'error'`; plain-language per FR-030.                   |

**Relationship**: `CatalogSnapshot (1) ──has many──> CatalogEntry (0..n)`. The Home/Library screens read the latest `completed` (or `running`, for live progress) snapshot's entries.

## SharingSession

Runtime + persisted-config state of the network sharing service (spec FR-013–FR-024). Configuration fields persist across restarts (minus the plaintext password, which lives only in Keystore-backed storage referenced by `credentialRef`); status fields are runtime-only, reset to `off` on process start (FR-032).

| Field                       | Type                                                                                    | Notes                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `state`                     | `'off' \| 'starting' \| 'running-idle' \| 'running-connected' \| 'stopping' \| 'error'` | Matches spec FR-019's minimum state set.                                                                                      |
| `boundAddress`              | `string \| undefined`                                                                   | LAN address actually bound (FR-015/FR-016), shown for PS2 setup (FR-023).                                                     |
| `port`                      | `number \| undefined`                                                                   | Actual bound port.                                                                                                            |
| `shareName`                 | `string`                                                                                | Name presented to the SMB client, user-editable, default derived from device name.                                            |
| `credentialRef`             | `string`                                                                                | Opaque reference into Keystore-backed credential storage (R7) — never the raw username/password (FR-017/FR-030).              |
| `writeAccessAcknowledgedAt` | `string \| undefined`                                                                   | One-time explicit consent required before write access is granted (FR-018); `undefined` blocks write, mirrors desktop FR-014. |
| `startedAt`                 | `string \| undefined`                                                                   | ISO timestamp.                                                                                                                |
| `error`                     | `SerializableError \| undefined`                                                        | Plain-language failure detail (FR-030).                                                                                       |

**Validation rules**:

- `state` MUST NOT transition to `starting`/`running-*` unless `LibrarySelection.accessValid = true` and a `CatalogSnapshot` with `state = 'completed'` exists (edge case: "start sharing without a validated library").
- `state` MUST NOT transition to a write-enabled runtime mode unless `writeAccessAcknowledgedAt` is set (FR-018).
- `credentialRef` MUST be present (username/password set) before `state` can leave `off` (FR-017).
- Transition to `off` MUST NOT happen automatically after process restart from a previously `running-*` state — always starts at `off`, requiring a new explicit user action (FR-032).

## ConnectedClient

A device (typically the PS2) currently or recently connected (spec FR-024). Runtime-only, not persisted beyond the current session.

| Field            | Type                                     | Notes                                                                     |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| `id`             | `string`                                 | Stable per-connection identifier.                                         |
| `remoteAddress`  | `string`                                 | Source IP — also used for the LAN-only enforcement check (FR-015).        |
| `connectedAt`    | `string`                                 | ISO timestamp.                                                            |
| `activity`       | `'idle' \| 'browsing' \| 'transferring'` | Best-effort classification from observed SMB operations.                  |
| `lastActivityAt` | `string`                                 | ISO timestamp, used to age out stale entries after an unclean disconnect. |

## SharingSessionEvent

Pushed from the native (Kotlin) layer to React Native on any state change (spec FR-024, `research.md` R2's typed event-emitter). Mirrors desktop's `NetworkShareEvent` shape.

| Field       | Type                                                                                                              | Notes                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `kind`      | `'state-changed' \| 'client-connected' \| 'client-disconnected' \| 'client-activity-changed' \| 'write-conflict'` |                                                                                                                  |
| `session`   | `SharingSession`                                                                                                  | Full current snapshot, sent with every event (same coarse-grained style as desktop).                             |
| `client`    | `ConnectedClient \| undefined`                                                                                    | Present for client-related event kinds.                                                                          |
| `message`   | `string`                                                                                                          | Human-readable summary (FR-030); for `write-conflict`, identifies the file and which write was applied (FR-033). |
| `timestamp` | `string`                                                                                                          | ISO timestamp.                                                                                                   |

## LocalHistoryEntry

Minimal operation history (spec FR-027), consistent with desktop's `HistoryEntry` concept.

| Field       | Type                                                                                                                      | Notes                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `id`        | `string`                                                                                                                  |                                                              |
| `operation` | `'library-selected' \| 'catalog-scan-completed' \| 'sharing-started' \| 'sharing-stopped' \| 'write-access-acknowledged'` |                                                              |
| `result`    | `'success' \| 'failure'`                                                                                                  |                                                              |
| `message`   | `string`                                                                                                                  | Plain-language summary, never includes credentials (FR-030). |
| `timestamp` | `string`                                                                                                                  | ISO timestamp.                                               |

## Relationships

```
LibrarySelection (1) ──scanned into──> CatalogSnapshot (0..n) ──has many──> CatalogEntry (0..n)
LibrarySelection (1) ──configures────> SharingSession (1, runtime + persisted config)
SharingSession (1) ──has many───────> ConnectedClient (0..n)
SharingSession start/stop/ack ───────> LocalHistoryEntry (append-only)
SharingSession/CatalogSnapshot state changes ──emit──> SharingSessionEvent / CatalogScanEvent (native → RN)
```

No remote backend, no account/user entity — every entity above is local to the device (spec FR-027/FR-031).
