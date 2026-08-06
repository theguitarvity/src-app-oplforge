import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ReadinessReportService } from '@electron/services/reports/readiness-report.service'

const device = {
  deviceId: 'd',
  mountPath: '/secret/device',
  realPath: '/secret/device',
  fileSystem: 'FAT32',
  totalBytes: 1,
  freeBytes: 1,
  clusterBytes: 4096,
  supportsLargeFiles: 'failed' as const,
  observedAt: new Date().toISOString()
}
const opl = {
  id: 'p',
  version: '1.2.0',
  variant: 'release',
  officialUrl: 'https://github.com/ps2homebrew/Open-PS2-Loader/releases/tag/v1.2.0',
  elfSha256: 'a'.repeat(64),
  obtainedAt: new Date().toISOString(),
  capabilities: { iso: true, zso: true, usbExtreme: true, fileSystems: ['FAT32'] }
}
describe('readiness report aggregation', () => {
  it('keeps structural, PCSX2 and hardware results independent', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'report-'))
    const service = new ReadinessReportService(path.join(root, 'reports.json'))
    const snapshot = {
      snapshotId: 's',
      scanId: 'x',
      deviceId: 'd',
      status: 'complete',
      capturedAt: new Date().toISOString(),
      revision: 1,
      findings: [],
      items: []
    }
    const report = await service.generate({ device, snapshot: snapshot as never, opl })
    expect(report.results).toEqual({ structural: 'passed', pcsx2: 'not-run', hardware: 'not-run' })
    expect(report.device).not.toHaveProperty('mountPath')
    expect(service.exportJson(report)).not.toContain('/secret/device')
  })
  it('uses not-verified rather than passed for warning evidence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'report-'))
    const service = new ReadinessReportService(path.join(root, 'reports.json'))
    const snapshot = {
      snapshotId: 's',
      scanId: 'x',
      deviceId: 'd',
      status: 'provisional',
      capturedAt: new Date().toISOString(),
      revision: 1,
      findings: [],
      items: []
    }
    expect(
      (await service.generate({ device, snapshot: snapshot as never, opl })).results.structural
    ).toBe('not-verified')
  })
})
