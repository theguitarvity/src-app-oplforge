# IPC Contract: Release, Local Art, Download Target and Import Operations

All inputs are strict validated objects. Errors use `{ code, message, retryable, action? }`. Privileged paths, feed URLs, tokens and credentials do not appear in renderer-facing payloads.

## Update API

| Operation            | Input                                                                    | Output                          |
| -------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `updates:get-policy` | `{}`                                                                     | `UpdatePolicy`                  |
| `updates:set-policy` | `{ mode, expectedRevision }`                                             | revisioned `UpdatePolicy`       |
| `updates:get-state`  | `{}`                                                                     | `UpdateSession` summary         |
| `updates:check`      | `{ expectedRevision? }`                                                  | `UpdateSession`                 |
| `updates:download`   | `{ sessionId, expectedRevision }`                                        | `UpdateSession`                 |
| `updates:install`    | `{ sessionId, expectedRevision, confirmation: 'REINICIAR E ATUALIZAR' }` | acknowledgement before restart  |
| `updates:on-event`   | subscription                                                             | revisioned state/progress event |

`updates:install` rejects when the session is not ready or sensitive operations are active unless the user has first resolved them. Renderer never supplies release/feed URL.

## Local art/catalog additions

`CatalogItem` adds `health` and `artView`. `artView.coverUrl`, when present, is an opaque revision-bound `opl-art:` URL. `art:local:*` operations accept only device/snapshot/asset identifiers, never paths.

| Operation                | Input                                     | Output                     |
| ------------------------ | ----------------------------------------- | -------------------------- |
| `art:local:get-snapshot` | `{ deviceId, catalogSnapshotId }`         | local art snapshot summary |
| `art:local:get-view`     | `{ deviceId, catalogSnapshotId, gameId }` | `GameArtView`              |

The protocol handler returns 404/410 for unknown, stale, invalid or root-mismatched assets and strict image MIME for valid assets.

## Download enqueue v2

```text
{
  source: HttpSource | TorrentSource,
  target:
    | { kind:'opl-device', deviceId, profileId, mediaHint? }
    | { kind:'local-folder', authorizationId, rootToken, collisionPolicy:'fail'|'rename' },
  title?, legalReceiptId?
}
```

The legacy device-shaped input is migrated internally only for persisted/existing callers during a bounded compatibility period. New callers use the union. Local-folder authorization originates from the existing main-process folder picker and is revalidated by the service.

Queue list/filter accepts `{ targetKind?, targetId?, phases?, cursor?, limit? }`. Task summaries disclose destination label, not authoritative path.

## Import API

| Operation                  | Input                                                                 | Output                       |
| -------------------------- | --------------------------------------------------------------------- | ---------------------------- |
| `imports:create`           | sources selected by trusted dialog, target intent, legal confirmation | `ImportJob` summary          |
| `imports:list`             | state/cursor filters                                                  | revisioned page of summaries |
| `imports:get`              | `{ jobId }`                                                           | job with item summaries      |
| `imports:confirm`          | `{ jobId, itemId?, expectedRevision, confirmation }`                  | revisioned job               |
| `imports:cancel`           | `{ jobId, expectedRevision, partialPolicy, confirmation? }`           | revisioned job               |
| `imports:retry`            | `{ jobId, itemIds?, expectedRevision }`                               | revisioned job               |
| `imports:resolve-recovery` | `{ jobId, itemId?, expectedRevision, action }`                        | revisioned job               |
| `operations:list-active`   | `{ kinds? }`                                                          | unified operation summaries  |
| `operations:on-event`      | subscription                                                          | `OperationEvent`             |

Cancellation is rejected with `PHASE_NOT_CANCELLABLE` when journal commit/promotion is active. Discarding a resumable partial requires explicit confirmation. Event consumers reconcile by revision and monotonic sequence.

## Validation/security rules

- IDs: non-empty, bounded opaque strings; revisions/sequences: non-negative integers.
- Percent: finite `0..100`; byte counts: non-negative safe integers with `done ≤ total` when total exists.
- Collision policy does not include overwrite in this feature.
- Legal receipt remains required for Essentials regardless of target kind.
- All destination roots are resolved from server-side authorizations; renderer strings are display-only.
- Update errors do not include signed URLs/tokens; SMB events do not include packet payload/auth material.
