# Quickstart: PS2 Network Library Sharing

Validation guide for this feature. Assumes a PS2 running Open PS2 Loader on the same local network as the machine running OPL Forge, and a local library already populated (see `specs/001-validate-opl-preparation` / existing device workflows).

## Prerequisites

- OPL Forge running with at least one local library device configured (`DVD`/`CD`/`PS1`/`APPS` folders present).
- A PS2 with Open PS2 Loader installed, network adapter connected to the **same local subnet** as the PC (see this project's own network investigation notes if double-NAT/secondary-router topology is suspected — reachability between PC and PS2 is a prerequisite this feature cannot fix).
- `pnpm test:run` and `pnpm build` passing on the branch before manual validation (Constitution Principle V gate).

## Scenario 1 — Enable sharing and see connection details (US1, AS1)

1. Open OPL Forge, navigate to the network sharing section.
2. Turn sharing on; when prompted, set a username and password, then explicitly acknowledge that the PS2 will be able to write/overwrite files in the shared library (FR-014 — a separate confirmation from the credentials form).
3. **Expect**: status changes to `running`, and the app displays protocol, bound address, port, share name, username for both SMB and FTP (whichever were enabled).

## Scenario 2 — Guided PS2 setup + real SMB browse (US1, AS2/AS3; FR-012)

1. From the sharing screen, open "Tutorial de Configuração".
2. Follow the displayed steps on the PS2: Configurações → Configurações de Rede → Servidor SMB → enter the exact address/port/share/username/password shown.
3. On the PS2, save and browse the network share from OPL's game list.
4. **Expect**: PS2 lists the same PS2/PS1/Apps titles visible in OPL Forge's local library. Launch one title to confirm it boots (validates the SMB1-minimal server against real OPL client behavior, per `research.md` R3 — this step cannot be replaced by a unit test).

## Scenario 3 — Status reflects real connection state (US2)

1. With sharing on and no PS2 connected, confirm the app shows `running-idle` (no active client).
2. Connect from the PS2 (browse the share as in Scenario 2).
3. **Expect**: within ~10s (SC-002) the app shows `running-connected` with the PS2's address and activity (`browsing`).
4. Power off the PS2 or disconnect it from the network.
5. **Expect**: the app eventually reflects the client as disconnected (no stale "connected" state).

## Scenario 4 — Local-network-only enforcement (US3, FR-006; SC-003)

1. With sharing on, attempt to reach the bound SMB/FTP port from a device **outside** the local subnet (e.g., via a public IP / VPN test host, or simulate by attempting from an address outside the configured RFC1918 ranges).
2. **Expect**: connection is rejected before any protocol negotiation completes.

## Scenario 5 — Off by default / stops on quit (US3, FR-007; SC-005)

1. Fresh install (or reset app config), open OPL Forge.
2. **Expect**: sharing section shows `off`, no listeners bound (verify via `network-share:get-status`).
3. Turn sharing on, then quit OPL Forge entirely.
4. **Expect**: SMB/FTP ports are no longer accepting connections after the app process exits.

## Scenario 6 — Human-readable failure on port conflict (US2 AS4; FR-008)

1. Start another process listening on the configured SMB or FTP port (e.g., a throwaway `nc -l <port>`).
2. Attempt to start sharing in OPL Forge on the same port.
3. **Expect**: a plain-language error naming the conflicting port is shown — not a raw error code/stack trace.

## Scenario 7 — Concurrent write safety (Edge case; FR-013)

1. With sharing on and a PS2 connected, have the PS2 write back to a file in the shared library (e.g., a save) at the same moment OPL Forge/the user modifies the same file locally.
2. **Expect**: no corrupted/partially-written file results; the app surfaces a `write-conflict` event with a clear message identifying the file and which write was applied.

## Scenario 8 — FTP is clearly secondary (R1 finding)

1. Enable only the FTP protocol (disable SMB).
2. **Expect**: the UI explicitly indicates FTP does not enable game browsing/launching from OPL's own menu (SMB is required for that), so the user isn't misled into thinking FTP alone satisfies User Story 1's "browse and launch" goal.

## Scenario 9 — Invalid credentials are rejected safely (FR-015)

1. With sharing on, attempt to connect to the SMB or FTP share using a wrong username or wrong password.
2. **Expect**: the connection is rejected with a single generic authentication-failure message (not revealing which field was wrong), and no `ConnectedClient` entry is created for the failed attempt.
