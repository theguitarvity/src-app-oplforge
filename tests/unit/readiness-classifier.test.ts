import { describe, expect, it } from 'vitest'
import { classifyReadiness } from '@electron/services/diagnostics/readiness-classifier'
import type { CatalogSnapshot, DeviceIdentity } from '@/types/opl'

const device: DeviceIdentity = {
  deviceId: 'd',
  mountPath: '/d',
  realPath: '/d',
  fileSystem: 'FAT32',
  totalBytes: 1,
  freeBytes: 1,
  clusterBytes: 4096,
  supportsLargeFiles: 'failed',
  observedAt: new Date().toISOString()
}
const snapshot: CatalogSnapshot = {
  snapshotId: 's',
  scanId: 'x',
  deviceId: 'd',
  status: 'complete',
  capturedAt: new Date().toISOString(),
  items: [],
  findings: [],
  revision: 1
}
describe('readiness decision table', () => {
  it.each([
    ['ready', { ...device, supportsLargeFiles: 'verified' }, snapshot],
    ['ready-with-warnings', { ...device, supportsLargeFiles: 'not-verified' }, snapshot],
    [
      'requires-reorganization',
      device,
      {
        ...snapshot,
        items: [
          {
            structuralIntegrity: 'verified',
            compatibility: 'verified',
            classification: 'invalid',
            fragmentation: 'fragmented'
          }
        ]
      }
    ],
    ['incompatible', { ...device, fileSystem: 'unknown' }, snapshot]
  ] as const)('returns %s from evidence', (expected, target, catalog) =>
    expect(classifyReadiness(target, catalog as CatalogSnapshot)).toBe(expected)
  )
})
