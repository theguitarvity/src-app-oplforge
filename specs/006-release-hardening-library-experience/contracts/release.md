# Release Contract

## Trigger and identity

- Public workflow accepts only a validated tag `v1.A.B.C` or guarded manual input resolving to that tag.
- A committed release manifest is the source of truth.
- Internal SemVer is derived by the documented reversible mapping.
- Validation completes before any matrix package build and fails closed on mismatch.

## Platform deliverables

| Platform        | Public user artifact                      | Required updater/support files                    |
| --------------- | ----------------------------------------- | ------------------------------------------------- |
| Windows x64     | one NSIS installer                        | `latest.yml` and referenced blockmap/package data |
| macOS x64/arm64 | current signed/notarized DMG deliverables | generated channel metadata and referenced data    |
| Linux           | current AppImage and DEB deliverables     | generated metadata for supported update path      |

No portable/unpacked/helper executable is public. CI smoke packages are separate and clearly non-release.

## Publication gates

1. Manifest/tag/public/internal mapping valid.
2. App/package/installer metadata matches mapped identity.
3. Platform icon and identity resources present.
4. Production signatures/notarization verified where required.
5. Artifact inventory exactly matches allowlist.
6. Every updater metadata reference resolves to an artifact with matching hash/size.
7. Tests/build complete; release notes/channel match manifest.
8. Only then create/publish one GitHub Release named `v1.A.B.C`.

## Update eligibility

Stable clients consume only stable, non-draft, non-prerelease releases newer by internal SemVer. Feed origin comes from packaged trusted configuration. Installation/restart is always explicit.
