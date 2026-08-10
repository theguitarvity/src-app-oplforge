# Contract: React Native ↔ Kotlin Native Module Boundary

## Boundary

Every privileged operation (SAF access, catalog scan, SMB sharing) is exposed to React Native exclusively through TurboModules Codegen'd from TypeScript spec files under `mobile/src/native/`, backed by Kotlin implementations under `mobile/android/app/src/main/java/com/oplforge/mobile/`. This is the mobile equivalent of `electron/preload.ts` + `src/services/api.ts` + `src/types/opl.ts` on desktop (Constitution Principle III, reinterpreted per `plan.md` Constitution Check #2/#3). React Native screens/components MUST NOT import anything from `mobile/android/` directly — only from `mobile/src/native/`.

Errors reject the call's promise with a `SerializableError`-shaped value (plain-language `message`, machine-readable `code`, never a raw stack trace or credential as the primary payload — FR-030). Long-running/streaming state changes are pushed via native events (`SharingSessionEvent`, `CatalogScanEvent` — see `data-model.md`), following the same "coarse-grained snapshot per event" style as desktop's `on<Domain>Event` pattern, not fine-grained diffs.

## LibraryModule (`mobile/src/native/LibraryModule.ts`)

Backed by `LibrarySelectionModule.kt`.

### `selectLibrary()`

Launches the system folder picker (`ACTION_OPEN_DOCUMENT_TREE`), covering both internal/SD storage and any currently-attached USB-OTG storage exposed by the OS (FR-005/R4). On confirmation, calls `takePersistableUriPermission()` (FR-003) and returns the resulting `LibrarySelection`.

Response: `Promise<LibrarySelection>`.

Errors: `SELECTION_CANCELLED` (user backed out of the picker — not a failure state, caller treats as no-op), `GRANT_FAILED` (OS refused persistable permission).

### `getActiveLibrary()`

Returns the currently active `LibrarySelection`, or `undefined` if none is set (US1 AS1).

Response: `Promise<LibrarySelection | undefined>`.

### `revalidateAccess()`

Cross-checks the stored `treeUri` against `ContentResolver.getPersistedUriPermissions()` (FR-004, `research.md` R3). Called on app launch and before starting a catalog scan or sharing session.

Response: `Promise<LibrarySelection>` — `accessValid` reflects the current OS-level grant state; does not throw when access is lost, since "lost access" is a normal, displayable state (FR-004), not an exceptional one.

## CatalogModule (`mobile/src/native/CatalogModule.ts`)

Backed by `CatalogScanner.kt` + `CatalogIndexStore.kt`.

### `startScan()`

Begins a read-only scan of the active `LibrarySelection` (FR-006–FR-010). Fails fast with `NO_LIBRARY_SELECTED` or `LIBRARY_ACCESS_INVALID` if `revalidateAccess()` would currently return `accessValid: false`.

Response: `Promise<CatalogSnapshot>` (initial `state: 'running'` snapshot; progress arrives via `onCatalogScanEvent`).

Errors: `NO_LIBRARY_SELECTED`, `LIBRARY_ACCESS_INVALID`, `SCAN_ALREADY_RUNNING`.

### `cancelScan()`

Cancels the in-progress scan (FR-010). MUST leave the prior `completed` snapshot (if any) untouched — cancellation never corrupts last-known-good catalog state.

Response: `Promise<void>`.

### `getLatestSnapshot()`

Response: `Promise<CatalogSnapshot | undefined>` with its `CatalogEntry[]` (paginated for large libraries — see Performance note below).

### `onCatalogScanEvent(callback)`

Subscribes to scan progress/completion/error/cancellation events. Returns an unsubscribe function (matches desktop's `on<Domain>Event` convention).

**Performance note**: `getLatestSnapshot()`/library-browsing reads (US6) MUST support pagination or windowed queries against Room rather than returning all ~500 entries in one bridge call, to keep scrolling smooth (spec US6 AS3) — exact paging shape is an implementation detail for `tasks.md`, not fixed here.

## SharingModule (`mobile/src/native/SharingModule.ts`)

Backed by `SharingSessionModule.kt` + `SharingForegroundService.kt` + `CredentialStore.kt`.

### `getSession()`

Response: `Promise<SharingSession>` — current config + runtime state (password never included; write-only).

### `saveCredentials(input)`

Request:

```ts
interface SaveCredentialsInput {
  shareName: string
  username: string
  password: string // write-only; stored via CredentialStore (Keystore-backed), never echoed back
}
```

Response: `Promise<SharingSession>` (without password).

Errors: `INVALID_INPUT` (empty username/password — FR-017 requires both).

### `acknowledgeWriteAccess()`

Request: `{}`. Records `writeAccessAcknowledgedAt` (FR-018) — a distinct action from `saveCredentials`, called from a distinct confirmation UI, exactly mirroring desktop's `network-share:acknowledge-write-access` (spec 005) split from its credentials form.

Response: `Promise<SharingSession>`.

### `startSharing()`

Starts `SharingForegroundService` + the Kotlin SMB1 server (FR-013/FR-014). Fails fast (before touching the network) if: no library selected/valid, no completed catalog snapshot, no credentials set, or (when write access was ever requested by the UI flow) no `writeAccessAcknowledgedAt`. Also fails with a plain-language `NO_LOCAL_NETWORK` error if no LAN-capable network interface is currently available (spec US3 AS4) — the service is never started against dead network state.

Response: `Promise<SharingSession>` (`state: 'starting'`, transitions surface via `onSharingSessionEvent`).

Errors: `NO_LIBRARY_SELECTED`, `LIBRARY_ACCESS_INVALID`, `CATALOG_NOT_READY`, `CREDENTIALS_NOT_SET`, `NO_LOCAL_NETWORK`, `PORT_IN_USE`, `ALREADY_RUNNING`.

### `stopSharing()`

Stops the SMB server and `SharingForegroundService` (FR-013, US3 AS3). Idempotent — calling while already `off` is a no-op success, not an error.

Response: `Promise<SharingSession>`.

### `getConnectionInstructions()`

Returns the ordered tutorial steps (spec `ConnectionTutorialStep`, US4/FR-023) for the currently active session — empty/undefined when `state = 'off'`.

Response: `Promise<ConnectionTutorialStep[]>`.

### `onSharingSessionEvent(callback)`

Subscribes to `SharingSessionEvent` (state changes, client connect/disconnect/activity, write conflicts — FR-019/FR-024/FR-033). Returns an unsubscribe function.

## Shared constraints

- No method in this contract accepts or returns a raw filesystem path — only opaque SAF URIs and app-defined logical paths (FR-001, FR-028).
- No method logs or returns a plaintext password in any response, error message, or `LocalHistoryEntry` (FR-030).
- `startSharing()` MUST NOT succeed while bound to a non-LAN interface, and the underlying `SmbServer`/`LocalNetworkGuard` MUST reject any accepted connection whose source address falls outside RFC1918 ranges, mirroring desktop's R5 approach (FR-015).
