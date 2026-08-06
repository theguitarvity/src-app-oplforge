export const CAPABILITY_MATRIX_VERSION = 1

export interface CapabilityMatrixQuery {
  platform: NodeJS.Platform
  fileSystem: string
  method: string
}
export interface HomologatedCapability extends CapabilityMatrixQuery {
  note: string
}

// This allowlist is intentionally exact and conservative. Unknown OS,
// filesystem and tool combinations are never inferred to be safe.
export const HOMOLOGATED_CAPABILITIES: readonly HomologatedCapability[] = [
  {
    platform: 'linux',
    fileSystem: 'vfat',
    method: 'filefrag',
    note: 'FAT32 through the Linux vfat driver with FIEMAP-capable filefrag'
  },
  {
    platform: 'linux',
    fileSystem: 'exfat',
    method: 'filefrag',
    note: 'exFAT through the Linux exfat driver with FIEMAP-capable filefrag'
  },
  {
    platform: 'win32',
    fileSystem: 'fat32',
    method: 'fsutil',
    note: 'FAT32 with fsutil file queryextents'
  },
  {
    platform: 'win32',
    fileSystem: 'exfat',
    method: 'fsutil',
    note: 'exFAT with fsutil file queryextents'
  }
] as const

const normalizeFileSystem = (value: string) => value.trim().toLowerCase()

export function lookupCapability(query: CapabilityMatrixQuery): HomologatedCapability | undefined {
  const fileSystem = normalizeFileSystem(query.fileSystem)
  const method = query.method.trim().toLowerCase()
  return HOMOLOGATED_CAPABILITIES.find(
    (entry) =>
      entry.platform === query.platform &&
      entry.fileSystem === fileSystem &&
      entry.method === method
  )
}
