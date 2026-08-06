import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ArtSyncPlanService } from '@electron/services/art/art-sync-plan.service'
import { ArtSyncJobService } from '@electron/services/art/art-sync-job.service'
import type { OplArtType } from '@/types/opl-finalization'

const roots: string[] = []
const types: OplArtType[] = ['ICO', 'COV', 'COV2', 'LAB', 'LGO', 'SCR', 'SCR2', 'BG']
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('art sync plan and job', () => {
  it('plans all eight types and honors missing-only replacement', () => {
    const assets = types.map((type) => ({
      assetId: type,
      gameId: 'SLUS_123.45',
      type,
      sourceId: 'fixture',
      directUrl: `https://example.test/${type}.png`,
      sourceFormat: 'png' as const
    }))
    const plan = new ArtSyncPlanService().create({
      deviceId: 'd1',
      gameIds: ['SLUS_123.45'],
      types,
      replacePolicy: 'missing-only',
      assets,
      existing: new Set(['SLUS_123.45:COV'])
    })
    expect(plan.summary.itemCount).toBe(8)
    expect(plan.items.find((item) => item.type === 'COV')?.state).toBe('skipped')
    expect(new Set(plan.items.map((item) => item.type))).toEqual(new Set(types))
  })

  it('persists per-item results and retries only failed items', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-job-'))
    roots.push(root)
    const file = path.join(root, 'jobs.json')
    let fail = true
    const worker = async (item: { itemId: string }) => {
      if (item.itemId === 'bad' && fail)
        throw Object.assign(new Error('offline'), { code: 'NETWORK' })
    }
    const service = new ArtSyncJobService(file, worker, 3)
    const job = await service.start('p1', 'd1', [
      {
        itemId: 'ok',
        gameId: 'SLUS_123.45',
        type: 'COV',
        assetId: 'a1',
        cacheKey: 'a1',
        state: 'pending',
        attempts: 0
      },
      {
        itemId: 'bad',
        gameId: 'SLUS_123.45',
        type: 'BG',
        assetId: 'a2',
        cacheKey: 'a2',
        state: 'pending',
        attempts: 0
      }
    ])
    expect(job.state).toBe('partial')
    expect(job.counts.failed).toBe(1)
    fail = false
    const retried = await service.retryFailed(job.jobId, job.revision)
    expect(retried.state).toBe('completed')
    expect(retried.counts.installed).toBe(2)
    expect((await new ArtSyncJobService(file, worker).get(job.jobId))?.state).toBe('completed')
  })
})
