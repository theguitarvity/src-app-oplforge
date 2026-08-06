# Fragmentation-repair fixtures

All fixtures in this directory are synthetic, minimal, non-bootable, and safe to
commit. They must not contain commercial game sectors, BIOS data, credentials,
or paths copied from a contributor's device.

## Image fixtures

- **ISO** fixtures contain only the minimum ISO9660 metadata needed for game
  discovery and structural validation. Test variants should cover a contiguous
  file, a fragmented file, malformed metadata, truncation, and source mutation.
- **ZSO** fixtures wrap synthetic zero-filled blocks and the minimum header and
  index needed by the parser. Test variants should cover compressed and
  uncompressed blocks, malformed indexes, truncation, and hash mismatch.
- **USBExtreme** fixtures use a synthetic `ul.cfg` plus exact multipart names
  (`ul.<crc>.<game-id>.00`, `.01`, and so on). The parts form one logical
  installation: every part is validated, while only parts reported as
  fragmented may receive candidates or be rewritten.

Prefer deterministic generators over committed binary blobs. Generated content
must use fixed bytes, names, sizes, timestamps, and ordering so hashes and test
results remain reproducible.

## Extent command fixtures

The files under `extents/` are golden command output, not evidence captured from
a real game. They use stable synthetic paths and ranges:

- `linux-filefrag.txt` models complete `filefrag -v` output with three extents.
- `windows-fsutil.txt` models complete `fsutil file queryextents` output with
  three VCN/LCN ranges.

Parser tests may derive contiguous, incomplete-coverage, overlapping, or
malformed cases from these goldens without changing the canonical files.

## Failure fixtures

Failure injection belongs at explicit durability and validation boundaries:
permission denial, unsupported volume/tool, lock contention, insufficient
space, short write, sync failure, rename failure, unplug/device disappearance,
source mutation, size or SHA-256 mismatch, malformed structure, still-fragmented
candidate, corrupt journal, and interrupted recovery.

Failure fixtures must identify the boundary and expected safe outcome. They must
never depend on the host filesystem actually failing, and cleanup must preserve
the last known valid version of each synthetic installation.
