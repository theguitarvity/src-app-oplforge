import type {
  CatalogSnapshot,
  DeviceIdentity,
  Finding,
  ReadinessStatus
} from '../../../src/types/opl'

export function classifyReadiness(
  device: DeviceIdentity,
  catalog: CatalogSnapshot,
  findings: Finding[] = []
): ReadinessStatus {
  if (
    !device.fileSystem ||
    device.fileSystem === 'unknown' ||
    findings.some((finding) => finding.code === 'DEVICE_INACCESSIBLE')
  )
    return 'incompatible'
  if (catalog.items.some((item) => item.fragmentation === 'fragmented'))
    return 'requires-reorganization'
  if (
    catalog.items.some(
      (item) => item.structuralIntegrity === 'failed' || item.compatibility === 'failed'
    )
  )
    return 'incompatible'
  const unknown =
    device.supportsLargeFiles === 'not-verified' ||
    catalog.status !== 'complete' ||
    catalog.items.some(
      (item) => item.classification !== 'ready' || item.fragmentation === 'unknown'
    ) ||
    findings.some((finding) => finding.state !== 'verified')
  return unknown ? 'ready-with-warnings' : 'ready'
}
