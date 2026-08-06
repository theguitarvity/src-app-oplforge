import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemas } from '@electron/ipc/schemas'

describe('catalog IPC', () => {
  it('validates scan, override and hash inputs', () => {
    expect(schemas.catalogScan.safeParse({ devicePath: '/media/usb' }).success).toBe(true)
    expect(
      schemas.catalogOverride.safeParse({
        deviceId: 'd',
        relativePath: 'DVD/a.iso',
        size: 1,
        fingerprint: 'x',
        gameId: 'bad'
      }).success
    ).toBe(false)
  })
  it('exposes sequenced snapshot events through the narrow chain', async () => {
    const [ipc, preload, api, page] = await Promise.all(
      [
        'electron/ipc/catalog.ipc.ts',
        'electron/preload.ts',
        'src/services/api.ts',
        'src/pages/GameLibraryPage.tsx'
      ].map((file) => readFile(path.resolve(file), 'utf8'))
    )
    expect(ipc).toContain("'catalog:scan'")
    expect(preload).toContain("'catalog:event'")
    expect(api).toContain('scanCatalog')
    expect(page).toContain('oplApi.scanCatalog')
  })
})
