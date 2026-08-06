import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatalogScannerService } from '@electron/services/catalog/catalog-scanner.service'
import { CatalogService } from '@electron/services/catalog/catalog.service'
import { CatalogStoreService } from '@electron/services/catalog/catalog-store.service'
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
describe('existing device catalog', () => {
  it('does not mutate files and refreshes after external add/remove', async () => {
    const device = await createTempDevice()
    const game = path.join(device.root, 'DVD', 'game.iso')
    await writeFile(game, syntheticIso())
    const before = await stat(game)
    const service = new CatalogService(
      new CatalogStoreService(path.join(device.root, '..', `catalog-${crypto.randomUUID()}.json`)),
      new CatalogScannerService(adapter)
    )
    expect((await service.scan(device.root)).items).toHaveLength(1)
    expect((await stat(game)).mtimeMs).toBe(before.mtimeMs)
    await rm(game)
    await mkdir(path.join(device.root, 'CD', 'nested'))
    await writeFile(
      path.join(device.root, 'CD', 'nested', 'new.iso'),
      syntheticIso('SLES_999.99', 100_000)
    )
    const refreshed = await service.scan(device.root)
    expect(refreshed.items[0].gameId).toBe('SLES_999.99')
    expect(await readdir(path.join(device.root, 'DVD'))).toEqual([])
    await device.cleanup()
  })
  it('reports an inaccessible/missing directory without discarding readable items', async () => {
    const device = await createTempDevice()
    await rm(path.join(device.root, 'CD'), { recursive: true })
    const result = await new CatalogScannerService(adapter).scan(device.root, 'd')
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DIRECTORY_INACCESSIBLE' })])
    )
    await device.cleanup()
  })
})
