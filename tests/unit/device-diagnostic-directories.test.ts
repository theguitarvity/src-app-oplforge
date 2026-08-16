import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OPL_DIRS } from '@electron/services/device.service'
import { DeviceDiagnosticService } from '@electron/services/diagnostics/device-diagnostic.service'
import { CatalogService } from '@electron/services/catalog/catalog.service'
import { CatalogStoreService } from '@electron/services/catalog/catalog-store.service'
import { CatalogScannerService } from '@electron/services/catalog/catalog-scanner.service'

describe('device diagnostic — directory findings', () => {
  it('reports OPL_DIRECTORY_MISSING for CHT, LNG and THM when absent', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'oplforge-diag-'))
    await Promise.all(
      OPL_DIRS.filter((dir) => !['CHT', 'LNG', 'THM'].includes(dir)).map((dir) =>
        mkdir(path.join(root, dir))
      )
    )

    const adapter = {
      platform: 'linux' as const,
      inspect: async () => ({
        state: 'unknown' as const,
        verification: 'not-verified' as const,
        method: 'fake',
        detail: 'unsupported'
      })
    }
    const catalog = new CatalogService(
      new CatalogStoreService(path.join(root, '..', `diag-${crypto.randomUUID()}.json`)),
      new CatalogScannerService(adapter)
    )
    const result = await new DeviceDiagnosticService(catalog).run(root, undefined, 'exFAT')

    const missingDirs = result.findings
      .filter((finding) => finding.code === 'OPL_DIRECTORY_MISSING')
      .map((finding) => finding.message)
    expect(missingDirs.some((message) => message.includes('/CHT'))).toBe(true)
    expect(missingDirs.some((message) => message.includes('/LNG'))).toBe(true)
    expect(missingDirs.some((message) => message.includes('/THM'))).toBe(true)

    await rm(root, { recursive: true, force: true })
  })
})
