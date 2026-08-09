# Implementation Plan: PS2 Network Library Sharing

**Branch**: `005-ps2-network-transfer` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-ps2-network-transfer/spec.md`

## Summary

Add an in-process, local-network-only file sharing service to OPL Forge so a PS2 running Open PS2 Loader can browse and launch the existing local library over the network (no drive swapping). SMB is the load-bearing protocol (OPL's ETH mode only speaks SMB — confirmed in `research.md` R1); FTP is added as a secondary channel via `ftp-srv`. Because no maintained pure-JS SMB server library exists, SMB support is a purpose-built minimal SMB1/CIFS server scoped to exactly what OPL's client needs (`research.md` R3, Option C) — both servers run in the Electron main process, bound only to local-network interfaces, off by default, with credentials required and stored via Electron's `safeStorage` API.

## Technical Context

**Language/Version**: TypeScript 6.0, Node.js 22 (Electron 42 main process)

**Primary Dependencies**: `ftp-srv` (new, FTP server); purpose-built minimal SMB1/CIFS server (new, in-repo, no external SMB library — none viable per R3); Electron `safeStorage` (built-in, credential encryption at rest — first use in this codebase); existing `zod` for IPC input validation

**Storage**: Existing local library folders (`DVD`/`CD`/`PS1`/`APPS`) served directly, read/write — no new file storage. `NetworkShareConfig` persisted alongside existing app config (JSON), with `username`/`password` encrypted via `safeStorage` rather than stored in plain JSON.

**Testing**: Vitest + React Testing Library (existing), plus new unit tests for the SMB1 frame parser/handler and integration tests for both servers' start/stop/auth/local-network-rejection behavior. Real-hardware validation against the project's own PS2/OPL is required for the SMB path (protocol-compatibility risk cannot be fully covered by unit tests — see `quickstart.md` Scenario 2).

**Target Platform**: Desktop (Windows x64/arm64, macOS Intel/Apple Silicon, Linux DEB/AppImage) — both servers run entirely in-process, no OS-level share orchestration, so no new per-platform code paths beyond existing local-interface address discovery.

**Project Type**: Desktop Application (Electron + React) — extends the existing single-project structure, no new top-level project.

**Performance Goals**: Status UI reflects real connection state within 10s (SC-002). No browse/transfer-latency target is set — not required by any FR/SC in this spec.

**Constraints**: Local-network-only binding and rejection (FR-006); off by default, explicit start/stop (FR-007); no elevated/admin privileges required at any point (deciding factor for the R3 Option C choice); credentials never logged or stored in plaintext (Principle IV).

**Scale/Scope**: Single PC sharing to one or more PS2 units on one trusted home network at a time (per spec Assumptions) — not a multi-tenant or internet-facing service.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

1. **Principle I — Segurança em Operações Sensíveis** → **PASS**: PS2 write-back (FR-011) can modify/overwrite files in the local library over the network. Per-write interactive confirmation is impractical (it would defeat real-time game-save writes), so instead FR-014 requires an explicit, one-time user acknowledgment before write access is ever granted — satisfying the principle's "confirmação explícita antes da execução" at the point where the user authorizes the class of operation, analogous to how other MUST-confirm flows in this app gate on a single explicit action rather than per-file-write prompts. Additionally mitigated by FR-013 (conflict detection, no silent corruption), FR-015 (safe auth-failure handling), confinement of all served paths to `libraryRootPath` (no traversal), and Principle IV-style observability (every write surfaces via `NetworkShareEvent`).
2. **Principle II — Isolamento e Menor Privilégio** → **PASS**: Both servers run in the Electron main process; the renderer only ever calls the narrow `network-share:*` IPC surface via `contextBridge`/`OplApi` (Principle III). The R3 architecture decision (Option C, in-process minimal SMB1) was explicitly chosen over OS-native share orchestration (Option A) _because_ Option A would require elevated/admin privileges on every platform — directly avoiding a Principle II conflict.
3. **Principle III — Contratos Tipados e Limites de Camada** → **PASS**: New types added to `src/types/opl.ts` (`data-model.md`), new IPC channels documented (`contracts/network-share-ipc.md`) following the existing `*.ipc.ts` + `parseInput` (zod) pattern. No renderer code touches sockets/filesystem directly.
4. **Principle IV — Integridade, Rastreabilidade e Recuperação** → **PASS**: Sharing state and client activity are observable via `NetworkShareEvent` (mirrors existing `onDownloadProgress`/`onFragmentationRepairEvent`), and sharing start/stop is additionally recorded as a `HistoryEntry` (per `data-model.md`), consistent with every other mutating `OplApi` operation in this codebase. Credentials use Electron `safeStorage` rather than plaintext JSON — first use of this API in the codebase, introduced specifically to satisfy "no secrets in logs/persistence." Write conflicts (FR-013) are handled without corrupting pre-existing data, consistent with this principle's recovery expectations.
5. **Principle V — Evolução Incremental Verificada** → **PASS (with commitment)**: The SMB1 frame parser/handler is new protocol-handling domain logic and MUST have automated unit tests (message parsing/framing) plus integration tests for the service boundary (start/stop/auth/rejection), per `research.md` R3 implementation notes. Real-PS2 hardware validation is additionally required (`quickstart.md` Scenario 2) since protocol-compatibility bugs are the primary risk of the R3 approach and cannot be fully caught by unit tests alone — this is called out explicitly as the proportional-to-risk evidence this principle requires.

No unjustified violations — Complexity Tracking section below is empty accordingly.

## Project Structure

### Documentation (this feature)

```text
specs/005-ps2-network-transfer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── network-share-ipc.md
└── tasks.md             # Phase 2 output (speckit-tasks — not created here)
```

### Source Code (repository root)

```text
electron/
├── services/
│   └── network-share/
│       ├── smb/                    # purpose-built minimal SMB1 server (R3 Option C)
│       │   ├── frame-codec.ts      # SMB1 message parsing/framing (unit-tested)
│       │   ├── command-handlers.ts # subset of commands OPL's client actually uses
│       │   └── smb-server.ts       # socket lifecycle, binds to local-network interfaces only
│       ├── ftp/
│       │   └── ftp-server.ts       # wraps `ftp-srv`, scoped filesystem to libraryRootPath
│       ├── network-share.service.ts # orchestrates both servers, config, status, events
│       └── local-network-guard.ts   # RFC1918 source-address enforcement (R5), shared by both servers
├── ipc/
│   └── network-share.ipc.ts        # registers `network-share:*` channels (contracts/network-share-ipc.md)
└── preload.ts                      # extend contextBridge surface (existing file, additive change)

src/
├── types/
│   └── opl.ts                      # add NetworkShareConfig/Status/ConnectedClient/Event + OplApi methods (additive)
├── stores/
│   └── network-share-store.ts      # Zustand store mirroring device-store.ts/log-store.ts conventions
└── components/
    └── network/                    # new UI: sharing toggle, status, guided setup tutorial (FR-004/FR-012)
        ├── NetworkShareStatus.tsx
        └── NetworkShareSetupTutorial.tsx

tests/ (or co-located *.test.ts per existing convention)
├── electron/services/network-share/smb/frame-codec.test.ts
├── electron/services/network-share/network-share.service.test.ts
└── src/components/network/NetworkShareStatus.test.tsx
```

**Structure Decision**: Extends the existing single Electron+React project — no new top-level project or package. New domain module under `electron/services/network-share/` mirrors the existing `electron/services/<domain>/` convention (e.g. `fragmentation-repair/`, `downloads/`). UI lives under a new `src/components/network/` folder, consistent with the existing per-domain component folder pattern (`src/components/device/`, `src/components/library/`).

## Complexity Tracking

> No unjustified Constitution violations — this section intentionally left empty.
