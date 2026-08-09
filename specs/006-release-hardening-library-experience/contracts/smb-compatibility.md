# SMB Compatibility Contract: OPL Profile 1

This is a minimal OPL compatibility contract, not a general SMB server promise. Hardware evidence remains the release gate.

## Negotiation/authentication

- Dialect: `NT LM 0.12` over SMB1.
- Transport: accept RFC 1002 session request and direct-host session message.
- Initial profile: share-level security, OEM strings, no advertised Unicode capability.
- `SESSION_SETUP_ANDX`: parse lengths safely; do not demand share password; allocate nonzero UID; guest action bit remains clear.
- `TREE_CONNECT_ANDX`: validate requested share and share password generically; allocate nonzero TID only on success.
- Empty/guest/anonymous modes are disabled unless the selected compatibility profile explicitly enables them.
- Invalid auth returns generic `STATUS_LOGON_FAILURE`; invalid share returns the appropriate generic network/share status.

## Required command behavior

- `NEGOTIATE`, `SESSION_SETUP_ANDX`, `TREE_CONNECT_ANDX`, `TREE_DISCONNECT`, `LOGOFF_ANDX`.
- Directory discovery via observed TRANS2 `FIND_FIRST2`/`FIND_NEXT2` and required query levels.
- `OPEN_ANDX`, `READ_ANDX`, `CLOSE`, `ECHO`; existing write commands remain governed by write-access policy.
- UID/TID/FID/SID are validated against connection-owned state.
- Directory pages respect `SearchCount`, `MaxDataCount`, negotiated frame limit and continuation semantics.
- Read offset combines high/low 32-bit words; request counts are bounded; reads crossing 4 GiB and DVD9 offsets must work.
- Paths remain under the selected library root, with case/encoding behavior documented by the profile.

## Diagnostics

Allowed: connection correlation, sanitized client address, phase, command, dialect, security/capabilities, auth mechanism name, guest requested flag, status, UID/TID/FID, offset/count, duration.

Forbidden: username in clear when masking is sufficient, password, challenge response, raw session/tree auth data, authentication packet hex.

## Compatibility evidence

The profile is supported only after a real PS2 completes: negotiate → session → tree → listing → `OPEN_ANDX` → sustained reads, plus a read above offset `0x1_0000_0000`. Evidence records OPL commit/version, console/network adapter and sanitized trace.
