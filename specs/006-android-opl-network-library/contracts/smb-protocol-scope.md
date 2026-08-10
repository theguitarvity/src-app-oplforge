# Contract: SMB1 Protocol Scope (OPL-facing)

This is a scope contract, not a wire-format specification — it defines what the Kotlin SMB1 server (`research.md` R5) MUST support to satisfy Open PS2 Loader's ETH-mode SMB client, and explicitly what it MUST NOT need to support. Exact frame layout, byte offsets, and command-handler code are implementation (`tasks.md`), informed by the desktop reference implementation (`electron/services/network-share/smb/`) but re-derived for Kotlin, not transliterated line-for-line.

## In scope (required for OPL compatibility)

- **Dialect negotiation**: legacy SMB1/CIFS (`NT LM 0.12`), matching what desktop research confirmed OPL's client speaks — no SMB2/SMB3 negotiation path is needed for OPL itself.
- **Session setup / authentication**: username+password validation against `SharingSession.credentialRef` (FR-017); invalid credentials rejected with one generic message, no field-specific hint (FR-034).
- **Tree connect**: to the single configured share name (`SharingSession.shareName`) representing the active `LibrarySelection` root.
- **Directory listing**: enumerating `DVD/`, `CD/`, `PS1/`, `APPS/`, `ART/`, `CFG/`, `VMC/` and their contents, confined to the authorized SAF tree (FR-028) — no traversal above the granted root under any input.
- **File read**: chunked/ranged reads sufficient for OPL to boot a DVD/CD/PS1 image or launch an APPS entry, backed by a seekable `ParcelFileDescriptor` (`research.md` R3) — never a full-file in-memory buffer (FR-026/SC-008).
- **Limited file write**: only after `writeAccessAcknowledgedAt` is set (FR-018); scoped to whatever OPL/the PS2 actually writes back (e.g. save-adjacent data, VMC updates) — not a general-purpose write API.
- **Session/connection lifecycle**: clean handling of connect/disconnect so `ConnectedClient` state (data-model.md) stays accurate for the Home/status UI (FR-024/FR-025), including aging out a client that vanished without a clean disconnect (e.g. PS2 powered off mid-session).

## Explicitly out of scope

- SMB2/SMB3 negotiation, encryption, or any modern-SMB feature — OPL's client doesn't use them; adding them would be scope creep against Constitution Principle V.
- General-purpose file-sharing features (symbolic links, extended attributes, ACL translation, print shares, browsing beyond the configured library root).
- Multi-share hosting — exactly one share, matching the single active `LibrarySelection` (spec Assumption).
- Any operation the desktop implementation itself does not support for OPL compatibility — this contract MUST NOT exceed desktop spec 005's validated protocol surface without a documented reason.

## Compatibility verification

Per Constitution Principle V and `research.md` R8, this contract is **not** considered satisfied by:

- Unit tests of the frame codec alone.
- A PC or emulator SMB client successfully mounting the share.

It is only considered satisfied once the Hardware Smoke Test (`quickstart.md`, spec SC-009) confirms a real PlayStation 2 running Open PS2 Loader can list and boot titles of each supported type through this server.
