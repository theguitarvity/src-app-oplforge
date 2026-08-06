import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ArtSyncService } from '@electron/services/art/art-sync.service'
import { validPng, htmlError } from '../fixtures/art/generate-fixtures'
import { createTempDevice } from '../helpers/temp-device'
import type { CatalogSnapshot } from '@/types/opl'

const snapshot = (deviceId: string): CatalogSnapshot => ({
  snapshotId: 's',
  scanId: 'x',
  deviceId,
  status: 'complete',
  capturedAt: new Date().toISOString(),
  revision: 1,
  findings: [],
  items: [
    {
      itemId: 'one',
      kind: 'game',
      title: 'Synthetic',
      gameId: 'SLUS_123.45',
      gameIdSource: 'iso',
      mediaType: 'DVD',
      installFormat: 'ISO',
      relativePath: 'DVD/game.iso',
      files: [],
      totalBytes: 1,
      structuralIntegrity: 'verified',
      hashState: 'not-calculated',
      fragmentation: 'contiguous',
      artStatus: 'missing',
      compatibility: 'verified',
      classification: 'ready',
      findings: []
    }
  ]
})
describe('transactional art synchronization', () => {
  it('connects ArtManagerPage through API, preload and IPC to the transactional service', async () => {
    const files = await Promise.all(
      [
        'src/pages/ArtManagerPage.tsx',
        'src/services/api.ts',
        'electron/preload.ts',
        'electron/ipc/art.ipc.ts'
      ].map((file) => readFile(path.resolve(file), 'utf8'))
    )
    expect(files.join('\n')).toContain('planArtSync')
    expect(files.join('\n')).toContain("'art:confirm'")
  })
  it('downloads valid assets, rejects HTML and preserves a valid existing cover', async () => {
    const device = await createTempDevice()
    await mkdir(path.join(device.root, 'ART'), { recursive: true })
    const cover = path.join(device.root, 'ART', 'SLUS_123.45_COV.png')
    await writeFile(cover, validPng())
    const request = async (url: string | URL | Request) =>
      new Response(new Uint8Array(String(url).includes('BG') ? htmlError : validPng()))
    const service = new ArtSyncService(request as typeof fetch)
    const assets = [
      {
        gameId: 'SLUS_123.45',
        type: 'COV' as const,
        name: 'SLUS_123.45_COV.png',
        url: 'https://test/COV'
      },
      {
        gameId: 'SLUS_123.45',
        type: 'BG' as const,
        name: 'SLUS_123.45_BG.png',
        url: 'https://test/BG'
      }
    ]
    const plan = await service.plan(device.root, snapshot('d'), assets)
    const result = await service.confirm(plan.id)
    expect(result[0].existing).toEqual(['COV'])
    expect(result[0].errors[0].type).toBe('BG')
    expect(await readFile(cover)).toEqual(validPng())
    await device.cleanup()
  })
})
