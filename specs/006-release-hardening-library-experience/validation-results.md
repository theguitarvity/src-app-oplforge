# Feature 006 validation results

Validated on 2026-08-09 in the repository workspace.

## Automated evidence

- Release identity: `pnpm exec tsx scripts/validate-release.ts v1.0.0.0` passed; public `1.0.0.0`, internal `1.0.0`, tag `v1.0.0.0`.
- Static checks: `pnpm exec eslint .` and `pnpm exec tsc --noEmit` passed.
- Tests: `pnpm exec vitest run --pool=threads` passed, 103 files and 304 tests.
- Production compilation: direct Node-22-equivalent commands (`vite build` and `tsup` after `tsc`) passed. The combined `pnpm build` wrapper was rejected before execution because this validation host runs Node 26.7.0 while the project intentionally requires Node >=22 <23; CI pins Node 22.
- SMB regression suites cover share-level session/tree authentication, NBT framing, connection-owned identifiers, handle cleanup and activity. Physical OPL behavior is not inferred from unit tests.
- Renderer remains sandboxed with context isolation and no Node integration. Local artwork uses revision-bound `opl-art:` URLs; local destinations use opaque authorizations and revalidate root identity.
- Durable local downloads use schema v2 with v1 migration, destination-local staging, collision policy and verification. OPL-device finalization remains a separate branch.
- Imports persist jobs/items, isolate item failures, publish operation progress and remove source/device paths from renderer snapshots.
- Release workflow is tag-only, validates identity first, requires signing secrets, inventories exact updater artifacts and publishes only after signature/inventory gates.

## Manual and external gates

These remain `not-verified`; no success is claimed without the corresponding environment and evidence.

- Real PS2 with pinned OPL: auth matrix, listing, `OPEN_ANDX`, sustained reads, DVD9 beyond 4 GiB, reconnect and two-client isolation.
- Clean Windows installed N → signed N+1: executable/installer/uninstaller identity, updater download, explicit restart and resulting version.
- Real production signing certificate and GitHub tag publication.
- macOS notarization if macOS becomes a public target. Feature 006 currently publishes the supported Windows NSIS updater route only.
- Approximately 500 real installed games UI profiling on target hardware; implementation performs one ART enumeration per scan, but target-machine stall and memory numbers require measurement.

## Quickstart status

Scenarios backed entirely by repository fixtures and automated checks pass. Scenarios requiring removable media, a clean installed OS, signing credentials, network capture or physical PS2 are not verified and must be attached to a release candidate before promotion.

## Constitution audit

No arbitrary filesystem or feed URL is accepted by updater IPC. Privileged paths stay in the main process. Writes stage before promotion, persisted entities are revisioned, logs redact sensitive values, legal confirmations remain explicit, and no telemetry of the local library was added.
