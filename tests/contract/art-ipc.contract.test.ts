import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemas } from '@electron/ipc/schemas'

describe('art IPC contract', () => {
  it('requires a catalog snapshot for planning', () => {
    expect(schemas.artPlan.safeParse({ deviceId: 'd', snapshotId: '' }).success).toBe(false)
  })
  it('uses plan/confirm across renderer and privileged boundary', async () => {
    const sources = await Promise.all(
      [
        'src/pages/ArtManagerPage.tsx',
        'src/services/api.ts',
        'electron/preload.ts',
        'electron/ipc/art.ipc.ts'
      ].map((file) => readFile(path.resolve(file), 'utf8'))
    )
    for (const source of sources) expect(source).toMatch(/(?:createArtSyncPlan|art:sync:plan)/)
  })
})
