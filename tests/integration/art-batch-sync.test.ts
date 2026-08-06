import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ArtSyncJobService } from '@electron/services/art/art-sync-job.service'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('500-game art batch', () => {
  it('limits concurrency to three and persists a reconciled completed job', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-batch-'))
    roots.push(root)
    const file = path.join(root, 'jobs.json')
    let active = 0
    let peak = 0
    const service = new ArtSyncJobService(
      file,
      async () => {
        active += 1
        peak = Math.max(peak, active)
        await Promise.resolve()
        active -= 1
      },
      3
    )
    const items = Array.from({ length: 500 }, (_, index) => ({
      itemId: `i${index}`,
      gameId: `SLUS_${String(index).padStart(3, '0')}.00`,
      type: 'COV' as const,
      assetId: `a${index}`,
      cacheKey: 'shared-archive',
      state: 'pending' as const,
      attempts: 0
    }))
    const job = await service.start('p1', 'd1', items)
    expect(job.state).toBe('completed')
    expect(job.counts.installed).toBe(500)
    expect(peak).toBe(3)
    expect(
      (await new ArtSyncJobService(file, async () => undefined).get(job.jobId))?.items
    ).toHaveLength(500)
  })
})
