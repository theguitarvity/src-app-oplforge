# Quickstart Validation: Feature 006

## Prerequisites

- Node.js 22 and pnpm 9.
- Windows clean VM for installer/identity/update tests.
- macOS signing/notarization environment and Linux test host for release smoke.
- CI secrets for production signing; never use them in local logs.
- PS2 physical hardware on a controlled LAN with pinned OPL version/commit.
- Sanitized SMB packet capture capability.
- Disposable local folders and removable test device with at least one DVD9-sized sparse/test image where legally appropriate.

## Baseline commands

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm exec tsc --noEmit
pnpm test:run
pnpm build
```

Expected: all gates pass before platform packaging. Feature-specific suites introduced during implementation must be added to these gates.

## Scenario 1 — Release identity and Windows artifact inventory

1. Prepare a release manifest for controlled version N and create the matching tag.
2. Run the release validator with matching inputs; then repeat with a mismatched tag and package version.
3. Build Windows from a clean runner and inspect only the staged publish directory.
4. Install in a clean Windows VM.
5. Inspect installer, installed executable, desktop/Start Menu shortcuts, Programs and Features/uninstaller and taskbar/window identity.

Expected: matching release succeeds; every mismatch fails before publication; exactly one public `.exe` exists; all inspected surfaces use OPL Forge identity. See [release contract](contracts/release.md).

## Scenario 2 — Cross-platform package smoke

Build the existing macOS x64/arm64, Linux AppImage/DEB and Windows NSIS targets from the same release identity. Verify embedded version/identity, signatures where required and application startup on representative hosts.

Expected: every artifact maps to the same public/internal identity. A missing required signature blocks a public release rather than being silently accepted.

## Scenario 3 — Installed update N → N+1

1. Install signed controlled release N.
2. Exercise all four update policies and restart between policy changes.
3. Publish eligible signed N+1 with valid metadata.
4. Check, inspect release data, download, interrupt once, retry/resume as supported, and reach ready state.
5. Start a long import, request installation and confirm the warning/blocking behavior.
6. Finish/stop the operation, choose "Reiniciar e atualizar", then read versions after restart.
7. Repeat with GitHub unavailable, offline, draft, prerelease and malformed metadata.

Expected: explicit state transitions match [IPC contract](contracts/ipc.md); installation is never silent; the app returns in N+1; ineligible/broken releases do not install.

## Scenario 4 — Automated SMB protocol regressions

Run focused unit/integration suites for frame parsing, share-level session/tree authentication, wrong password, UID/TID lifecycle, directory pagination, `OPEN_ANDX`, `ECHO`, query levels and `READ_ANDX` around `0xffffffff/0x1_0000_0000`.

Expected: supported handshake does not return `0xc000006d`; invalid auth remains generic; malformed lengths never crash the server; post-auth IDs are enforced; no raw auth bytes appear in captured logs.

## Scenario 5 — Hardware Smoke Test (mandatory manual gate)

1. Pin console, adapter and OPL version/commit in a Hardware Smoke Record.
2. Start sharing in OPL Forge using the documented compatibility profile.
3. Configure the same address, port, share and credentials on the PS2.
4. Capture sanitized traffic from TCP connect through NBT/direct-host, negotiate, session and tree connect.
5. Browse CD/DVD folders, paginate a representative library and open a game.
6. Sustain reads during boot/FMVs and repeat with a DVD9 image beyond 4 GiB.
7. Exercise wrong password, empty fields/guest policy, reconnect, two clients and interrupted read.

Expected: all required milestones in [SMB contract](contracts/smb-compatibility.md) pass on hardware. Desktop-client success is supplemental only.

## Scenario 6 — Local art fixture and 500-game library

Prepare a disposable device fixture containing known Game IDs and: COV+COV2, COV2-only, auxiliaries-only, invalid/empty image, duplicate same-type candidates, missing art and a symlink/traversal attempt.

1. Scan and compare grid, list and detail.
2. Shuffle filesystem enumeration order and rescan.
3. Request an unknown/stale opaque art URL.
4. Remove the device during a scan.
5. Generate the existing 500-game fixture with representative covers and exercise scroll/search/filter/detail.

Expected: deterministic COV→COV2 selection, stable duplicate winner plus finding, no arbitrary file access, previous complete snapshot preserved on removal, and no UI freeze over 2 seconds.

## Scenario 7 — Download to this computer

1. Disconnect all OPL devices.
2. Choose "Este computador", authorize a disposable folder and enqueue legal test content.
3. Interrupt/restart the app mid-transfer, then complete.
4. Verify original basename/format, size/hash and absence of OPL layout or automatic PCSX2 launch.
5. Repeat with missing folder, identity-changed folder, no space, traversal filename and collision policies.
6. Run the OPL-device route as regression.

Expected: local route completes without device and promotes atomically; only the affected task waits/fails on destination errors; v1 device tasks migrate without behavior change.

## Scenario 8 — Observable batch import and recovery

1. Import at least seven files with different sizes, including one over 256 MiB.
2. Observe the add flow and Activity Drawer throughout.
3. Simulate source removal, ENOSPC and a read/write failure on independent items.
4. Cancel during copy, attempt cancel during non-cancellable commit, and force-close at each journal boundary.
5. Restart and resolve every recovery state.

Expected: bytes/percentage are monotonic and bounded; global progress is byte-weighted; speed/ETA appear only when reliable; exactly one result exists per item; staged partials never appear final; previous destinations remain valid.

## Scenario 9 — Security and privacy audit

Inspect renderer/preload boundaries, new schema validation, CSP/protocol permissions, path confinement, updater source, local logs and exported SMB evidence.

Expected: no renderer-controlled filesystem/feed/network capability, no credentials/auth payloads/signed URLs in logs, no library/game telemetry during update checks, and all privileged inputs validated.

## Release evidence checklist

- Release manifest plus validator result and artifact inventory.
- Signature/notarization verification and clean-install screenshots/resource inspection.
- N→N+1 update record.
- Automated affected tests/build logs.
- Hardware Smoke Record with sanitized trace.
- 500-game performance measurements.
- Import crash-boundary/recovery report.
