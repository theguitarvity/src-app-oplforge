# Phase 0 Research: Android OPL Network Library

## R1: React Native project/tooling strategy

**Decision**: React Native 0.82+ (New Architecture — JSI + Fabric + TurboModules is the only architecture as of 0.82; the legacy bridge is gone) built via the **Expo Modules API on the prebuild/dev-client workflow**, not the fully-managed Expo Go workflow.

**Rationale**: This feature's hardest requirements — a custom Android Foreground Service (FR-020–FR-022) and a raw-socket SMB1 server (FR-013) — need native Kotlin code that does not exist in the managed Expo Go sandbox; both require a custom dev client / prebuilt native project regardless of tooling choice. Given that, the Expo Modules API is still worth adopting on top of the bare/prebuild project: as of 2026 it provides a first-class Kotlin authoring surface for native modules (no manual JNI/ObjC-bridging boilerplate) and integrates directly with the New Architecture's JSI, while leaving the native Android project fully accessible for the Foreground Service and socket code that live outside any module API.

**Alternatives considered**:

- Fully-managed Expo Go workflow — rejected: cannot ship the required Foreground Service or raw sockets at all.
- Bare React Native CLI without Expo tooling — viable but rejected as the default: more manual native-project boilerplate for no capability gain, since the custom native code this feature needs (SMB socket server, Foreground Service) lives in the native Android project either way, not inside a module-API sandbox.

Sources: [React Native New Architecture 2026: JSI & Production Guide](https://softaims.com/blog/react-native-new-architecture-2026), [Turbo vs Nitro Modules: RN Guide 2026](https://reactnativerelay.com/article/building-native-modules-2026-turbo-expo-nitro-compared), [React Native New Architecture Migration Guide (2026)](https://www.agilesoftlabs.com/blog/2026/03/react-native-new-architecture-migration)

## R2: React Native ↔ Kotlin boundary

**Decision**: TurboModules (Codegen-generated from TypeScript spec files under `mobile/src/native/`) for request/response calls (select library, start/stop sharing, get catalog snapshot) plus a typed native→JS event emitter for streaming state (mirrors desktop's `on<Domain>Event` convention — `SharingSessionEvent`, `CatalogScanEvent`). The SMB server's actual per-request file I/O (serving bytes to the PS2) runs **entirely inside Kotlin**, on its own socket-accept loop — it never crosses the JS bridge on the hot path.

**Rationale**: Constitution Principle III requires a typed contract at every layer boundary; Codegen enforces that the TS and Kotlin shapes actually match at build time, which is stronger than the desktop's hand-maintained `contextBridge` surface. Keeping SMB byte-serving off the JS bridge is required by FR-026/SC-008 (streaming, fixed memory ceiling) — routing multi-gigabyte file reads through the bridge would add serialization overhead and defeat the memory-ceiling goal regardless of module-call efficiency.

**Alternatives considered**: Proxying every SMB read through a JS-side TurboModule call — rejected, adds per-chunk bridge overhead and couples the network hot path to JS thread scheduling, both counter to FR-026.

## R3: Storage Access Framework mechanics

**Decision**: `ACTION_OPEN_DOCUMENT_TREE` for library selection (FR-001), immediately followed by `ContentResolver.takePersistableUriPermission()` to request persistence (FR-003). On every app launch, cross-check the stored `LibrarySelection.treeUri` against `ContentResolver.getPersistedUriPermissions()`; a mismatch or absence surfaces FR-004's "access lost" state rather than continuing silently. Use `DocumentFile`/`DocumentsContract` for the top-level catalog scan (bounded by the ~500-item scale target, spec Scale/Scope) but **not** for the SMB server's per-file byte-serving path, where `ContentResolver.openFileDescriptor()` is used to get a seekable `ParcelFileDescriptor` (research confirms plain pipe FDs don't support seeking, which chunked/ranged reads for large ISOs require — FR-026).

**Rationale**: This is the standard, currently-documented Android mechanism for exactly this use case (persistent access to a user-chosen folder without broad storage permissions — satisfies FR-029's "no more than necessary" alongside Principle II's least-privilege intent). `DocumentFile` is explicitly flagged in current guidance as impractical for large numbers of files due to per-call IPC overhead, which is why the scan path and the serve path use different Android APIs even though both read from the same SAF tree.

**Alternatives considered**: `MANAGE_EXTERNAL_STORAGE` / legacy broad filesystem access — rejected outright, directly violates FR-029 and Principle II's least-privilege intent, and is a Play Store policy risk independent of this feature.

Sources: [Access documents and other files from shared storage — Android Developers](https://developer.android.com/training/data-storage/shared/documents-files), [Open files using the Storage Access Framework — Android Developers](https://developer.android.com/guide/topics/providers/document-provider), community findings on `DocumentFile` performance and `StorageManager.openProxyFileDescriptor` for seekable access.

## R4: USB-OTG library source scope (resolved per spec Clarification)

**Finding**: SAF's `ACTION_OPEN_DOCUMENT_TREE` picker natively surfaces USB-OTG-attached storage as a "transient root" — it appears in the system folder picker only while the device is physically connected, through the same document-provider interface as internal storage/SD cards. No USB-specific code path is required in the app for the picker itself to support FR-005's dual scope (internal/SD **and** USB-OTG).

**Residual risk carried into implementation** (not blocking this plan): whether a _specific_ USB-OTG drive is exposed as a SAF-compatible document provider at all is OEM/Android-build dependent and outside this app's control. Per spec.md's edge cases, this is handled as a first-class "unsupported/unreachable via SAF" error state, not special-cased per vendor.

Sources: same as R3.

## R5: SMB server implementation for Android

**Finding**: There is no maintained, production-viable SMB **server** library for the JVM/Android — confirmed for 2026, the same gap desktop spec 005's R3 already found for Node.js. `codelibs/jcifs` (actively maintained, updated Feb 2026) and `smb-kotlin` (the only pure-Kotlin SMB library for Android) are both SMB **client** libraries; neither implements server-side protocol handling.

**Decision**: A purpose-built, minimal SMB1/CIFS server in Kotlin, implementing only the command subset OPL's IOP-side SMB client actually uses (directory listing, file read, limited file write, session/auth) — the same "Option C" shape as desktop spec 005's R3, now on a different runtime. This is **not** a port of the desktop's Node.js code (`Buffer`/`net` APIs don't exist on Android/JVM) — it is a re-implementation in Kotlin of the same wire-format knowledge, informed by:

- The desktop implementation's frame-codec/command-handler structure as a design reference (`electron/services/network-share/smb/`).
- The desktop's own hardware-validation history (spec 005's `quickstart.md` Scenario 2) as a starting point for which OPL client behaviors matter — still requiring this app's own Hardware Smoke Test (SC-009) since Android's socket/threading model and file-descriptor behavior differ enough from Node's that compatibility cannot be assumed transitively.

**Rationale**: Reusing validated protocol _knowledge_ without reusing runtime-incompatible code avoids repeating desktop's original protocol-discovery research from scratch, while respecting Constitution Principle V's "escopo mínimo coerente" — no general-purpose SMB server, only what OPL's client needs.

**Alternatives considered**:

- Bundling `codelibs/jcifs` or `smb-kotlin` in a server role — rejected, both are client libraries; there is no server mode to configure.
- Shelling out to a bundled third-party SMB server binary — rejected, no such Android-embeddable binary exists in this space, and it would reintroduce the elevated-privilege/OS-orchestration problems desktop's R3 explicitly rejected (Option A) for the same reasons on Android (no root, no system-level share APIs on unrooted Android).

Sources: [GitHub - codelibs/jcifs](https://github.com/codelibs/jcifs), [smb-kotlin](https://smbkotlin.com/), desktop `specs/005-ps2-network-transfer/research.md` R3.

**Correction found during on-device implementation**: Port 445 (SMB's IANA-assigned standard port) is a privileged port (<1024) — binding it from an unprivileged Android app throws `java.net.BindException: bind failed: EACCES (Permission denied)`, confirmed via a real crash on a Pixel 10 Pro emulator (no root, standard app). This is unrelated to Android version/manifest permissions — it's the same POSIX privileged-port restriction present on any unrooted Unix-like system, and desktop's Node.js server never hit it because desktop processes commonly run with the necessary privilege (or the OS grants port 445 differently) in ways a sandboxed Android app cannot replicate. **Decision**: default to port 1445 instead. **Open question for the Hardware Smoke Test (SC-009)**: whether OPL's ETH-mode "Servidor SMB" client configuration screen accepts a custom port at all, or hardcodes 445 — if the latter, this becomes a hard blocker requiring a different mitigation (e.g. Linux `CAP_NET_BIND_SERVICE`-equivalent isn't available to Android apps without root, so the realistic options narrow to: confirm OPL supports a custom port, or accept that this app cannot use SMB's IANA-standard port on Android). This was not surfaced by any of the desk research above and could not have been without an actual bind attempt on-device.

## R6: Foreground Service design (FR-020–FR-022)

**Decision**: `SharingForegroundService` declares `android:foregroundServiceType="connectedDevice"`, requiring the `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission plus the applicable network permission, per Android 14+'s mandatory manifest service-type declaration. Started only from an explicit user action (never from boot or any background trigger — FR-022), backed by a persistent, un-dismissable-without-stopping notification (FR-021) with a direct stop action.

**Rationale**: `connectedDevice` is both the semantically correct type ("interactions with an external device that require ... a network connection" — this is exactly the PS2 relationship) and the type that avoids Android 15's newly-added 6-hour cap on `dataSync`-type foreground services, which is incompatible with FR-020's "operational for the duration of a PS2 usage session" (a long play/browse session could plausibly exceed 6 hours). `dataSync` was considered and is a closer _literal_ description of "serving files," but its time cap makes it the wrong choice given this feature's actual duration requirement.

**Build-time commitment (not a one-time decision)**: Android's foreground-service policy has changed release-over-release (new caps/types introduced at API 34 and again at 35, per research) and Play Store target-API requirements move roughly yearly. Implementation MUST re-verify the current `connectedDevice` rules (and whether newer Android versions targeted at build time impose additional constraints) against whatever API level the app actually targets when built — tracked as a quickstart validation step, not assumed permanently stable from this research.

**Correction found during on-device implementation (not caught by desk research above)**: `connectedDevice` requires `FOREGROUND_SERVICE_CONNECTED_DEVICE` _plus_ at least one of a specific permission set (`BLUETOOTH_ADVERTISE`/`_CONNECT`/`_SCAN`, `CHANGE_NETWORK_STATE`, `CHANGE_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `NFC`, `TRANSMIT_IR`, `UWB_RANGING`, `RANGING`, or a declared USB device/accessory intent-filter) — omitting this second permission throws `SecurityException` at `startForeground()` on API 35/36 (confirmed via real crash on a Pixel 10 Pro emulator, targetSdk 36), not merely a lint warning. `CHANGE_WIFI_STATE` was added since this service's "connected device" relationship is inherently over Wi-Fi. This wasn't surfaced by the Android Developers documentation pages cited above and is exactly the kind of gap `quickstart.md`'s Hardware Smoke Test exists to catch — except here it surfaced even earlier, on first real emulator run.

Sources: [Foreground service types — Android Developers](https://developer.android.com/develop/background-work/services/fgs/service-types), [Foreground service types are required — Android Developers](https://developer.android.com/about/versions/14/changes/fgs-types-required), [Changes to foreground services — Android Developers](https://developer.android.com/develop/background-work/services/fgs/changes), [Android Foreground Services in 2026: What Changed and How to Adapt](https://dev.to/joe_wang_6a4a3e51566e8b52/android-foreground-services-in-2026-what-changed-and-how-to-adapt-2o3d)

## R7: Local persistence strategy (FR-027)

**Decision**:

- **Catalog index** (`CatalogEntry`/`CatalogSnapshot`, up to ~500 rows): Room (SQLite) — structured, queryable, type-safe DAOs suit a bounded but non-trivial row count better than hand-rolled JSON.
- **SMB credentials** (`SharingSession` username/password): Android Keystore-backed encrypted storage (e.g. `EncryptedSharedPreferences` or direct Keystore-wrapped storage) — direct functional equivalent of desktop's Electron `safeStorage` precedent; never plaintext (FR-030, Principle IV).
- **`LibrarySelection` reference, preferences, minimal history**: a lightweight local key-value/preferences store. The actual OS-level persisted-URI grant is managed by Android itself (R3) — the app only stores a _reference_ to it plus revalidation metadata, not the grant itself.

**Rationale**: Matches spec.md's own deferred-decision framing ("avaliar se Room/SQLite ou outra solução é apropriada") by picking Room specifically for the structured catalog index, while not over-applying a relational database to simple preference/reference data. Mirrors desktop's constitution note that its own JSON persistence is already flagged as an eventual SQLite migration candidate — this app starts where desktop is heading, for the piece of state (a real per-item catalog) that actually benefits from it.

**Alternatives considered**: A single hand-rolled JSON blob for everything (desktop's current approach) — rejected specifically for the catalog index (query/filter needs at ~500 rows favor Room), acceptable and simpler for preferences/history, which remain low-structure. Plaintext `SharedPreferences` for credentials — rejected, violates Principle IV (no secrets in plain persistence).

## R8: Testing strategy (spec.md Decisions Deferred #11)

**Decision**: Layered per Constitution Principle V, proportional to risk:

| Layer                                            | Tool                                            | Scope                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript rules / RN components / stores        | Jest + React Native Testing Library             | `mobile/src/**` — screens, stores, native-module wrapper contracts (mocked native layer)                                                                                 |
| Kotlin domain logic (pure, no Android framework) | JUnit (local, JVM-only)                         | `FrameCodec`, `PathConfinement`, catalog naming/Game-ID parsing                                                                                                          |
| SAF integration                                  | Android instrumented tests (`androidTest`)      | Persisted-permission lifecycle, tree traversal confinement — cannot be meaningfully unit-tested without a real `ContentProvider`                                         |
| SMB protocol / service boundary                  | TCP integration tests (real sockets, not mocks) | Start/stop/auth/LAN-rejection, mirroring desktop spec 005's integration-test approach                                                                                    |
| Real-world compatibility                         | **Hardware Smoke Test** (mandatory, SC-009)     | Real PS2 + Open PS2 Loader — the SMB implementation is never "done" because a PC/emulator client can mount it; same explicit lesson already recorded in desktop spec 005 |

**Rationale**: Directly satisfies Constitution Principle V ("testes automatizados proporcionais ao risco... Fluxos críticos... MUST incluir testes de integração nos limites... quando esses limites forem alterados") and spec.md's own Decisions Deferred #11, which explicitly names each of these layers.
