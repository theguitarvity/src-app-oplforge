import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatalogStoreService } from '@electron/services/catalog/catalog-store.service'

describe('manual Game ID override identity', () => {
  it('applies only to the same device, path, size and fingerprint', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'override-'))
    const store = new CatalogStoreService(path.join(root, 'catalog.json'))
    const value = {
      deviceId: 'd',
      relativePath: 'DVD/game.iso',
      size: 10,
      fingerprint: 'one',
      gameId: 'SLUS_123.45',
      createdAt: new Date().toISOString()
    }
    await store.setOverride(value)
    expect(await store.override('d', value.relativePath, 10, 'one')).toMatchObject(value)
    expect(await store.override('d', value.relativePath, 11, 'one')).toBeUndefined()
    expect(await store.override('other', value.relativePath, 10, 'one')).toBeUndefined()
  })
})
