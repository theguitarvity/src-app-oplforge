# Phase 0 Research: iOS OPL Network Library

## R1: iOS deployment target and prebuild strategy

**Decision**: iOS 16.0 minimum deployment target, via `expo prebuild -p ios` (Expo's prebuild/dev-client workflow, not Expo Go) — same tooling posture as Android's R1 decision, applied to the second platform.

**Rationale**: `UIDocumentPickerViewController`'s modern `.open`-mode API (folder selection with security-scoped bookmark persistence, not the older `.import`/copy-in behavior) and `Network.framework`'s `NWListener` are both stable well before iOS 16; 16.0 is a conservative floor that avoids chasing bleeding-edge APIs for a feature whose real risk is protocol/background-execution correctness, not API availability. Expo Go is a non-starter for the same reason it was rejected on Android: a raw TCP listener and native document-picker/bookmark code do not exist in the managed sandbox — a custom dev client is required regardless of the deployment-target choice.

**Alternatives considered**: A higher floor (iOS 17+) to access newer background-task APIs — rejected for now; the background-execution constraint (R3) is a hard platform limit that a higher deployment target does not remove, so raising the floor buys nothing here and only shrinks the addressable device pool.

## R2: Storage access — document picker and security-scoped bookmarks

**Decision**: `UIDocumentPickerViewController(forOpeningContentTypes: [.folder])` for library selection, immediately calling `url.startAccessingSecurityScopedResource()` and persisting `try url.bookmarkData(options: .minimalBookmarkLength)` in `UserDefaults` (the iOS analog of `LibraryPreferences`). On every app launch, resolve the stored bookmark via `URL(resolvingBookmarkData:...)`; a `isStale` result or a thrown resolution error surfaces the same "access lost" state Android's `revalidateAccess()` already models (spec.md FR-002), not a silent continue. Every native-module call that touches the library tree brackets its work in `startAccessingSecurityScopedResource()`/`stopAccessingSecurityScopedResource()` pairs — unlike Android's SAF grant (which is ambient once persisted), iOS's security scope must be actively entered per access window.

**Rationale**: This is Apple's documented, current mechanism for exactly this use case (persistent access to a user-chosen folder without full-disk access entitlements) — the direct functional analog of Android's `ACTION_OPEN_DOCUMENT_TREE` + `takePersistableUriPermission()` pairing from spec 006's R3. There is no scale concern equivalent to Android's `DocumentFile`-performance caveat: `FileManager`/`FileHandle` operate on a resolved `URL` directly once the security scope is active, with no per-call IPC overhead comparable to Android's `ContentProvider` round-trips.

**Alternatives considered**: `.import`-mode document picker (copies the chosen folder's contents into the app's own sandbox) — rejected outright, defeats the entire premise of sharing the user's existing library in place; `NSOpenPanel`-style broad filesystem access — does not exist on iOS, App Sandbox has no equivalent escape hatch outside the document picker.

## R3: Keeping the SMB server alive — the platform gap with no clean answer

**Finding**: iOS has no direct equivalent to Android's `connectedDevice`-type Foreground Service for keeping an arbitrary TCP listener alive indefinitely while the app is backgrounded or the screen is locked. The realistic background-execution primitives — `BGTaskScheduler` (short, system-scheduled maintenance windows, not a persistent listener), the `voip`/`audio`/`location`/`bluetooth-central` background modes (each tied to a real, ongoing activity of that specific kind, and using one to disguise an unrelated TCP server is both against documented App Review guidance and unreliable in practice), and Local Network `NWListener` itself (which iOS suspends along with the rest of the app's process once backgrounded, closing the socket) — none provide what the Android Foreground Service does here.

**Decision**: The SMB server requires the app to remain in the foreground (screen on, app not backgrounded) for the duration of a sharing session, exactly as spec.md's Assumptions already state. Two concrete mitigations make this a deliberate, well-designed constraint rather than a vague warning:

1. **Dedicated full-screen "Sharing" view**: while a session is active, the app shows a dedicated screen whose entire purpose is signaling "this needs to stay open" (status, connected client, address/port — the same information the existing Sharing screen already shows, just framed as the thing the user is meant to leave in front of them, not navigate away from).
2. **`UIApplication.shared.isIdleTimerDisabled = true`** for the duration of the session, cleared the moment sharing stops (matches the pattern navigation/reader apps use to prevent the screen auto-locking from inactivity — Waze, Kindle, etc.). This eliminates the single most common way a session would drop by accident: the user starts sharing, walks away, and the screen locks itself a minute later with no action from them.

**What this does not solve** (must not be oversold in the UI copy): `isIdleTimerDisabled` only suppresses the _automatic_ inactivity lock. It has no effect on the user pressing the physical side button, manually leaving the app, or an interruption (incoming call, another app taking focus) — all of these still background/suspend the app exactly as before, and still trigger the `'suspended'` state below. The improvement is real (the most common accidental-drop path is closed) but it is a UX mitigation for the foreground constraint, not a removal of it.

The native `SharingModule` MUST observe app-lifecycle notifications (`UIApplication.willResignActiveNotification` / `didBecomeActiveNotification`, or `UIScene` lifecycle on newer targets) and, on backgrounding, proactively tear down the listener and emit a session-state change the JS layer surfaces immediately (spec.md FR-008) — rather than leaving a socket that iOS will forcibly close moments later to fail silently against an already-confused PS2 client.

**Rationale**: This is not a workaround to be improved later — it is the actual shape of what iOS allows for this class of feature, and spec.md's own Assumptions section already commits to treating it as a real, disclosed product constraint rather than a bug. The full-screen view + disabled idle timer turns "keep the app open" from a passive warning into an active, hard-to-ignore part of the sharing flow itself, closing the most common accidental-drop case without needing anything App Review would flag. Proactively closing the listener on backgrounding (instead of letting the OS silently kill it) keeps the PS2's own error state predictable (a clean disconnect it can react to) rather than an indefinite hang.

**Alternatives considered**:

- A VoIP background mode "keepalive" — rejected, both against App Review policy for non-VoIP use and unreliable (Apple actively polices this pattern).
- `BGProcessingTask`/`BGAppRefreshTask` to periodically "pulse" the server back alive — rejected, these are minutes-apart, short-duration windows unsuitable for a live, low-latency file-serving protocol a PS2 is actively reading from mid-session.
- A companion always-on Mac/PC relay — out of scope, defeats the point of a phone-only sharing story and is not what spec.md asks for.
- **Silent-audio background-mode trick** (declaring `UIBackgroundModes: [audio]` and looping an inaudible track to stay backgrounded indefinitely, the way some file-transfer/remote-control apps do): technically the closest thing to a real answer to "how do other apps do it," and it does genuinely work — but it's a documented App Review violation (guideline 2.5.4, background modes must match real declared functionality) when the audio has no purpose the user asked for, and Apple does reject/pull apps for this specific abuse pattern. Rejected as the primary design; not worth the store-rejection/removal risk for this feature. If a future revision of this plan wants to revisit it, it needs to be an explicit, informed product decision (not a silent implementation detail), made with full awareness of the compliance risk — not assumed here.

## R4: Local Network permission and Bonjour declaration

**Decision**: Declare `NSLocalNetworkUsageDescription` (a clear, user-facing sentence explaining the PS2-sharing use case) and `NSBonjourServices` (even though this server does not itself rely on Bonjour discovery — the PS2's OPL client is configured with a manually-entered IP/port, not discovery — because iOS's Local Network permission prompt and enforcement are keyed to `Info.plist` declarations more broadly, and a listening `NWListener` on the local subnet is exactly the kind of local-network activity iOS 14+ gates behind this permission) in `Info.plist`. Show an in-app explanation screen before the first system permission prompt fires (the system prompt's own copy is not editable and fires only once — Constitution Principle I's "confirmação explícita" intent extends naturally to explaining _why_ the OS is about to ask).

**Rationale**: Without this declaration and permission grant, `NWListener` binds but the app cannot actually be reached by other devices on the LAN — the failure mode is a silent, confusing "server started but nothing can connect," which spec.md's edge cases explicitly call out as needing a clear, actionable error rather than a generic one (spec.md Edge Cases, Wi-Fi/permission item).

**Alternatives considered**: Skipping the Bonjour declaration since discovery isn't used — rejected after research showed enforcement is tied to local-network _reachability_ broadly, not literally to `NSNetService`/Bonjour API calls; safer to declare it and be explicit in the permission-explainer copy that no device discovery/broadcast happens, only direct LAN serving to an IP the user configures on the PS2 side.

## R5: SMB1 server transport — Network.framework, and the same privileged-port finding as Android

**Decision**: `NWListener` bound to a `NWParameters.tcp` configuration on an ephemeral or explicitly-configured non-privileged port (matching Android's already-discovered fallback: port 1445, not the standard SMB port 445), accepting `NWConnection`s and running the same frame-read/command-dispatch loop already implemented in Kotlin, ported line-for-line where the logic is platform-agnostic (frame codec, command handlers, NTLMv1) and re-expressed idiomatically only where Swift's concurrency model (structured concurrency / `Task`, or a dedicated `DispatchQueue` per connection, mirroring the one-coroutine-per-connection shape already used in `SmbServer.kt`) differs from Kotlin coroutines.

**Rationale**: Port 445 is a privileged port (<1024) on iOS exactly as it is on Android/any POSIX system — an unprivileged app cannot bind it, and iOS has no root/elevated-privilege escape hatch for a sandboxed app any more than unrooted Android does. Android's spec 006 already discovered this the hard way (a real `EACCES` bind failure on-device) and fell back to port 1445; this plan adopts that same fallback proactively rather than rediscovering it. The same **open question carried over from Android** applies here unresolved: whether OPL's "Servidor SMB" client configuration screen on the PS2 accepts a custom port at all, or hardcodes 445. If Android's Hardware Smoke Test already answered this (check `specs/006-android-opl-network-library/quickstart.md` / session history before starting iOS implementation), reuse that finding directly instead of re-testing; if it did not conclusively answer it, this remains this feature's own primary open risk, to be resolved by the iOS Hardware Smoke Test (spec.md SC-007) before considering User Story 1 done.

**Alternatives considered**: `BSD sockets` directly via `Darwin`/`POSIX` APIs instead of `Network.framework` — rejected, `Network.framework` is Apple's current-generation, actively maintained networking API with proper Swift concurrency integration and built-in support for the LAN-only binding this feature needs; no capability gap justifies the lower-level API's extra complexity.

## R6: NTLMv1 in Swift — no MD4 in CryptoKit

**Finding**: Apple's `CryptoKit` (and `CommonCrypto`) do not implement MD4 — deliberately, since it's a broken/deprecated hash Apple has no interest in providing a first-class API for, the same reason Kotlin's `MessageDigest` doesn't have "MD4" as a JVM-standard algorithm either (confirmed during Android implementation, which hand-rolled MD4 in `NtlmV1.kt`, verified against the published MS-NLMP test vector).

**Decision**: Port the existing, already-verified Kotlin MD4 implementation to Swift directly (same algorithm, same test vector) rather than pulling in a general-purpose crypto library for one legacy hash. DES (for the 7-byte-key-expansion/encrypt step) uses `CommonCrypto`'s `CCCrypt` with `kCCAlgorithmDES` — DES itself, unlike MD4, is available through Apple's own APIs (also deprecated/legacy, but present, since DES-ECB is exactly what NTLMv1's challenge-response construction requires and CommonCrypto still exposes it).

**Rationale**: A real PS2 OPL client only ever sends an NTLMv1 24-byte challenge-response (never plaintext), confirmed on Android via a real hand-crafted-SMB1-client test and (per spec.md's carried-over lessons) the architectural finding that this credential exchange happens at `TREE_CONNECT_ANDX`, not `SESSION_SETUP_ANDX` — both of those protocol facts are wire-format knowledge, not Android-specific, and apply unchanged to the iOS server.

**Alternatives considered**: A third-party Swift crypto package with MD4 support — rejected, adds a dependency for a single already-solved, already-tested 30-line algorithm; direct port is both simpler and lower-risk (byte-for-byte behavior already proven against the MS-NLMP vector).

## R7: Credential storage — iOS Keychain

**Decision**: `kSecClassGenericPassword` Keychain items (service string scoped to the app, one item for username, one for password, or a single item with a structured value — implementation detail for Phase 1) for SMB credentials, replacing Android's Keystore-backed `EncryptedSharedPreferences`. The "recent connections" list (username + share name only, never password — already an explicit Android design decision in `CredentialStore.kt`) uses the same non-secret `UserDefaults`-backed JSON approach Android uses, since it deliberately holds no secret material.

**Rationale**: Keychain is the standard, App-Review-expected mechanism for credential storage on iOS, functionally equivalent to Android Keystore-backed storage — same "never plaintext, never logged" guarantee via a platform-native, hardware-backed mechanism rather than a custom encryption scheme.

**Alternatives considered**: `UserDefaults` with manual encryption — rejected, reinventing what Keychain already provides correctly, and would not meet the same security bar the Android implementation already established.

## R8: iCloud Drive "on-demand" files

**Finding**: A folder chosen via the document picker can live in iCloud Drive, where individual files may be present as placeholders (`.icloud` companion files, `NSURLUbiquitousItemIsDownloadingKey`/`NSURLUbiquitousItemDownloadingStatusKey` metadata) rather than fully downloaded locally — a state with no Android/SAF equivalent, since Android's SAF providers for this app's supported sources (internal storage, SD card, USB-OTG) don't have an analogous "not yet materialized" file state.

**Decision**: Before serving a file's content over SMB (`NT_CREATE_ANDX`/`OPEN_ANDX` handling), check `NSURLUbiquitousItemDownloadingStatusKey` via `URL.resourceValues`; if not `.current`, call `FileManager.default.startDownloadingUbiquitousItem(at:)` and wait (with a bounded timeout, surfaced as a clear error if exceeded — never an indefinite hang on a `READ_ANDX` the PS2 is blocking on) before proceeding. Directory listings (`TRANSACTION2`/`FIND_FIRST2`) show on-demand files normally (their metadata — name, size — is available without downloading content), matching how the Files app itself lists them.

**Rationale**: Spec.md's edge cases and FR-016 explicitly require this — a PS2 mid-transfer that gets a hung or truncated read because a file was still a cloud placeholder is a worse failure mode than a small download delay with clear on-screen progress.

**Alternatives considered**: Excluding iCloud-backed folders from being selectable as a library entirely — rejected as unnecessarily restrictive; the on-demand-download handling above is a bounded, known-shape problem, not a reason to disallow a whole class of user-chosen folder.

## R9: React Native ↔ Swift boundary (mirrors Android R2, unchanged contract)

**Decision**: Same TurboModule specs already Codegen'd from `mobile/src/native/specs/*.ts` — this feature adds the Swift-side implementation registered under the same module names, with no changes to the TypeScript spec files themselves (Codegen already generates the iOS Objective-C++/Swift-interop scaffolding from the same source of truth used for Android's Java/Kotlin scaffolding). The SMB server's per-request file I/O runs entirely inside Swift, on its own connection loop, never crossing the JS bridge on the hot path — identical reasoning to Android R2.

**Rationale**: This is the entire point of TurboModules' Codegen model — one contract, two native implementations. No new design decision is needed here beyond confirming the existing contract doesn't implicitly assume Android-only shapes (e.g., a `content://` URI string as an identifier would leak an Android concept into a cross-platform type — Phase 1's data-model review confirms/fixes any such leakage before Swift implementation starts).

**Alternatives considered**: A parallel, iOS-specific set of TurboModule specs — rejected, would duplicate the contract for no benefit and risk the two platforms drifting apart in behavior over time.
