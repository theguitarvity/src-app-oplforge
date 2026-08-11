# Contract: SMB1 Protocol Scope (OPL-facing) — iOS

This feature reuses `specs/006-android-opl-network-library/contracts/smb-protocol-scope.md` verbatim as its protocol-scope contract — the wire-format/command-subset knowledge is platform-agnostic (it describes what a real PS2 OPL client needs from _any_ SMB1 server, not anything Kotlin-specific), and re-deriving it for iOS would risk drifting from the already hardware-validated Android scope rather than reusing it.

## Additions since the original 006 contract was written

Two commands were added to the Android implementation after hardware testing surfaced real gaps not caught by the original scope (see Android session history / `CommandHandlers.kt` doc comments for the incident detail) — both are now part of this feature's required scope too, since they're wire-format facts about how a real PS2 OPL client behaves, not Android-specific fixes:

- **`SMB_COM_ECHO` (0x2B)**: a transport keepalive/probe a real PS2 sends with `UID 0`, before `SESSION_SETUP_ANDX`/`TREE_CONNECT_ANDX` — not scoped to any authenticated session. Missing support surfaced as OPL's "network startup error" the moment a user entered the network menu, before any real SMB traffic was even attempted.
- **`SMB_COM_OPEN_ANDX` (0x2D)**: an older, simpler file-open call some real PS2 OPL clients use instead of (or alongside) `NT_CREATE_ANDX`. Missing support surfaced as a file-open failure for clients that prefer this path.

## Architectural correction carried over (not just a command list)

The original 006 contract's "Session setup / authentication" bullet describes username+password validation happening at session setup — this was corrected after hardware testing: a real PS2 OPL client uses **share-level security** (MS-CIFS 3.1.1), sending a dummy/empty `SESSION_SETUP_ANDX` and putting the real share password on `TREE_CONNECT_ANDX` instead (as a 24-byte NTLMv1 challenge-response, hashed against the `NEGOTIATE` response's challenge — never plaintext). The iOS server MUST implement this same share-level flow from the start, not the session-level flow the original contract text describes — this is exactly what research.md R5/R6 and data-model.md's `SharingSession` already assume.

## Verification bar (unchanged, restated)

Per Constitution Principle V and this feature's spec.md SC-007, this contract is satisfied only once a Hardware Smoke Test confirms a real PlayStation 2 running Open PS2 Loader can list and boot titles of each supported type through the **iOS** server specifically — the Android hardware validation does not transfer, since the transport (`Network.framework`/`NWListener` vs. `java.net.ServerSocket`), threading model, and file-backing mechanism (security-scoped bookmark + `FileHandle` vs. SAF + `ParcelFileDescriptor`) are different enough that protocol-level correctness on one platform does not guarantee it on the other.
