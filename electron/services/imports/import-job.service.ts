import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { ImportJob } from '../../../src/types/opl-finalization'
import { AtomicEntityStore } from '../persistence/atomic-entity-store.service'
import { operationEvents } from '../operations/operation-event.publisher'

export class ImportJobService {
  private readonly store: AtomicEntityStore<ImportJob>
  private controllers = new Map<string, AbortController>()
  constructor(filePath: string) {
    this.store = new AtomicEntityStore(filePath, 'jobId', { schemaVersion: 1 })
  }
  async create(
    sourcePaths: string[],
    devicePath: string,
    mediaType: 'DVD' | 'CD'
  ): Promise<ImportJob> {
    const now = new Date().toISOString()
    const items = await Promise.all(
      sourcePaths.map(async (sourcePath) => {
        const value = await stat(sourcePath)
        return {
          itemId: randomUUID(),
          displayName: path.basename(sourcePath),
          sourcePath,
          phase: 'queued' as const,
          bytesDone: 0,
          totalBytes: value.size,
          canCancel: true
        }
      })
    )
    const job: ImportJob = {
      schemaVersion: 1,
      revision: 0,
      jobId: randomUUID(),
      devicePath,
      mediaType,
      state: 'queued',
      items,
      progress: 0,
      lastSequence: 0,
      createdAt: now,
      updatedAt: now
    }
    await this.store.put(job)
    void this.run(job.jobId)
    return this.public(job)
  }
  async get(jobId: string): Promise<ImportJob | undefined> {
    const job = await this.store.get(jobId)
    return job ? this.public(job) : undefined
  }
  async list(): Promise<ImportJob[]> {
    return Object.values((await this.store.document()).data).map((job) => this.public(job))
  }
  async cancel(jobId: string, expectedRevision: number): Promise<ImportJob> {
    const job = await this.require(jobId)
    if (job.revision !== expectedRevision)
      throw Object.assign(new Error('Import revision is stale'), { code: 'STALE_REVISION' })
    this.controllers.get(jobId)?.abort()
    job.state = 'cancelled'
    job.revision += 1
    job.updatedAt = new Date().toISOString()
    await this.store.put(job)
    return this.public(job)
  }
  private async run(jobId: string): Promise<void> {
    const controller = new AbortController()
    this.controllers.set(jobId, controller)
    const job = await this.require(jobId)
    job.state = 'running'
    await this.save(job)
    try {
      for (const item of job.items) {
        if (controller.signal.aborted) break
        job.currentItemId = item.itemId
        item.phase = 'copying'
        item.canCancel = true
        await this.save(job)
        const targetDir = path.join(job.devicePath!, job.mediaType!)
        await mkdir(targetDir, { recursive: true })
        const final = path.join(targetDir, path.basename(item.displayName))
        const staged = `${final}.oplforge-${job.jobId}.part`
        let bytes = 0
        const started = Date.now()
        const source = createReadStream(item.sourcePath!)
        source.on('data', (chunk: Buffer) => {
          bytes += chunk.length
          item.bytesDone = bytes
          item.throughputBytesPerSecond = bytes / Math.max(1, (Date.now() - started) / 1000)
          item.etaSeconds = item.totalBytes
            ? (item.totalBytes - bytes) / item.throughputBytesPerSecond
            : undefined
          this.recalculate(job)
          operationEvents.publish({
            operationId: job.jobId,
            kind: 'import',
            revision: job.revision,
            state: job.state,
            phase: item.phase,
            progress: job.progress,
            currentItem: item.displayName,
            bytes: { done: bytes, total: item.totalBytes },
            canCancel: true,
            message: `Importando ${item.displayName}`
          })
        })
        try {
          await pipeline(source, createWriteStream(staged, { flags: 'wx' }), {
            signal: controller.signal
          })
          item.phase = 'promoting'
          item.canCancel = false
          await rename(staged, final)
          item.phase = 'completed'
          item.canCancel = false
        } catch (error) {
          await rm(staged, { force: true }).catch(() => undefined)
          if (controller.signal.aborted) item.phase = 'cancelled'
          else {
            item.phase = 'failed'
            item.error = {
              code: 'IMPORT_COPY_FAILED',
              message: error instanceof Error ? error.message : 'Falha na cópia',
              retryable: true
            }
          }
        }
        await this.save(job)
      }
      job.state = controller.signal.aborted
        ? 'cancelled'
        : job.items.every((item) => item.phase === 'completed')
          ? 'completed'
          : job.items.some((item) => item.phase === 'completed')
            ? 'partial'
            : 'failed'
      job.currentItemId = undefined
      this.recalculate(job)
      await this.save(job)
    } finally {
      this.controllers.delete(jobId)
    }
  }
  private recalculate(job: ImportJob): void {
    const total = job.items.reduce((sum, item) => sum + (item.totalBytes ?? 0), 0)
    const done = job.items.reduce((sum, item) => sum + item.bytesDone, 0)
    job.progress = total ? Math.min(100, (done / total) * 100) : 0
  }
  private async save(job: ImportJob): Promise<void> {
    job.revision += 1
    job.updatedAt = new Date().toISOString()
    await this.store.put(job)
  }
  private async require(id: string): Promise<ImportJob> {
    const job = await this.store.get(id)
    if (!job) throw Object.assign(new Error('Import job not found'), { code: 'IMPORT_NOT_FOUND' })
    return job
  }
  private public(job: ImportJob): ImportJob {
    const safe = structuredClone(job)
    safe.devicePath = undefined
    for (const item of safe.items) item.sourcePath = undefined
    return safe
  }
}
