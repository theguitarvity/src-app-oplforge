import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ArtIndexService } from '@electron/services/art/art-index.service'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('ArtIndexService', () => {
  it('indexes by GAME_ID:type and paginates revisioned results', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-index-'))
    roots.push(root)
    const service = new ArtIndexService(path.join(root, 'index.json'), 1000)
    await service.refresh(async () =>
      Array.from({ length: 12 }, (_, index) => ({
        assetId: `a${index}`,
        gameId: `SLUS_12${index % 10}.00`,
        type: 'COV' as const,
        sourceId: 'fixture',
        directUrl: `https://example.test/${index}.png`,
        sourceFormat: 'png' as const
      }))
    )
    const first = await service.query({ limit: 5 })
    expect(first.items).toHaveLength(5)
    expect(first.nextCursor).toBe('5')
    expect(first.revision).toBeGreaterThan(0)
    expect(
      (await service.query({ gameIds: ['SLUS_120.00'], types: ['COV'] })).items.every(
        (item) => item.gameId === 'SLUS_120.00'
      )
    ).toBe(true)
  })

  it('serves stale index when refresh fails after TTL', async () => {
    let now = 0
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-stale-'))
    roots.push(root)
    const service = new ArtIndexService(path.join(root, 'index.json'), 10, () => now)
    await service.refresh(async () => [
      {
        assetId: 'a1',
        gameId: 'SLUS_123.45',
        type: 'COV',
        sourceId: 'fixture',
        directUrl: 'https://example.test/a.png',
        sourceFormat: 'png'
      }
    ])
    now = 20
    await expect(
      service.refresh(async () => {
        throw new Error('offline')
      })
    ).resolves.toMatchObject({ stale: true, itemCount: 1 })
  })
})
