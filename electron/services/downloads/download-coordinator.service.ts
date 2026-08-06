import { createHash, randomUUID } from 'node:crypto'
import type {
  DurableDownloadTask,
  DurableDownloadTaskSummary,
  EnqueueDownloadInput,
  ListDownloadsInput,
  Page,
  RevisionedTaskRef
} from '../../../src/types/opl-finalization'
import { transitionDownloadTask } from './download-state-machine'
import { DownloadSchedulerService } from './download-scheduler.service'
import type { DownloadTaskStore } from './download-task.store'

export class DownloadCoordinatorService {
  private readonly tasks = new Map<string, DurableDownloadTask>()
  private readonly sources = new Map<string, EnqueueDownloadInput['source']>()
  private queueRevision = 0
  private writeQueue: Promise<void> = Promise.resolve()
  private initialized = false
  private processor?: (
    task: DurableDownloadTask,
    source: EnqueueDownloadInput['source']
  ) => Promise<void>
  private readonly running = new Set<string>()
  private readonly abortControllers = new Map<string, AbortController>()

  constructor(
    private readonly scheduler = new DownloadSchedulerService(),
    private readonly store?: DownloadTaskStore
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    if (this.store) {
      const snapshot = await this.store.list()
      this.queueRevision = snapshot.revision
      for (const persisted of snapshot.items) {
        const obsoleteProfileFailure = persisted.lastError?.code === 'PROFILE_NOT_FOUND'
        const obsoletePartExtensionFailure =
          persisted.lastError?.code === 'UNSUPPORTED_FORMAT' &&
          /\.(?:iso|zso)$/i.test(persisted.source.originalFileName ?? '')
        const task =
          persisted.phase === 'failed' && (obsoleteProfileFailure || obsoletePartExtensionFailure)
            ? {
                ...persisted,
                phase: 'queued' as const,
                phaseProgress: 0,
                lastError: undefined,
                revision: persisted.revision + 1,
                updatedAt: new Date().toISOString()
              }
            : persisted
        this.tasks.set(task.taskId, task)
        if (task !== persisted) {
          this.queueRevision += 1
          await this.store.put(task)
        }
      }
    }
    this.initialized = true
  }

  async enqueue(input: EnqueueDownloadInput): Promise<DurableDownloadTask> {
    await this.initialize()
    const now = new Date().toISOString()
    const taskId = randomUUID()
    const sourceFingerprint = createHash('sha256')
      .update(JSON.stringify(input.source))
      .digest('hex')
    const duplicate = [...this.tasks.values()].find(
      (task) =>
        task.transfer.sourceFingerprint === sourceFingerprint &&
        !['failed', 'cancelled', 'ready'].includes(task.phase)
    )
    if (duplicate) return structuredClone(duplicate)
    const task: DurableDownloadTask = {
      schemaVersion: 1,
      revision: 0,
      taskId,
      source: {
        kind: input.source.kind,
        sourceRef:
          input.source.kind === 'http'
            ? sanitizeSourceUrl(input.source.url)
            : (input.source.magnet ?? `torrent:${sourceFingerprint}`),
        expectedBytes: 'expectedBytes' in input.source ? input.source.expectedBytes : undefined,
        originalFileName:
          'originalFileName' in input.source ? input.source.originalFileName : undefined
      },
      legalReceiptId: input.legalReceiptId,
      targetDeviceId: input.deviceId,
      targetProfileId: input.profileId,
      requestedTitle:
        input.title ??
        (input.source.kind === 'http' ? (input.source.originalFileName ?? 'Download') : 'Torrent'),
      requestedMedia: input.mediaHint,
      selectedFiles: input.source.kind === 'torrent' ? (input.source.selectedFiles ?? []) : [],
      phase: 'queued',
      phaseProgress: 0,
      overallProgress: 0,
      transfer: {
        cacheKey: sourceFingerprint,
        partialRelativePath: `${taskId}/payload.part`,
        bytesConfirmed: 0,
        resumeCapability: 'unknown',
        sourceFingerprint,
        checkpointedAt: now
      },
      attempt: 0,
      lastSequence: 0,
      createdAt: now,
      updatedAt: now
    }
    this.tasks.set(taskId, task)
    this.sources.set(taskId, input.source)
    this.queueRevision += 1
    if (this.store) await this.store.put(task)
    this.kick(taskId)
    return structuredClone(task)
  }

  async list(input: ListDownloadsInput = {}): Promise<Page<DurableDownloadTaskSummary>> {
    await this.initialize()
    const offset = input.cursor ? Number(input.cursor) : 0
    const limit = input.limit ?? 100
    const selected = [...this.tasks.values()].filter(
      (task) =>
        (!input.deviceId || task.targetDeviceId === input.deviceId) &&
        (!input.phases?.length || input.phases.includes(task.phase))
    )
    const page = selected.slice(offset, offset + limit)
    return {
      items: page.map(({ source, ...task }) => ({
        ...structuredClone(task),
        source: {
          kind: source.kind,
          originalFileName: source.originalFileName,
          expectedBytes: source.expectedBytes
        }
      })),
      nextCursor: offset + limit < selected.length ? String(offset + limit) : undefined,
      revision: this.queueRevision
    }
  }

  async get(taskId: string): Promise<DurableDownloadTask | undefined> {
    await this.initialize()
    const task = this.tasks.get(taskId)
    return task ? structuredClone(task) : undefined
  }

  async pause(input: RevisionedTaskRef): Promise<DurableDownloadTask> {
    this.abortControllers.get(input.taskId)?.abort()
    return this.mutate(input, 'paused')
  }
  async resume(input: RevisionedTaskRef): Promise<DurableDownloadTask> {
    return this.mutate(input, 'queued')
  }
  async retry(input: RevisionedTaskRef): Promise<DurableDownloadTask> {
    return this.mutate(input, 'queued')
  }

  async cancel(input: RevisionedTaskRef): Promise<DurableDownloadTask> {
    this.abortControllers.get(input.taskId)?.abort()
    return this.mutate(input, 'cancelled')
  }

  async retryFailed(
    expectedQueueRevision: number,
    deviceId?: string
  ): Promise<{ queuedTaskIds: string[]; skippedTaskIds: string[] }> {
    if (expectedQueueRevision !== this.queueRevision)
      throw Object.assign(new Error('Queue revision is stale'), { code: 'STALE_REVISION' })
    const queuedTaskIds: string[] = []
    const skippedTaskIds: string[] = []
    for (const task of this.tasks.values()) {
      if (
        task.phase === 'failed' &&
        (!deviceId || task.targetDeviceId === deviceId) &&
        task.lastError?.retryable
      ) {
        this.tasks.set(task.taskId, transitionDownloadTask(task, 'queued'))
        queuedTaskIds.push(task.taskId)
      } else if (task.phase === 'failed') skippedTaskIds.push(task.taskId)
    }
    if (queuedTaskIds.length) this.queueRevision += 1
    await this.flush()
    return { queuedTaskIds, skippedTaskIds }
  }

  async clearTerminal(
    expectedQueueRevision: number,
    deviceId?: string
  ): Promise<{ removedTaskIds: string[]; queueRevision: number }> {
    await this.initialize()
    if (expectedQueueRevision !== this.queueRevision)
      throw Object.assign(new Error('Queue revision is stale'), { code: 'STALE_REVISION' })

    const terminalPhases = new Set<DurableDownloadTask['phase']>(['ready', 'failed', 'cancelled'])
    const removedTaskIds = [...this.tasks.values()]
      .filter(
        (task) => terminalPhases.has(task.phase) && (!deviceId || task.targetDeviceId === deviceId)
      )
      .map((task) => task.taskId)

    if (!removedTaskIds.length) return { removedTaskIds, queueRevision: this.queueRevision }

    for (const taskId of removedTaskIds) {
      this.tasks.delete(taskId)
      this.sources.delete(taskId)
    }
    this.queueRevision += 1
    if (this.store) await this.store.replaceAll([...this.tasks.values()])
    return { removedTaskIds, queueRevision: this.queueRevision }
  }

  async process(
    taskId: string,
    transfer: (
      source: EnqueueDownloadInput['source'],
      task: DurableDownloadTask,
      signal: AbortSignal
    ) => Promise<void>,
    finalize: (task: DurableDownloadTask) => Promise<void>
  ): Promise<DurableDownloadTask> {
    let task = this.require(taskId)
    const controller = new AbortController()
    this.abortControllers.set(taskId, controller)
    await this.scheduler
      .scheduleNetwork(0, async () => {
        task = await this.advance(taskId, 'probing')
        task = await this.advance(taskId, 'transferring')
        await transfer(this.sources.get(taskId)!, structuredClone(task), controller.signal)
        task = this.require(taskId)
        task = await this.advance(taskId, 'downloaded')
      })
      .finally(() => this.abortControllers.delete(taskId))
    await this.scheduler.scheduleWrite(task.targetDeviceId, 0, async () =>
      finalize(structuredClone(task))
    )
    return structuredClone(this.require(taskId))
  }

  async advance(
    taskId: string,
    phase: DurableDownloadTask['phase'],
    phaseProgress = 0
  ): Promise<DurableDownloadTask> {
    const task = this.require(taskId)
    const updated = this.update(taskId, transitionDownloadTask(task, phase, { phaseProgress }))
    await this.flush()
    return structuredClone(updated)
  }

  async checkpointTransfer(
    taskId: string,
    bytesConfirmed: number,
    totalBytes?: number
  ): Promise<void> {
    if (!this.store) return
    await this.store.checkpoint(taskId, bytesConfirmed, totalBytes)
    const persisted = await this.store.get(taskId)
    if (persisted && (this.tasks.get(taskId)?.revision ?? -1) <= persisted.revision)
      this.tasks.set(taskId, persisted)
  }

  private async mutate(
    input: RevisionedTaskRef,
    phase: DurableDownloadTask['phase']
  ): Promise<DurableDownloadTask> {
    const task = this.require(input.taskId)
    if (task.revision !== input.expectedRevision)
      throw Object.assign(new Error('Task revision is stale'), { code: 'STALE_REVISION' })
    const updated = this.update(task.taskId, transitionDownloadTask(task, phase))
    await this.flush()
    if (phase === 'queued') this.kick(task.taskId)
    return structuredClone(updated)
  }

  private require(taskId: string): DurableDownloadTask {
    const task = this.tasks.get(taskId)
    if (!task) throw Object.assign(new Error('Download task not found'), { code: 'TASK_NOT_FOUND' })
    return task
  }

  private update(taskId: string, task: DurableDownloadTask): DurableDownloadTask {
    this.tasks.set(taskId, task)
    this.queueRevision += 1
    if (this.store) this.writeQueue = this.writeQueue.then(() => this.store!.put(task))
    return task
  }

  async flush(): Promise<void> {
    await this.writeQueue
    await this.store?.flushAll()
  }

  async start(
    processor: (task: DurableDownloadTask, source: EnqueueDownloadInput['source']) => Promise<void>
  ): Promise<void> {
    await this.initialize()
    this.processor = processor
    for (const task of this.tasks.values()) if (task.phase === 'queued') this.kick(task.taskId)
  }

  stop(): void {
    this.processor = undefined
  }

  async fail(taskId: string, error: unknown): Promise<DurableDownloadTask> {
    const task = this.require(taskId)
    const candidate =
      error && typeof error === 'object'
        ? (error as { code?: unknown; message?: unknown; retryable?: unknown })
        : {}
    const updated: DurableDownloadTask = {
      ...task,
      phase: 'failed',
      revision: task.revision + 1,
      updatedAt: new Date().toISOString(),
      lastError: {
        code: typeof candidate.code === 'string' ? candidate.code : 'PIPELINE_FAILED',
        message: typeof candidate.message === 'string' ? candidate.message : 'Pipeline failed',
        retryable: candidate.retryable !== false,
        phase: task.phase
      }
    }
    this.update(taskId, updated)
    await this.flush()
    return structuredClone(updated)
  }

  private kick(taskId: string): void {
    if (!this.processor || this.running.has(taskId)) return
    const task = this.tasks.get(taskId)
    if (!task || task.phase !== 'queued') return
    const source = this.sources.get(taskId) ?? sourceFromTask(task)
    this.running.add(taskId)
    void this.processor(structuredClone(task), source)
      .catch(async (error) => {
        const current = this.tasks.get(taskId)
        if (current && !['paused', 'cancelled'].includes(current.phase))
          await this.fail(taskId, error)
      })
      .finally(() => {
        this.running.delete(taskId)
        this.kick(taskId)
      })
  }

  async batchReport(deviceId?: string): Promise<{
    queueRevision: number
    total: number
    phases: Partial<Record<DurableDownloadTask['phase'], number>>
    readyWithArt: number
    readyWithoutArt: number
    failures: Array<{ taskId: string; code: string; retryable: boolean }>
  }> {
    await this.initialize()
    const tasks = [...this.tasks.values()].filter(
      (task) => !deviceId || task.targetDeviceId === deviceId
    )
    const phases: Partial<Record<DurableDownloadTask['phase'], number>> = {}
    for (const task of tasks) phases[task.phase] = (phases[task.phase] ?? 0) + 1
    return {
      queueRevision: this.queueRevision,
      total: tasks.length,
      phases,
      readyWithArt: tasks.filter((task) => task.phase === 'ready' && task.artJobId).length,
      readyWithoutArt: tasks.filter((task) => task.phase === 'ready' && !task.artJobId).length,
      failures: tasks.flatMap((task) =>
        task.lastError
          ? [
              {
                taskId: task.taskId,
                code: task.lastError.code,
                retryable: task.lastError.retryable
              }
            ]
          : []
      )
    }
  }
}

let coordinator: DownloadCoordinatorService | undefined
export function getDownloadCoordinator(): DownloadCoordinatorService {
  return (coordinator ??= new DownloadCoordinatorService())
}
export function configureDownloadCoordinator(
  service: DownloadCoordinatorService
): DownloadCoordinatorService {
  coordinator = service
  return service
}

function sanitizeSourceUrl(value: string): string {
  const url = new URL(value)
  url.username = ''
  url.password = ''
  return url.toString()
}

function sourceFromTask(task: DurableDownloadTask): EnqueueDownloadInput['source'] {
  if (task.source.kind === 'http')
    return {
      kind: 'http',
      url: task.source.sourceRef,
      expectedBytes: task.source.expectedBytes,
      originalFileName: task.source.originalFileName
    }
  return {
    kind: 'torrent',
    magnet: task.source.sourceRef.startsWith('magnet:') ? task.source.sourceRef : undefined,
    torrentToken: task.source.sourceRef.startsWith('magnet:') ? undefined : task.source.sourceRef,
    selectedFiles: task.selectedFiles
  }
}
