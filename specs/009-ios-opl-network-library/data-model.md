# Data Model: iOS OPL Network Library

This feature reuses every entity already defined in `specs/006-android-opl-network-library/data-model.md`, `specs/008-android-forge-essentials/data-model.md`, and the Art Sync entities added since — the JS-side `mobile/src/types/` DTOs are cross-platform and unchanged by this port (per `plan.md`'s Constitution Check, Principle III). This document only records the fields whose _underlying representation_ differs on iOS, and one new entity with no Android equivalent.

## LibrarySelection — one field changes representation, nothing else

| Field        | Android                                             | iOS                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `treeUri`    | SAF tree URI string (`content://...`)               | The JS-visible field name and string type are unchanged (no TurboModule spec edit) — but the Swift implementation stores it as an opaque reference to a resolved security-scoped bookmark (base64 or a UUID key into a small bookmark table in `UserDefaults`), never a raw filesystem path. The UI never parses this string on either platform (research.md R2) — it is already treated as opaque, so no cross-platform type change is needed.                 |
| `sourceKind` | `'internal' \| 'sd-card' \| 'usb-otg' \| 'unknown'` | iOS only ever produces `'internal'` (a folder physically on-device) or `'unknown'` (iCloud Drive, a third-party file-provider extension, or anything else the document picker can reach) — `'sd-card'` and `'usb-otg'` are Android-only classifications with no iOS source to map to (spec.md Assumptions). The JS type is left a superset across both platforms rather than narrowed per-platform, keeping one shared `LibrarySourceKind` type instead of two. |

All other `LibrarySelection` fields (`displayName`, `accessGrantedAt`, `accessValid`, `lastValidatedAt`) are unchanged in shape and meaning — `accessValid` now reflects bookmark-resolution success (research.md R2) instead of a SAF persisted-permission check, but the field's contract to the UI ("can I read this library right now") is identical.

## CatalogEntry, CatalogSnapshot, DiagnosticsReport, CatalogListingCacheEntity (Essentials), TransferItem, ArtSyncMatch

Unchanged in shape on both platforms — every field already recorded in specs 006/008's data models is either a domain concept (game ID, score tier, transfer progress) with no platform dependency, or already an opaque `string`/`number` that doesn't leak an Android-specific representation. No new fields, no removed fields.

## SharingSession — one new state, already anticipated by spec.md FR-008

| Field                 | Type                                                                          | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`               | `'off' \| 'starting' \| 'running-idle' \| 'running-connected' \| 'suspended'` | Adds `'suspended'` to the existing Android state set (`off`/`starting`/`running-idle`/`running-connected`) — entered when the native `SharingModule` detects the app was backgrounded mid-session (research.md R3) and has torn the listener down. Android never enters this state (no equivalent trigger); the JS-side `SharingScreen` already has an `error`/toast-style event channel (`onSharingSessionEvent`) this reuses, so no new event-emission mechanism is needed, only a new value flowing through the existing one. |
| `boundAddress`/`port` | unchanged                                                                     | Same meaning; cleared when `state` transitions to `'suspended'` or `'off'`.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

**Validation rule (new, iOS-only)**: a transition into `'suspended'` MUST fire the same `onSharingSessionEvent` stream the UI already listens to (spec.md FR-008) — never a silent state change the JS layer has to poll for.

## New entity — DocumentBookmark (iOS only, internal to the native layer)

Not exposed to JS as its own type (it's an implementation detail behind `LibrarySelection.treeUri`'s opaque string), but recorded here since it's genuinely new: a resolved `URL` + its `bookmarkData` + `isStale` flag, keyed by the opaque reference stored in `LibrarySelection.treeUri`. Re-resolved at the start of every native-module call that touches the library tree (research.md R2) — not cached across calls, since a stale/invalidated bookmark must be caught on next use, not just at app launch.

## Key Entities cross-reference

For every entity not called out above, see:

- `specs/006-android-opl-network-library/data-model.md` — `LibrarySelection` (base shape), `CatalogEntry`, `CatalogSnapshot`, `SharingSession` (base shape), `LocalHistoryEntry`.
- `specs/008-android-forge-essentials/data-model.md` — `CatalogListingCacheEntity`, `SmartFillPlan`, `TransferItem`, `DiagnosticsReport`.
- Art Sync entities (`ZipArtEntry`, `ArtSyncMatch`) — introduced in the Android `art/` module, unchanged.
