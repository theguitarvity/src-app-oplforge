# Phase 0 Research: PS2 Network Library Sharing

## R1: Does OPL actually support FTP for game loading?

**Decision**: No — OPL's network game-loading path (ETH mode) is SMB-only.

**Rationale**: Web research on Open PS2 Loader confirms its supported loading sources are USB, HDD, and **SMB via ETH mode**. There is no FTP-based game-boot path in stock OPL — this matches what we already observed on the actual PS2 in this project (the OPL "Configurações de Rede" screen only exposes a "- Servidor SMB -" section, no FTP fields). FTP is therefore **not** a substitute for SMB for User Story 1 ("browse and launch games directly on the PS2") — an FTP-only implementation would satisfy none of Story 1's acceptance scenarios.

**Alternatives considered**: Treating FTP as equally capable per the original FR-002 wording ("both SMB and FTP") — rejected, would misrepresent what the feature delivers and violate SC-001/Story 1 if a user configures FTP expecting to browse games from OPL's menu.

**Impact on spec**: FR-002/FR-003 need a clarifying split — SMB is the primary, load-bearing protocol; FTP is a secondary/complementary channel (e.g., general file management from a PC-side FTP client, or PS2-side homebrew tools like uLaunchELF that do speak FTP) and must be clearly labeled as such in the UI so users don't configure FTP expecting OPL game-browsing to work over it.

Sources: [ps2homebrew.org ETH mode docs](https://www.ps2homebrew.org/Open-PS2-Loader-User-Guide/eth-mode.html), [ps2-home.com SMB boot tutorial](https://www.ps2-home.com/forum/viewtopic.php?t=3692), [ps2homebrew/Open-PS2-Loader on GitHub](https://github.com/ps2homebrew/Open-PS2-Loader)

## R2: FTP server implementation

**Decision**: `ftp-srv` (npm) — pure JavaScript, promise-based, supports a pluggable virtual filesystem per connection (lets us confine access to the configured library folder and enforce our own read/write and auth rules rather than trusting OS file permissions alone).

**Rationale**: Actively maintained enough (releases within the last ~3 years, 2 maintainers per Socket.dev analysis), no native compilation step (safe for Electron's multi-arch builds), and its extensible-filesystem design fits Constitution Principle II (confine access, validate inputs) better than a raw OS FTP daemon would.

**Alternatives considered**: Spawning the OS's built-in FTP capabilities — rejected, most desktop OSes don't ship a ready FTP server (Windows IIS FTP requires enabling a Windows feature; macOS removed its FTP server after 10.6; Linux needs vsftpd/proftpd installed) — worse cross-platform story than an in-process pure-JS server.

Source: [ftp-srv on npm](https://www.npmjs.com/package/ftp-srv), [QuorumDMS/ftp-srv on GitHub](https://github.com/QuorumDMS/ftp-srv)

## R3: SMB server implementation — the open question

**Finding**: There is no actively maintained, production-viable **pure-JavaScript SMB server** library.

- `node-smb-server` (Adobe, 100% JS) — last published ~8 years ago, unmaintained.
- `@greatnxy/smb` — explicitly experimental, not for production.
- `node-smb2` and similar — SMB2 **clients**, not servers.

This is a real gap between FR-002/FR-011 (SMB read/write support) and what a hand-rolled, low-risk, cross-platform Node/Electron implementation can safely deliver. Three viable paths exist, each with a real tradeoff — **this needs your decision before Phase 1 design (data model / contracts) proceeds**, since each implies a materially different architecture, permission model, and Constitution Principle II posture:

| Option                                                         | Approach                                                                                                                                                                                                                                                                              | Pros                                                                                   | Cons                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Orchestrate the OS's native SMB server**                  | OPL Forge shells out to platform tools to create/remove a temporary share pointed at the library folder (Windows: `New-SmbShare`; macOS: `sharing -a` / File Sharing prefs; Linux: `net usershare`, requires Samba installed)                                                         | Production-grade, battle-tested SMB implementation; zero protocol code to maintain     | Every platform needs elevated/admin privileges to create a share (UAC prompt on Windows, macOS authorization dialog, root on Linux); Linux desktops frequently don't have Samba installed at all — directly conflicts with FR-007's "explicit but simple" and SC-001's "under 5 minutes" goals; largest Constitution Principle II exposure (broad OS-level privilege, not a narrow contextBridge API) |
| **B. Fork/vendor and harden `node-smb-server`**                | Take Adobe's abandoned pure-JS implementation, update it, and maintain our own fork                                                                                                                                                                                                   | Stays in-process, no native/OS dependency, consistent behavior across platforms        | Adopting an 8-year-stale SMB protocol implementation as a maintenance burden is a significant, open-ended undertaking — likely disproportionate to this feature's scope (Principle V: "escopo mínimo coerente")                                                                                                                                                                                       |
| **C. Purpose-built minimal SMB1 server for OPL's client only** | Implement just enough of the legacy SMB1/CIFS dialect that OPL's IOP-side SMB client actually speaks (well-documented in the PS2 homebrew community; guides commonly configure Samba with `min protocol = NT1` specifically for OPL compatibility) — not a general-purpose SMB server | Smallest realistic in-process surface area; matches what OPL truly needs, nothing more | Still original protocol-implementation work (not zero-risk); needs hardware validation against a real PS2/OPL client (which this project already has access to)                                                                                                                                                                                                                                       |

**Resolved**: Option C — a purpose-built, minimal SMB1/CIFS server implementing only the dialect and command subset OPL's IOP-side SMB client uses. Runs in-process (Electron main), no OS-level share orchestration, no elevated privileges required. This keeps the feature's privilege footprint identical to the FTP server (Option in R2) and avoids the cross-platform admin-prompt UX that Option A would require.

Implementation notes carried into Phase 1:

- Scope the SMB command set to what's needed for directory listing and file read/write over the shared library tree — not a general-purpose SMB implementation.
- Must be validated against the actual PS2/OPL hardware available to this project (ETH mode, "Servidor SMB" client) as part of the quickstart validation, not just unit tests.
- Treat this as new protocol-handling code: per Constitution Principle V, it needs automated tests at the domain-logic boundary (message parsing/framing) plus an integration test at the service boundary, and per Principle II must validate/confine every path it serves to the configured library root (no traversal outside it).

## R4: Existing codebase conventions to follow

- **Types**: All shared contracts live in `src/types/opl.ts`, consumed by `OplApi` interface (`window.oplApi`). New types (e.g., `NetworkShareStatus`, `NetworkShareConfig`, `ConnectedClientInfo`) belong here, following existing naming/shape conventions (e.g., `DeviceInfo`, `OperationProgress`).
- **IPC**: One `*.ipc.ts` file per domain under `electron/ipc/`, registering `ipcMain.handle` calls, validated via `parseInput` (`electron/ipc/schemas.ts`, zod-based). A `network-share.ipc.ts` should follow this pattern.
- **Services**: Domain logic lives in `electron/services/<domain>/`, following the existing `device.service.ts` / `diagnostics/` / `downloads/` structure. A new `electron/services/network-share/` module is consistent with this.
- **Events**: Long-running/streaming state is pushed to the renderer via `on<Domain>Event(callback)` subscriptions (e.g., `onDownloadProgress`, `onFragmentationRepairEvent`), not polling. Sharing status and connected-client changes should follow the same event-emitter + unsubscribe-function pattern.
- **Renderer state**: Zustand for UI/session state (mirrors `device-store.ts`, `log-store.ts`), React Query for async server state where applicable.

## R5: Local-network-only enforcement (FR-006)

**Decision**: Bind both the FTP and SMB-equivalent listeners to the machine's private LAN interface address (RFC1918 ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) rather than `0.0.0.0`, and additionally reject any incoming connection whose source address falls outside those ranges at the application layer as defense-in-depth. This directly addresses this project's own investigation earlier in this effort, where double-NAT/VLAN topologies made "local network" ambiguous — the service must bind per-interface, not assume a single flat subnet.

**Rationale**: Matches Constitution Principle II (least privilege / narrow exposed surface) and FR-006. Avoids relying solely on OS firewall behavior, which varies by platform and user configuration.
