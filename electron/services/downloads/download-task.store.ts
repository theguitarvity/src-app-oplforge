import type { DurableDownloadTask, Page } from '../../../src/types/opl-finalization'
import { AtomicEntityStore } from '../persistence/atomic-entity-store.service'

const CHECKPOINT_MS = 1000
const CHECKPOINT_BYTES = 16 * 1024 * 1024

interface PendingCheckpoint {
  bytes: number
  totalBytes?: number
  timer: ReturnType<typeof setTimeout>
  waiters: Array<{ resolve(): void; reject(error: unknown): void }>
}

export class DownloadTaskStore {
  private readonly entities: AtomicEntityStore<DurableDownloadTask>
  private readonly pending = new Map<string, PendingCheckpoint>()
  private readonly persistedBytes = new Map<string, number>()

  constructor(filePath: string) {
    this.entities = new AtomicEntityStore(filePath, 'taskId', { schemaVersion: 1 })
  }

  async put(task: DurableDownloadTask): Promise<void> {
    await this.entities.put(structuredClone(task))
    this.persistedBytes.set(task.taskId, task.transfer.bytesConfirmed)
  }
  async get(taskId: string): Promise<DurableDownloadTask | undefined> {
    const task = await this.entities.get(taskId)
    return task ? structuredClone(this.migrate(task)) : undefined
  }

  async list(): Promise<Page<DurableDownloadTask>> {
    const document = await this.entities.document()
    return {
      items: Object.values(document.data).map((task) => structuredClone(this.migrate(task))),
      revision: document.revision
    }
  }

  private migrate(task: DurableDownloadTask): DurableDownloadTask {
    if (task.schemaVersion >= 2 && task.target) return task
    return {
      ...task,
      schemaVersion: 2,
      target: {
        kind: 'opl-device',
        deviceId: task.targetDeviceId,
        profileId: task.targetProfileId || 'opl-default',
        mediaHint: task.requestedMedia
      }
    }
  }

  async replaceAll(tasks: DurableDownloadTask[]): Promise<void> {
    await this.flushAll()
    await this.entities.replaceAll(tasks.map((task) => structuredClone(task)))
    this.persistedBytes.clear()
    for (const task of tasks) this.persistedBytes.set(task.taskId, task.transfer.bytesConfirmed)
  }

  checkpoint(taskId: string, bytesConfirmed: number, totalBytes?: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const current = this.pending.get(taskId)
      if (current) {
        current.bytes = Math.max(current.bytes, bytesConfirmed)
        current.totalBytes = totalBytes ?? current.totalBytes
        current.waiters.push({ resolve, reject })
      } else {
        const pending: PendingCheckpoint = {
          bytes: bytesConfirmed,
          totalBytes,
          timer: setTimeout(() => {
            void this.flush(taskId)
          }, CHECKPOINT_MS),
          waiters: [{ resolve, reject }]
        }
        this.pending.set(taskId, pending)
      }
      if (bytesConfirmed - (this.persistedBytes.get(taskId) ?? 0) >= CHECKPOINT_BYTES)
        void this.flush(taskId)
    })
  }

  async flushAll(): Promise<void> {
    await Promise.all([...this.pending.keys()].map((taskId) => this.flush(taskId)))
  }

  private async flush(taskId: string): Promise<void> {
    const pending = this.pending.get(taskId)
    if (!pending) return
    this.pending.delete(taskId)
    clearTimeout(pending.timer)
    try {
      const task = await this.entities.get(taskId)
      if (!task)
        throw Object.assign(new Error('Download task not found'), { code: 'TASK_NOT_FOUND' })
      task.transfer.bytesConfirmed = pending.bytes
      task.transfer.totalBytes = pending.totalBytes ?? task.transfer.totalBytes
      task.transfer.checkpointedAt = new Date().toISOString()
      task.revision += 1
      task.updatedAt = task.transfer.checkpointedAt
      if (task.transfer.totalBytes) {
        task.phaseProgress = Math.min(100, (pending.bytes / task.transfer.totalBytes) * 100)
        if (task.phase === 'transferring')
          task.overallProgress = Math.min(65, task.phaseProgress * 0.65)
      }
      await this.entities.put(task)
      this.persistedBytes.set(taskId, pending.bytes)
      pending.waiters.forEach(({ resolve }) => resolve())
    } catch (error) {
      pending.waiters.forEach(({ reject }) => reject(error))
    }
  }
}
