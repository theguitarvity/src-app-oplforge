import { describe, expect, it } from 'vitest'
import { DownloadEventPublisher } from '@electron/services/downloads/download-event-publisher'
import { ArtSyncJobService } from '@electron/services/art/art-sync-job.service'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('pipeline performance envelope', () => {
  it('keeps event and 500-item job memory bounded', async () => {
    const startedAt = performance.now()
    const before = process.memoryUsage().rss
    let eventCount = 0
    const publisher = new DownloadEventPublisher(() => {
      eventCount += 1
    })
    for (let task = 0; task < 100; task += 1)
      for (let progress = 0; progress < 100; progress += 1)
        publisher.progress({
          operationId: `t${task}`,
          kind: 'download',
          phase: 'transferring',
          progress,
          message: 'progress'
        })
    const root = await mkdtemp(path.join(os.tmpdir(), 'opl-performance-'))
    const jobs = new ArtSyncJobService(path.join(root, 'jobs.json'), async () => undefined, 3)
    const items = Array.from({ length: 500 }, (_, index) => ({
      itemId: `i${index}`,
      gameId: `SLUS_${String(index).padStart(3, '0')}.00`,
      type: 'COV' as const,
      assetId: `a${index}`,
      cacheKey: 'shared',
      state: 'pending' as const,
      attempts: 0
    }))
    await jobs.start('p1', 'd1', items)
    publisher.stop()
    const growth = process.memoryUsage().rss - before
    await rm(root, { recursive: true, force: true })
    // At most one leading and one coalesced trailing event per operation.
    expect(eventCount).toBeLessThanOrEqual(200)
    expect(growth).toBeLessThan(512 * 1024 * 1024)
    expect(performance.now() - startedAt).toBeLessThan(20_000)
  }, 20_000)
})
