# Implementation Plan: Android OPL Network Library

**Branch**: `006-android-opl-network-library` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-android-opl-network-library/spec.md`

## Summary

Ship a new, independent Android app (`mobile/`, React Native + TypeScript, New Architecture) that turns an Android device into a portable OPL library: the user grants access to a folder via Storage Access Framework (SAF), the app catalogs it read-only, and a purpose-built minimal SMB1 server — implemented in Kotlin, running inside an Android Foreground Service (`connectedDevice` type) — exposes that folder to a PS2 running Open PS2 Loader over the local network, exactly as spec 005 does on desktop but reinterpreted for Android's process/permission model. No SMB **server** library exists for the JVM (research confirms JCIFS and `smb-kotlin` are clients only), so the mobile SMB1 server is a Kotlin port of spec 005's protocol _knowledge_ (frame format, command subset, hardware-validated OPL client behavior) — never its Node.js code. The React Native layer never touches SAF, sockets, or the Foreground Service directly; a typed TurboModule boundary (Codegen from TypeScript spec files) is this feature's equivalent of the desktop's `contextBridge`/`OplApi` contract.

## Technical Context

**Language/Version**: TypeScript 5.x (React Native app layer, matches desktop's TS discipline) + Kotlin (JVM 17, Android native module layer, min `compileSdk`/`targetSdk` tracking current Play Store policy — API 35 now, API 36 required from 2026-08-31 per Play Console policy).

**Primary Dependencies**: React Native 0.82+ (New Architecture is the only architecture as of 0.82 — JSI + Fabric + TurboModules, no legacy bridge) built via the Expo Modules API / prebuild workflow (not the fully-managed Expo Go workflow — a custom Foreground Service and raw TCP sockets require native code outside that sandbox); React Navigation (bottom tabs + stacks, mobile-native patterns per FR-011); Zustand (mirrors desktop's UI/session state convention); no SMB server dependency exists for the JVM — the SMB1 server is in-repo, purpose-built Kotlin (see `research.md` R5).

**Storage**: User-selected SAF document tree (read-mostly; limited PS2-initiated write per FR-018/FR-033) + Room (SQLite) for the local catalog index (`CatalogEntry`/`CatalogSnapshot`) + Android Keystore-backed encrypted storage for SMB credentials (mirrors desktop's `safeStorage` precedent) + a lightweight preferences store for `LibrarySelection` reference/app preferences.

**Testing**: Jest + React Native Testing Library (RN components/stores); JUnit (pure Kotlin domain logic — SMB1 frame codec, path confinement, catalog parsing); Android instrumented tests (`androidTest`) for SAF persisted-permission integration, which cannot be meaningfully unit-tested without a real `ContentProvider`; TCP integration tests for the SMB server's start/stop/auth/LAN-rejection behavior (mirrors desktop's real-socket integration tests, not mocks); a mandatory Hardware Smoke Test against a real PS2 + Open PS2 Loader (SC-009) — per Constitution Principle V and the explicit lesson already recorded in spec 005, the SMB implementation is never considered done just because a PC/emulator client can mount it.

**Target Platform**: Android 10+ (API 29+, the Scoped Storage baseline — spec Assumptions), targeting whatever API level Play Store policy currently requires at ship time; excludes iOS entirely (spec Out of Scope).

**Project Type**: Mobile app — new, independent Android app living alongside the existing desktop app in this repository (not a workspace-coupled monorepo package in this feature; see Project Structure decision below), with no backend/API tier (PS2 talks directly to the Android device over LAN).

**Performance Goals**: Sharing-state changes (start/stop/client connect/disconnect/error) surfaced in the UI within 10s (SC-004); a ~500-item catalog scan shows continuous progress and cancels within 2s (SC-003); serving a >4GB game file keeps app memory within a fixed, file-size-independent ceiling (SC-008) via chunked/seekable reads, never buffering a full file.

**Constraints**: SMB service off by default, explicit start only (FR-014); binds/accepts LAN-only, rejects non-LAN sources (FR-015); Foreground Service uses the `connectedDevice` type (not `dataSync`, which Android 15 caps at 6 hours — incompatible with FR-020's "for the duration of a PS2 usage session"), requiring `FOREGROUND_SERVICE_CONNECTED_DEVICE` plus the relevant network permission per Android 14+ manifest rules; no elevated/root permissions, no permissions beyond what FR-001/FR-008/FR-013 require (FR-029); credentials never logged or stored in plaintext (FR-030, Keystore-backed per R7); every served path confined to the SAF-authorized tree (FR-028).

**Scale/Scope**: Single Android device sharing to one or more PS2 units on one trusted home network at a time (same scale premise as desktop spec 005); reference library ~500 items (spec SC-002/SC-003, same precedent as desktop specs 001/003).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

The current constitution (`.specify/memory/constitution.md` v1.0.0) is written in Electron-specific terms (Principle II names `contextIsolation`/`nodeIntegration`/`sandbox`/`contextBridge` literally). Per spec.md's own "Nota sobre a Constituição do Projeto", this plan evaluates each principle's **intent** reinterpreted for Android, without editing the constitution file itself — a formal amendment/sibling-constitution decision remains open and is explicitly out of this plan's scope, as documented in spec.md.

1. **Principle I — Segurança em Operações Sensíveis** → **PASS**: No formatting/destructive device operations exist in this feature (explicitly out of scope). PS2 write-back (FR-018) is gated by a one-time explicit user acknowledgment distinct from setting SMB credentials, mirroring desktop spec 005's FR-014 justification for the same principle. Library selection is always explicit and never silently rediscovered (FR-001/FR-002).
2. **Principle II — Isolamento e Menor Privilégio** → **PASS (reinterpreted)**: There is no Electron main/renderer split on Android. Reinterpretation: the React Native/JS layer MUST NOT call SAF, socket, or Foreground Service APIs directly — every privileged operation crosses a typed TurboModule boundary (Codegen-generated from TS spec files under `mobile/src/native/`), the direct functional equivalent of `contextBridge`/`window.oplApi`. Requested Android permissions are minimal and justified per-FR (FR-029) — no `MANAGE_EXTERNAL_STORAGE`, no permissions beyond SAF + the specific foreground-service/network permissions FR-013/FR-020 require. This satisfies the principle's intent; the literal constitutional text still needs updating (see Constitution note above) but that is not a blocking gate for this plan.
3. **Principle III — Contratos Tipados e Limites de Camada** → **PASS**: TurboModule spec files under `mobile/src/native/` are the shared typed contract (Codegen enforces the TS↔Kotlin shape match at build time, stronger than the desktop's hand-maintained `contextBridge` surface). `mobile/src/types/` holds the DTOs (`LibrarySelection`, `CatalogEntry`, `SharingSession`, etc. — see `data-model.md`), naming-compatible with `src/types/opl.ts` concepts (e.g. `GameMediaType`) without importing from it (no Electron coupling, per spec Input). React Native screens/components never touch SAF/socket/Room APIs directly, only the typed native module wrappers.
4. **Principle IV — Integridade, Rastreabilidade e Recuperação** → **PASS**: `SharingSession`/`CatalogSnapshot` expose explicit states with progress and cancellation (FR-010/FR-019); `LocalHistoryEntry` persists a minimal operation history (FR-027); concurrent-write handling (FR-033) prevents corruption when the PS2 and the app's own UI touch the same file; credentials use Android Keystore-backed storage, never plaintext (FR-030, mirrors desktop's `safeStorage` — see `research.md` R7). No staging/promotion mechanism is needed for the app's own writes because the app itself performs none (FR-007) — the only writes are PS2-initiated, explicitly consented (FR-018), and conflict-safe (FR-033).
5. **Principle V — Evolução Incremental Verificada** → **PASS (with commitment)**: The SMB1 frame codec/command handlers are new protocol-handling domain logic and MUST have JUnit tests (parsing/framing) plus TCP integration tests (service boundary: start/stop/auth/LAN-rejection), per `research.md` R5/R8. SAF integration requires Android instrumented tests (a real `ContentProvider` cannot be meaningfully unit-tested). Real-PS2 hardware validation (`quickstart.md` Hardware Smoke Test, SC-009) is additionally required — protocol-compatibility risk is this plan's primary risk and cannot be fully covered by unit tests, exactly as already learned in desktop spec 005.

No unjustified violations — Complexity Tracking section below is empty accordingly.

## Project Structure

### Documentation (this feature)

```text
specs/006-android-opl-network-library/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/                       # Phase 1 output
│   ├── native-modules.md            # RN ↔ Kotlin TurboModule contract
│   └── smb-protocol-scope.md        # SMB1 command subset contract (OPL-facing wire behavior, not implementation)
└── tasks.md                         # Phase 2 output (speckit-tasks — not created here)
```

### Source Code (repository root)

```text
mobile/                               # New, independent Android app — NOT a port of electron/
├── android/                          # Native Android project (Kotlin)
│   └── app/src/main/java/com/oplforge/mobile/
│       ├── library/
│       │   ├── LibrarySelectionModule.kt    # TurboModule: pick/persist/revalidate SAF tree (FR-001–FR-005)
│       │   └── SafDocumentTree.kt           # DocumentFile/DocumentsContract traversal, confined to granted tree
│       ├── catalog/
│       │   ├── CatalogScanner.kt            # read-only scan: type/Game ID/title/ext/size/art/naming (FR-006–FR-010)
│       │   └── CatalogIndexStore.kt         # Room DAO for CatalogEntry/CatalogSnapshot
│       ├── sharing/
│       │   ├── smb/
│       │   │   ├── FrameCodec.kt            # SMB1 message parsing/framing (unit-tested, ported protocol knowledge from spec 005)
│       │   │   ├── CommandHandlers.kt       # subset of SMB1 commands OPL's client actually uses
│       │   │   └── SmbServer.kt             # socket lifecycle, LAN-only binding (FR-014/FR-015)
│       │   ├── LocalNetworkGuard.kt         # RFC1918 source-address enforcement, same approach as desktop R5
│       │   ├── SharingForegroundService.kt  # Foreground Service, connectedDevice type, persistent notification (FR-020–FR-022)
│       │   ├── SharingSessionModule.kt      # TurboModule: start/stop/status/write-ack (FR-013–FR-019)
│       │   └── CredentialStore.kt           # Keystore-backed credential storage (FR-017, FR-030)
│       └── shared/
│           ├── PathConfinement.kt           # traversal-confinement helper shared by catalog + smb (FR-028)
│           └── TypedEventEmitter.kt         # native → RN event bridge (SharingSessionEvent/CatalogScanEvent)
├── src/                               # React Native (TypeScript) app layer
│   ├── native/                        # typed wrappers over generated TurboModule specs — the "API tipada" boundary
│   │   ├── LibraryModule.ts
│   │   ├── CatalogModule.ts
│   │   └── SharingModule.ts
│   ├── types/                         # mobile DTOs, naming-compatible with src/types/opl.ts (no import coupling)
│   ├── stores/                        # Zustand: library-store, catalog-store, sharing-store
│   ├── screens/
│   │   ├── Home/                      # US5 — at-a-glance state (FR-025)
│   │   ├── LibrarySelect/             # US1
│   │   ├── Library/                   # US6 — mobile-native browsing (FR-011)
│   │   ├── Sharing/                   # US3
│   │   └── Tutorial/                  # US4 — guided PS2 setup (FR-023)
│   ├── navigation/                    # bottom tabs + stacks
│   ├── design-system/                 # OPL Forge tokens (dark/violet/emerald-amber-red) ported to RN primitives (FR-012)
│   └── app/                           # RN entry point, providers
└── __tests__/
    ├── src/                           # Jest + React Native Testing Library
    └── (Kotlin tests live under android/app/src/test and android/app/src/androidTest, colocated per Android convention)
```

**Structure Decision**: New top-level `mobile/` app, sibling to the existing `electron/`/`src/` desktop project — not a port, not sharing a build pipeline or workspace with the desktop app in this feature. Type/domain sharing readiness is satisfied structurally (naming-compatible DTOs in `mobile/src/types/`) rather than via a premature shared package: extracting a real `@oplforge/domain` workspace package is deferred until a second consumer's actual needs are known (Constitution Principle V — "complexidade adicional MUST ser justificada por um requisito atual, não apenas por uma possibilidade futura"). The RN↔Kotlin boundary (`mobile/src/native/` ↔ `mobile/android/.../*Module.kt`) is this project's equivalent of `electron/preload.ts` + `src/services/api.ts`.

## Complexity Tracking

> No unjustified Constitution violations — this section intentionally left empty.
