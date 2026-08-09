# Data Model: Release Hardening, OPL Connectivity and Library Experience

## 1. Release Identity

| Field             | Type                   | Rules                                           |
| ----------------- | ---------------------- | ----------------------------------------------- |
| `schemaVersion`   | integer                | Starts at 1                                     |
| `publicVersion`   | string                 | `1.A.B.C`, each component 0–999                 |
| `internalVersion` | string                 | SemVer `1.A.(B*1000+C)`, derived and reversible |
| `channel`         | `stable \| prerelease` | Stable is default                               |
| `tag`             | string                 | Exactly `v${publicVersion}`                     |
| `artifactVersion` | string                 | Equals public version                           |

Validation rejects divergence rather than rewriting silently. `package.json` and updater metadata carry `internalVersion`; user-facing surfaces carry `publicVersion`. Diagnostics may show both.

## 2. Release Artifact Manifest

| Field            | Type               | Rules                                     |
| ---------------- | ------------------ | ----------------------------------------- |
| `release`        | Release Identity   | Required                                  |
| `artifacts`      | Release Artifact[] | Unique platform/arch/purpose/name         |
| `generatedAt`    | ISO timestamp      | Audit only; not part of artifact identity |
| `sourceRevision` | string             | Immutable commit SHA                      |

`Release Artifact` contains `name`, `platform`, `architecture`, `purpose` (`installer`, `update-metadata`, `blockmap`), `sha256`, `sizeBytes`, `public`, `referencedByUpdateMetadata`. Windows permits exactly one public artifact with purpose `installer`.

## 3. Update Policy

| Field       | Type                                                                          | Rules                       |
| ----------- | ----------------------------------------------------------------------------- | --------------------------- |
| `mode`      | `check-automatic \| ask-before-download \| download-automatic \| manual-only` | Required                    |
| `channel`   | `stable`                                                                      | Only stable in this feature |
| `updatedAt` | ISO timestamp                                                                 | Local persistence           |

Migration maps the current visual/default `manual` preference to `manual-only`; absent preference defaults to `check-automatic` with ask-before-download behavior.

## 4. Update Session

Fields: `sessionId`, `revision`, `state`, `currentPublicVersion`, `currentInternalVersion`, optional candidate versions, `releaseName`, sanitized `releaseNotes`, `sizeBytes`, `downloadedBytes`, `progress`, `lastError`, timestamps and `installBlockedByOperations`.

State machine:

```text
IDLE ──check──> CHECKING ──none──> NO_UPDATE
                    ├──found──> UPDATE_AVAILABLE ──download──> DOWNLOADING
                    └──error──> ERROR                    ├──done──> READY_TO_INSTALL
                                                       └──error──> ERROR
READY_TO_INSTALL ──explicit consent/no active blocker──> INSTALLING
NO_UPDATE|ERROR ──check/retry──> CHECKING
```

`INSTALLING` is entered only immediately before the privileged install/restart call. State and progress are emitted, but feed URL, token and signed download URL never cross IPC.

## 5. SMB Compatibility Profile

Fields: `profileId`, OPL version/commit, dialect, transport modes (`nbt`, `direct-host`), security level (`share` initially), encrypted/plaintext flag, string encoding (`oem`), allowed auth combinations, capabilities, supported commands/info levels, maximum read/frame sizes, filename limitations and validation status (`source-reviewed`, `hardware-passed`, `hardware-failed`).

Only profiles with `hardware-passed` may be advertised as supported for releases.

## 6. SMB Client Session and Diagnostic Event

`SMB Client Session`: connection ID, sanitized address, profile, phase, dialect/security, auth mechanism (never secret), UID, TID, handles/search IDs, timestamps, disconnect reason.

`SMB Diagnostic Event`: connection ID, monotonic sequence, phase/command, status, safe protocol fields, byte offset/count when applicable, duration, timestamp. Raw auth payload, password, challenge response and packet hex for authentication commands are forbidden.

Session transitions:

```text
CONNECTED -> NBT_READY? -> NEGOTIATED -> SESSION_ESTABLISHED
           -> TREE_CONNECTED -> BROWSING/READING -> LOGGED_OFF/CLOSED
Any phase -> REJECTED/PROTOCOL_ERROR/CLOSED
```

UID is allocated after session setup; TID after tree connect. Every later request must match active IDs. Handles/searches close on tree disconnect, logoff, socket close or error.

## 7. Hardware Smoke Record

Fields: `recordId`, console model, network adapter, OPL version/commit, compatibility profile, non-secret configuration, transport, scenario steps, observed protocol milestones, listing result, read/boot result, DVD9 boundary result, sanitized evidence references, tester, timestamps and result.

Desktop-client evidence is stored separately and cannot promote the profile to `hardware-passed`.

## 8. Local Art Index Snapshot

Fields: `snapshotId`, `revision`, `deviceIdentity`, `catalogScanId`, `status` (`building`, `complete`, `failed`, `stale`), `assets`, findings, started/completed timestamps and optional superseded snapshot ID.

Only a complete snapshot replaces the previous complete snapshot. Device identity/root changes make its opaque URLs stale.

### Local Art Asset

Fields: `assetId`, normalized Game ID, OPL art type, normalized relative path within `ART`, size, modified time, signature/MIME validation, validity (`valid`, `invalid`, `ambiguous-secondary`), findings and optional selected-as-primary flag.

Selection uses `COV`, then `COV2`. Same-type duplicates sort by case-folded relative path then exact path. The first valid candidate is primary and all duplicates remain diagnosable.

### Game Art View

Fields: `primaryCoverAssetId`, opaque `coverUrl`, `availableTypes`, completeness (`complete`, `partial`, `missing`, `invalid`, `ambiguous`), placeholder kind and findings. No absolute path is exposed.

## 9. Library Health

Replace the collapsed warning badge with:

- `readiness`: `ready`, `needs-validation`, `invalid-name`, `fragmented`, `incomplete`, `unknown`;
- `readinessReasons`: structured finding codes/messages;
- `artCompleteness`: independent Game Art View completeness;
- `metadataCompleteness`: `complete`, `missing`, `unknown`.

UI may group badges but must preserve and display causes. `artCompleteness=missing` does not change `readiness=ready`.

## 10. Download Target and Task Migration

```text
DownloadTarget =
  | { kind: 'opl-device', deviceId, profileId, mediaHint? }
  | { kind: 'local-folder', authorizationId, rootToken, collisionPolicy }
```

Local destination fields: original filename, sanitized final basename, staged relative path, optional final relative path, destination root fingerprint, verified size/hash and promotion timestamp. Renderer sees labels/tokens, not authoritative host paths.

Persisted download schema migrates v1 `targetDeviceId`/`targetProfileId` to v2 `target.kind=opl-device` without changing task identity or phase. Local tasks branch after minimal validation to `promoting-local`/`verifying-local`; OPL tasks retain planning/install/catalog/art phases.

Local target lifecycle:

```text
queued -> probing -> transferring -> downloaded -> validating
       -> awaiting-local-root? -> promoting-local -> verifying-local -> ready
Any active phase -> paused/failed/cancelled/recovery-pending
```

Local collision policies are `fail` or `rename`; overwrite is excluded from this feature.

## 11. Local Folder Authorization

Fields: opaque authorization ID/root token, canonical path stored only in main-process persistence, filesystem identity when available, display label, created/last-validated timestamps and state (`valid`, `missing`, `changed`, `revoked`). It is revalidated before space reservation, staging and promotion. A changed identity never silently redirects an existing task.

## 12. Import Job

Fields: `schemaVersion`, `revision`, `jobId`, target, batch state, item IDs, totals, current item, monotonic event sequence, recovery actions, created/updated timestamps.

Batch state: `queued`, `running`, `completed`, `partial`, `failed`, `cancelled`, `recovery-pending`.

### Import Item

Fields: `itemId`, safe display name, source reference stored only in main process, source fingerprint (size, mtime and optional structural/hash evidence), media/title/Game ID hints, phase, bytes done/total, smoothed throughput, optional ETA, staging/destination references, result, serializable error, timestamps and `canCancel`.

Item transitions:

```text
queued -> probing -> copying -> validating -> planning?
       -> awaiting-confirmation? -> installing/promoting -> verifying -> completed
Any safe active phase -> cancelled
Any active phase -> failed/recovery-pending
```

`canCancel=false` during atomic promotion/journal commit. Batch cancellation stops queued items and aborts the current item only when safe. Completed items remain completed.

## 13. Import Journal

Fields: job/item/revision, source fingerprint, staged path, intended final path, previous destination/backup when applicable, last durable boundary (`staging-created`, `copy-checkpointed`, `validated`, `promotion-started`, `promoted`, `verified`, `cleanup-complete`), byte checkpoint and cleanup policy.

Journal is persisted before mutation. Startup replay is idempotent and never infers completion from byte count alone.

## 14. Unified Operation Summary/Event

`Operation Summary`: operation ID, kind (`import`, `download`, `update`, existing kinds), revision, state, phase, progress, current item, counts, byte totals, `canCancel`, recovery actions and safe display message.

`Operation Event`: operation ID, monotonic sequence/revision, kind, phase, progress, optional bytes/speed/ETA, current item, counts, controlled error, timestamp.

Consumers obtain a snapshot and subscribe; they ignore older sequence/revision. Event emission is throttled to at most once per second or each 16 MiB checkpoint, while phase/terminal changes emit immediately.
