# Data Model: PS2 Network Library Sharing

Derived from `spec.md` Key Entities, refined with the protocol decisions from `research.md` (SMB1-minimal + FTP via `ftp-srv`, both in-process, local-network-only).

> **Naming note**: `spec.md`'s Key Entities section calls these `SharingService` and `SharedLibraryConfig`. Below, `SharingService` is split into `NetworkShareStatus` (aggregate) + `ProtocolStatus` (per-protocol), and `SharedLibraryConfig` is named `NetworkShareConfig`, to match this codebase's naming conventions (`Network*` prefix mirrors the `network-share:*` IPC channel namespace). Same entities, refined names.

## NetworkShareConfig

Persisted configuration for the sharing feature, tied to the existing local library (not a copy of it).

| Field                       | Type                  | Notes                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `libraryRootPath`           | `string`              | Absolute path of the device the user has active in `useDeviceStore` at save time — sent explicitly by the renderer (`SaveNetworkShareConfigInput.libraryRootPath`), never re-derived by the main process. Empty string means no device has been selected yet. |
| `enabledProtocols`          | `('smb' \| 'ftp')[]`  | Which of the two servers should be running. SMB and FTP can be toggled independently.                                                                                                                                                                         |
| `shareName`                 | `string`              | Name presented to SMB/FTP clients (default derived from hostname, user-editable).                                                                                                                                                                             |
| `username`                  | `string`              | Required (per FR-010). Validated non-empty.                                                                                                                                                                                                                   |
| `password`                  | `string`              | Required. Stored via the existing OS-level secret storage already used elsewhere in the app if present; otherwise local encrypted-at-rest config — **not** plaintext JSON (Constitution Principle IV: no secrets in logs/plain persistence).                  |
| `smbPort`                   | `number`              | Default `445`.                                                                                                                                                                                                                                                |
| `ftpPort`                   | `number`              | Default `21` (plus a passive-mode port range for `ftp-srv`).                                                                                                                                                                                                  |
| `autoStartOnLaunch`         | `boolean`             | Default `false` — sharing is off by default per FR-007/SC-005; this only controls whether the _last known on_ state resumes automatically, and only if the user has explicitly opted in.                                                                      |
| `writeAccessAcknowledgedAt` | `string \| undefined` | ISO timestamp of the one-time explicit acknowledgment required by FR-014 before write access is granted. `undefined` means not yet acknowledged — sharing MUST NOT start until this is set.                                                                   |

**Validation rules**:

- `libraryRootPath` MUST be non-empty at start time, or the request fails with `DEVICE_NOT_SELECTED` (no device chosen yet on this screen).
- `libraryRootPath` MUST exist and contain at least one of the expected OPL folders at the time sharing is started (edge case: device disconnected/reformatted since last configured → `LIBRARY_STRUCTURE_INVALID`, not a silent empty share).
- `username`/`password` MUST be non-empty when any protocol is enabled (FR-010).
- Ports MUST be free at start time; a bind failure surfaces via `NetworkShareStatus.error` (FR-008).
- `writeAccessAcknowledgedAt` MUST be set before `network-share:start` succeeds (FR-014); otherwise the call fails with `WRITE_ACCESS_NOT_ACKNOWLEDGED`.

## NetworkShareStatus

Runtime, non-persisted status of the sharing service(s). Exposed to the renderer via IPC query + push events (matches existing `OperationProgress`/`onDownloadProgress` pattern).

| Field              | Type                | Notes                                          |
| ------------------ | ------------------- | ---------------------------------------------- |
| `smb`              | `ProtocolStatus`    | Independent state for the SMB1-minimal server. |
| `ftp`              | `ProtocolStatus`    | Independent state for the `ftp-srv` server.    |
| `connectedClients` | `ConnectedClient[]` | Union of active clients across both protocols. |

### ProtocolStatus

| Field          | Type                                                        | Notes                                                                                                                         |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `state`        | `'off' \| 'starting' \| 'running' \| 'error' \| 'stopping'` | Drives the US2 status UI (off / running-idle / running-connected is derived by combining this with `connectedClients`).       |
| `boundAddress` | `string \| undefined`                                       | The LAN address actually bound (FR-006/R5) — shown to the user for PS2 setup (FR-004).                                        |
| `port`         | `number \| undefined`                                       | Actual bound port.                                                                                                            |
| `error`        | `SerializableError \| undefined`                            | Reuses the existing `SerializableError` shape already defined in `src/types/opl.ts` for consistency with the rest of the app. |
| `startedAt`    | `string \| undefined`                                       | ISO timestamp.                                                                                                                |

## ConnectedClient

Represents a device currently connected to (or recently connected to) either share.

| Field            | Type                                     | Notes                                                                                                                                                           |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                                 | Stable per-connection identifier.                                                                                                                               |
| `protocol`       | `'smb' \| 'ftp'`                         | Which server this client is on.                                                                                                                                 |
| `remoteAddress`  | `string`                                 | Source IP, used both for display and for the local-network enforcement check (FR-006).                                                                          |
| `connectedAt`    | `string`                                 | ISO timestamp.                                                                                                                                                  |
| `activity`       | `'idle' \| 'browsing' \| 'transferring'` | Best-effort activity classification from observed protocol operations (directory listing vs. read/write commands). Feeds the "running-connected" status in US2. |
| `lastActivityAt` | `string`                                 | ISO timestamp, used to age out stale entries (e.g., a PS2 that was power-cycled without a clean disconnect).                                                    |

## NetworkShareEvent

Pushed to the renderer on any state change (server start/stop/error, client connect/disconnect/activity change), following the existing `on<Domain>Event` pattern (e.g. `onFragmentationRepairEvent`).

| Field       | Type                                                                                                                        | Notes                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`      | `'protocol-status-changed' \| 'client-connected' \| 'client-disconnected' \| 'client-activity-changed' \| 'write-conflict'` |                                                                                                                                                                |
| `status`    | `NetworkShareStatus`                                                                                                        | Full current snapshot, sent with every event for simplicity (matches the existing coarse-grained event style in this codebase rather than fine-grained diffs). |
| `client`    | `ConnectedClient \| undefined`                                                                                              | Present for client-related event kinds.                                                                                                                        |
| `message`   | `string`                                                                                                                    | Human-readable summary (FR-008), e.g. for `write-conflict`: which file, which side won (FR-013).                                                               |
| `timestamp` | `string`                                                                                                                    | ISO timestamp.                                                                                                                                                 |

## Authentication failures (FR-015)

Invalid SMB/FTP login attempts are rejected with a single generic message ("usuário ou senha incorretos") that does not distinguish which field was wrong — handled at the protocol layer (SMB session-setup / `ftp-srv` auth callback) and never surfaced as a `ConnectedClient` (a failed auth attempt does not create a connected-client record, only an optional log line for troubleshooting, never including the attempted password).

## HistoryEntry integration (Constitution Principle IV)

Consistent with every other mutating `OplApi` operation in this codebase, starting and stopping the sharing service append a `HistoryEntry` (existing type in `src/types/opl.ts`) via the existing `history.service.ts` — `operation: 'network-share-start' | 'network-share-stop'`, `result` reflecting success/failure, `message` a human-readable summary. This makes sharing sessions visible in the app's existing history view alongside every other operation, without introducing a parallel audit mechanism.

## Relationships

```
NetworkShareConfig (1) ──configures──> NetworkShareStatus (1, runtime-only)
NetworkShareStatus (1) ──has many──> ConnectedClient (0..n)
NetworkShareConfig.libraryRootPath ──reuses──> existing DeviceInfo/library folder (no new storage)
NetworkShareStatus start/stop ──appends──> HistoryEntry (existing history.service.ts)
```

No new persistent game/library data is introduced — this feature only adds a thin configuration + runtime-status layer on top of the library already modeled by `DeviceInfo`/`DeviceSummary`/`GameLibrary` in `src/types/opl.ts`.
