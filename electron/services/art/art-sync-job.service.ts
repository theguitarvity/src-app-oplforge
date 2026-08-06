import { randomUUID } from 'node:crypto'
import type { ArtSyncItem, ArtSyncJob, Page } from '../../../src/types/opl-finalization'
import { AtomicEntityStore } from '../persistence/atomic-entity-store.service'

export type ArtSyncWorker = (item: ArtSyncItem, job: ArtSyncJob) => Promise<void>

export class ArtSyncJobService {
  private readonly store: AtomicEntityStore<ArtSyncJob>
  constructor(
    filePath: string,
    private readonly worker: ArtSyncWorker,
    private readonly concurrency = 3
  ) {
    this.store = new AtomicEntityStore(filePath, 'jobId', { schemaVersion: 1 })
  }

  async start(planId: string, deviceId: string, sourceItems: ArtSyncItem[]): Promise<ArtSyncJob> {
    const now = new Date().toISOString()
    const job: ArtSyncJob = {
      schemaVersion: 1,
      revision: 0,
      jobId: randomUUID(),
      planId,
      deviceId,
      state: 'running',
      items: structuredClone(sourceItems),
      counts: {},
      lastSequence: 0,
      createdAt: now,
      updatedAt: now
    }
    this.recount(job)
    await this.store.put(job)
    return this.run(job)
  }

  async get(jobId: string): Promise<ArtSyncJob | undefined> {
    const job = await this.store.get(jobId)
    return job ? structuredClone(job) : undefined
  }

  async list(cursor = 0, limit = 100): Promise<Page<ArtSyncJob>> {
    const document = await this.store.document()
    const jobs = Object.values(document.data)
    return {
      items: jobs.slice(cursor, cursor + limit),
      nextCursor: cursor + limit < jobs.length ? String(cursor + limit) : undefined,
      revision: document.revision
    }
  }

  async retryFailed(jobId: string, expectedRevision: number): Promise<ArtSyncJob> {
    const job = await this.require(jobId, expectedRevision)
    for (const item of job.items)
      if (item.state === 'failed' && item.error?.retryable !== false) {
        item.state = 'pending'
        item.error = undefined
      }
    job.state = 'running'
    job.revision += 1
    await this.store.put(job)
    return this.run(job)
  }

  async pause(jobId: string, expectedRevision: number): Promise<ArtSyncJob> {
    return this.setState(jobId, expectedRevision, 'paused')
  }
  async resume(jobId: string, expectedRevision: number): Promise<ArtSyncJob> {
    const job = await this.require(jobId, expectedRevision)
    job.state = 'running'
    job.revision += 1
    return this.run(job)
  }
  async cancel(jobId: string, expectedRevision: number): Promise<ArtSyncJob> {
    return this.setState(jobId, expectedRevision, 'cancelled')
  }

  private async run(job: ArtSyncJob): Promise<ArtSyncJob> {
    const pending = job.items.filter((item) => item.state === 'pending')
    let index = 0
    let lastPersistedAt = Date.now()
    await Promise.all(
      Array.from({ length: Math.min(this.concurrency, pending.length) }, async () => {
        while (index < pending.length && job.state === 'running') {
          const item = pending[index++]
          item.state = 'downloading'
          item.attempts += 1
          job.currentItemId = item.itemId
          try {
            await this.worker(item, job)
            item.state = 'installed'
            item.error = undefined
          } catch (error) {
            item.state = 'failed'
            item.error = {
              code:
                typeof (error as { code?: unknown }).code === 'string'
                  ? (error as { code: string }).code
                  : 'ART_SYNC_FAILED',
              message: (error as Error).message,
              retryable: true
            }
          }
          job.revision += 1
          job.lastSequence += 1
          job.updatedAt = new Date().toISOString()
          this.recount(job)
          // Coalesce checkpoints so large batches do not rewrite the full 500-item
          // document for every asset. Real downloads still checkpoint at least
          // every 250 ms, and the terminal state is always flushed below.
          if (Date.now() - lastPersistedAt >= 250) {
            lastPersistedAt = Date.now()
            await this.store.put(structuredClone(job))
          }
        }
      })
    )
    job.currentItemId = undefined
    this.recount(job)
    if (job.state === 'running')
      job.state = job.items.some((item) => item.state === 'failed') ? 'partial' : 'completed'
    job.revision += 1
    job.updatedAt = new Date().toISOString()
    await this.store.put(job)
    return structuredClone(job)
  }

  private async require(jobId: string, expectedRevision: number): Promise<ArtSyncJob> {
    const job = await this.store.get(jobId)
    if (!job) throw Object.assign(new Error('Art sync job not found'), { code: 'JOB_NOT_FOUND' })
    if (job.revision !== expectedRevision)
      throw Object.assign(new Error('Art sync job revision is stale'), { code: 'STALE_REVISION' })
    return job
  }

  private async setState(
    jobId: string,
    expectedRevision: number,
    state: 'paused' | 'cancelled'
  ): Promise<ArtSyncJob> {
    const job = await this.require(jobId, expectedRevision)
    job.state = state
    job.revision += 1
    job.updatedAt = new Date().toISOString()
    await this.store.put(job)
    return job
  }

  private recount(job: ArtSyncJob): void {
    job.counts = {}
    for (const item of job.items) job.counts[item.state] = (job.counts[item.state] ?? 0) + 1
  }
}
