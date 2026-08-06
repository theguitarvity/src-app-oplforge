# Fragmentation repair support matrix

The fragmentation-repair capability matrix is a versioned, read-only allowlist
defined in `electron/services/fragmentation-repair/capability-matrix.ts`. The
current schema/version is **1**. Every entry records an exact Node platform,
normalized filesystem/driver name, extent tool and a certification note.

## Certified combinations in matrix v1

| Platform | Filesystem/driver | Extent method              | Runtime requirement                                                             |
| -------- | ----------------- | -------------------------- | ------------------------------------------------------------------------------- |
| Linux    | `vfat` (FAT32)    | `filefrag -v -s`           | Complete table and summary, logical coverage through EOF, valid physical ranges |
| Linux    | `exfat`           | `filefrag -v -s`           | Complete table and summary, logical coverage through EOF, valid physical ranges |
| Windows  | `fat32`           | `fsutil file queryextents` | Complete contiguous VCN coverage and valid LCN ranges                           |
| Windows  | `exfat`           | `fsutil file queryextents` | Complete contiguous VCN coverage and valid LCN ranges                           |

An allowlist entry is necessary but not sufficient. Each selected volume must
also pass a runtime probe using a real file on that volume. Missing tools,
permission denial, unrecognized output, incomplete coverage or failed physical
mapping keep repair disabled and produce an actionable limitation.

## Deny by default

Unknown platforms, filesystem aliases, drivers, tools and output formats are
blocked. Similar names are not inferred to be compatible. Network, virtual,
cloud, sparse, compressed, encrypted, copy-on-write and otherwise uncertified
volumes remain blocked until their exact combination is added to a later matrix
version with reproducible flush, rename, unplug and recovery evidence.

## macOS limitation

Matrix v1 has no macOS entry. The application reports fragmentation as
unverifiable and blocks repair because no stable public user-space API has been
certified to prove physical extents for regular files on removable volumes.
Allocated size or filesystem metadata is not treated as proof of contiguity.

## Updating certification

A matrix update must increment `CAPABILITY_MATRIX_VERSION`, add the exact
combination, preserve deny-by-default lookup, and include golden parser tests
plus real-device evidence for tool/version, filesystem driver, sync/close,
physical adjacency, promotion, removal and idempotent recovery.
