# Implementation Plan: iOS OPL Network Library

**Branch**: `009-ios-opl-network-library` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-ios-opl-network-library/spec.md`

## Summary

Port the existing Android-only mobile app (`mobile/`, specs 006-008) to iOS with real functional parity, not a stub scaffold. The React Native/TypeScript screens, navigation, Zustand stores, and design system are already cross-platform and are reused unchanged. The work is entirely in the native layer: `expo prebuild -p ios` scaffolds the Xcode project, and each of the 7 existing Kotlin TurboModules (`LibraryModule`, `CatalogScanModule`, `SharingModule`, `TransferQueueModule`, `EssentialsModule`, `DiagnosticsModule`, `ArtSyncModule`) gets a Swift implementation registered under the same TurboModule names/specs already Codegen'd from `mobile/src/native/specs/*.ts` — the JS↔native contract does not change, only which native language answers it. The SMB1 server itself (frame codec, NTLMv1, the exact command subset already hardware-validated against a real PS2: NEGOTIATE/SESSION_SETUP_ANDX/TREE_CONNECT_ANDX/ECHO/NT_CREATE_ANDX/OPEN_ANDX/READ_ANDX/WRITE_ANDX/CLOSE/TRANSACTION2/CHECK_DIRECTORY) is a direct Swift port of the Kotlin implementation's protocol logic (`mobile/android/.../sharing/smb/`), not a re-derivation — the wire-format knowledge is already correct and hardware-proven; only the socket/threading/storage plumbing around it is platform-specific. Two points genuinely have no Android equivalent and are new design, not porting: storage access (`SafDocumentTree` → `UIDocumentPickerViewController` + `NSURL` security-scoped bookmarks) and keeping the SMB server alive (`Foreground Service` → no direct iOS equivalent; the app must stay foregrounded, and the UI must actively surface suspension instead of showing a stale "connected" state).

## Technical Context

**Language/Version**: TypeScript 5.x (React Native app layer, unchanged) + Swift 5.9+ (new iOS native module layer, replacing Kotlin for this platform only — the Android Kotlin implementation is untouched and continues to ship).

**Primary Dependencies**: React Native 0.82+ New Architecture (JSI + Fabric + TurboModules — already in use, this feature adds the iOS native side of the same Codegen'd specs) via Expo prebuild (`expo prebuild -p ios`, not Expo Go — a background-constrained TCP listener and raw file-system bookmarks need native code outside that sandbox, same reasoning as the existing Android `-p android` choice); `Network.framework` (`NWListener`/`NWConnection`) for the SMB1 TCP server, replacing `java.net.ServerSocket`; `CryptoKit`/`CommonCrypto` for NTLMv1 (MD4 + DES — CryptoKit has no MD4, so MD4 is a direct Swift port of the existing hand-rolled Kotlin implementation, already verified against the published MS-NLMP test vector); no third-party SMB or document-picker library — both are built on Apple's own frameworks, matching the existing "no SMB server library exists, this is purpose-built" precedent from spec 006's research.

**Storage**: User-selected folder via `UIDocumentPickerViewController` (`.open` mode), referenced by an `NSURL` security-scoped bookmark persisted in `UserDefaults` (the iOS analog of the Android `LibraryPreferences` reference store — the bookmark itself, not a raw path, is the thing that survives app restarts) + Core Data or a lightweight SQLite table (via the same catalog-index shape as `CatalogEntry`/`CatalogSnapshot`) for the local catalog index + iOS Keychain (`kSecClassGenericPassword`) for SMB credentials, replacing Android Keystore-backed `EncryptedSharedPreferences` — same "never plaintext, never logged" guarantee, platform-native mechanism.

**Testing**: Jest + React Native Testing Library (already covers the cross-platform JS layer, no change needed); XCTest for Swift domain logic (SMB1 frame codec, NTLMv1, path confinement, catalog parsing — the direct Swift-side equivalent of the existing JUnit suite, same test cases ported where the logic is a direct port); a real-file XCTest fixture equivalent to the existing `ZipCentralDirectoryParserTest`-style byte-fixture tests for Art Sync's ZIP64 parser (pure logic, no framework dependency, ports directly); a mandatory Hardware Smoke Test against a real PS2 + Open PS2 Loader from a physical iPhone (SC-007) — simulator-only or code-review-only verification is explicitly insufficient, same lesson already learned twice in this repo (desktop spec 005, Android spec 006) and restated in spec.md's own Success Criteria.

**Target Platform**: iOS 16+ (a reasonable current baseline for `UIDocumentPickerViewController`'s modern `.open` API and `Network.framework` maturity; final floor to be confirmed in research.md against current App Store minimum-OS practice at implementation time), physical iPhone required for the SMB server / Local Network permission / hardware smoke test (the iOS Simulator does not have a real Local Network stack reachable from a PS2 on the LAN).

**Project Type**: Mobile app — new iOS native module tree living alongside the existing `mobile/android/` Kotlin tree in the same React Native app (`mobile/ios/`), not a separate app or repository. No backend/API tier changes (same LAN-direct model as Android).

**Performance Goals**: Same as spec 006 where the underlying operation is identical — sharing-state changes surfaced in the UI within 10s, a ~500-item catalog scan shows continuous progress and cancels within 2s, serving a >4GB game file keeps memory within a fixed, file-size-independent ceiling via chunked/seekable reads (never buffering a full file — `FileHandle` seek+read, the Swift equivalent of the Kotlin `ParcelFileDescriptor` chunked-read approach).

**Constraints**: SMB service off by default, explicit start only, and requires the app to remain foregrounded for the duration of sharing (spec.md Assumptions — the one place this plan's constraints genuinely diverge from Android's, since there is no `connectedDevice`-type Foreground Service equivalent to keep an `NWListener` alive indefinitely in the background); binds/accepts LAN-only; Local Network usage description (`NSLocalNetworkUsageDescription`) and Bonjour service declaration (`NSBonjourServices`) required in `Info.plist` per iOS 14+ local-network privacy rules, with a clear in-app explanation shown before the system permission prompt fires (denying it must produce an actionable error, not a silent connect failure); iCloud Drive "on-demand" files (not yet downloaded locally) MUST be resolved (`NSFileCoordinator`/`startDownloadingUbiquitousItem`) before being served over SMB, never served partial or left to hang a READ_ANDX indefinitely; credentials never logged or stored in plaintext (Keychain-backed); every served path confined to the security-scoped bookmark's authorized tree (same path-confinement discipline as `PathConfinement.kt`, ported directly).

**Scale/Scope**: Same as Android — a single iPhone sharing to one or more PS2 units on one trusted home network at a time; reference library ~500 items.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

The current constitution (`.specify/memory/constitution.md` v1.0.0) is written in Electron-specific terms, and spec 006 already established the precedent of evaluating each principle's **intent** reinterpreted for a native mobile platform rather than editing the constitution file per-platform. This plan follows the same precedent, one platform further (iOS rather than Android).

1. **Principle I — Segurança em Operações Sensíveis** → **PASS**: No formatting/destructive device operations exist in this feature (unchanged from spec 006 — explicitly out of scope). PS2 write-back is gated by the same explicit, distinct write-access acknowledgment already required on Android (spec 006 FR-018, unchanged behavior here). Essentials downloads keep the same mandatory per-item/per-batch legal confirmation (FR-011).
2. **Principle II — Isolamento e Menor Privilégio** → **PASS (reinterpreted, consistent with spec 006's precedent)**: There is no Electron process split on iOS either. The React Native/JS layer MUST NOT call `UIDocumentPickerViewController`, `Network.framework`, or Keychain APIs directly — every privileged operation crosses the same typed TurboModule boundary already Codegen'd from `mobile/src/native/specs/*.ts` (unchanged specs; only the native implementation behind them is new). Requested iOS capabilities are minimal and justified per-FR: Local Network + document-picker access only, no broader entitlements.
3. **Principle III — Contratos Tipados e Limites de Camada** → **PASS**: The TurboModule specs under `mobile/src/native/specs/` are the single shared typed contract for _both_ platforms — this plan adds a Swift implementation behind the existing contract, it does not create a second contract. `mobile/src/types/` DTOs are unchanged. React Native screens continue to never touch document-picker/socket/Keychain APIs directly.
4. **Principle IV — Integridade, Rastreabilidade e Recuperação** → **PASS, with one new explicit requirement**: `SharingSession` state and `CatalogSnapshot` progress/cancellation carry over unchanged in shape. The one new integrity concern unique to iOS is FR-008/FR-016: the UI MUST actively surface app-suspension-interrupted sharing (rather than showing stale "connected" state) and MUST resolve iCloud on-demand files before serving them over SMB rather than risk a hung or corrupted transfer — both are explicit functional requirements in spec.md, not deferred follow-ups.
5. **Principle V — Evolução Incremental Verificada** → **PASS (with commitment, same as spec 006)**: The Swift SMB1 frame codec/command handlers/NTLMv1 are a port of already-tested domain logic and MUST carry the equivalent XCTest coverage (frame parsing, NTLMv1 against the same published test vector, path confinement). Document-picker/security-scoped-bookmark integration needs on-device iOS testing (an `XCUITest` or manual protocol, since the Simulator's document-picker and bookmark persistence do not fully represent real-device behavior). Real-PS2 hardware validation from a physical iPhone (spec.md SC-007) is required before any user story in this feature is considered done — protocol-compatibility and background-execution risk are this plan's primary risks and cannot be covered by unit tests or Simulator runs alone.

No unjustified violations — Complexity Tracking section below is empty accordingly.

## Project Structure

### Documentation (this feature)

```text
specs/009-ios-opl-network-library/
├── plan.md                          # This file
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/                       # Phase 1 output
│   ├── native-modules-ios.md        # Confirms the existing RN↔native TurboModule contract is unchanged; documents the Swift-side implementation notes per module
│   └── smb-protocol-scope.md        # Reused/linked from specs/006 — same wire-format contract, no iOS-specific changes
└── tasks.md                         # Phase 2 output (speckit-tasks — not created here)
```

### Source Code (repository root)

```text
mobile/
├── ios/                              # New: expo prebuild -p ios output (Xcode project, Podfile, Info.plist)
│   └── OplForgeMobile/
│       ├── Library/                  # LibraryModule.swift — document picker + security-scoped bookmarks
│       ├── Catalog/                  # CatalogScanModule.swift — mirrors CatalogScanner.kt logic
│       ├── Sharing/
│       │   └── Smb/                  # SmbServer.swift, CommandHandlers.swift, NtlmV1.swift, FrameCodec.swift — direct Swift port of mobile/android/.../sharing/smb/
│       ├── Transfer/                 # TransferQueueModule.swift — durable queue, BackgroundTasks-scheduled where possible
│       ├── Essentials/               # EssentialsModule.swift, LibretroArtIndex.swift, SmartFillPlanner.swift
│       ├── Diagnostics/              # DiagnosticsModule.swift
│       ├── Art/                      # ArtSyncModule.swift, ZipCentralDirectoryParser.swift (direct port)
│       └── Shared/                   # PathConfinement.swift, WriteLock.swift, TypedEventEmitter.swift equivalents
├── android/                          # Existing Kotlin implementation — unchanged by this feature
└── src/                              # Existing React Native app — unchanged by this feature (already cross-platform)
```

**Structure Decision**: iOS native code lives under `mobile/ios/`, generated by `expo prebuild -p ios` and then hand-extended, mirroring `mobile/android/app/src/main/java/com/oplforge/mobile/`'s package-per-domain layout one-to-one (`sharing/smb/`, `essentials/`, `catalog/`, `diagnostics/`, `art/`, `library/`, `transfer/`, `shared/`) so any future protocol/behavior fix is easy to apply to both platforms in parallel rather than hunting for the equivalent file. The TypeScript app under `mobile/src/` is not restructured — this feature adds `ios: {...}` to `app.json` (bundle identifier, Local Network/document-picker permission strings, `expo-build-properties` iOS deployment target) alongside the existing `android: {...}` block, and removes the `-p android` hardcoding from the `prebuild` script.

## Complexity Tracking

> No violations — table intentionally empty.
