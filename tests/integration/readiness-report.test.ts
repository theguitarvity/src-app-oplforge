import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { HardwareSmokeService } from '@electron/services/reports/hardware-smoke.service'
import { ReadinessReportService } from '@electron/services/reports/readiness-report.service'

describe('readiness report and real-hardware smoke', () => {
  it('persists sanitized evidence hashes and adds hardware result without changing emulation', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'report-int-'))
    const reports = new ReadinessReportService(path.join(root, 'reports.json'))
    const report = await reports.generate({
      device: {
        deviceId: 'd',
        mountPath: '/private/mount',
        realPath: '/private/mount',
        fileSystem: 'exFAT',
        totalBytes: 1,
        freeBytes: 1,
        clusterBytes: 4096,
        supportsLargeFiles: 'verified',
        observedAt: new Date().toISOString()
      },
      snapshot: {
        snapshotId: 's',
        scanId: 'x',
        deviceId: 'd',
        status: 'complete',
        capturedAt: new Date().toISOString(),
        revision: 1,
        findings: [],
        items: []
      },
      opl: {
        id: 'p',
        version: '1',
        variant: 'release',
        officialUrl: 'https://github.com/ps2homebrew/Open-PS2-Loader/releases/tag/v1',
        elfSha256: 'a'.repeat(64),
        obtainedAt: new Date().toISOString(),
        capabilities: { iso: true, zso: true, usbExtreme: true, fileSystems: ['exFAT'] }
      }
    })
    const updated = await new HardwareSmokeService(reports).record(report.id, report.revision, {
      consoleModel: 'SCPH-90001',
      adapter: 'USB',
      oplVersion: '1',
      detected: true,
      artDisplayed: true,
      noFragmentationError: true,
      milestoneReached: true
    })
    expect(updated.results).toEqual({ structural: 'passed', pcsx2: 'not-run', hardware: 'passed' })
    expect(reports.exportJson(updated)).not.toContain('/private/mount')
    await expect(
      new HardwareSmokeService(reports).record(report.id, report.revision, updated.hardwareSmoke!)
    ).rejects.toMatchObject({ code: 'STALE_REVISION' })
  })
})
