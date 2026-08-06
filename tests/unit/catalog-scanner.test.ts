import { mkdir, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatalogScannerService } from '@electron/services/catalog/catalog-scanner.service'
import { syntheticIso } from '../fixtures/images/generate-fixtures'
import { createTempDevice } from '../helpers/temp-device'

const adapter = {
  platform: 'linux' as const,
  inspect: async () => ({
    state: 'contiguous' as const,
    verification: 'verified' as const,
    extents: 1,
    method: 'fake',
    detail: 'one'
  })
}
describe('read-only catalog scanner', () => {
  it('recurses through DVD/CD, identifies images and retains unknown files', async () => {
    const device = await createTempDevice()
    await mkdir(path.join(device.root, 'DVD', 'nested'))
    await writeFile(path.join(device.root, 'DVD', 'nested', 'game.iso'), syntheticIso())
    await writeFile(path.join(device.root, 'CD', 'notes.txt'), 'x')
    const result = await new CatalogScannerService(adapter).scan(device.root, 'd')
    expect(result.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['game', 'unknown'])
    )
    await device.cleanup()
  })
  it('skips symlinks instead of following cycles or external targets', async () => {
    const device = await createTempDevice()
    await symlink('/tmp', path.join(device.root, 'DVD', 'outside'))
    const result = await new CatalogScannerService(adapter).scan(device.root, 'd')
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SYMLINK_SKIPPED' })])
    )
    await device.cleanup()
  })
})
