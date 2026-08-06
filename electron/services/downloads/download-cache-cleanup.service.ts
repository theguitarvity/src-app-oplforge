import { mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import type { DurableDownloadTask } from '../../../src/types/opl-finalization'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'

export interface DownloadCacheCleanupResult {
  taskId: string
  removed: boolean
  freedBytes: number
}

export class DownloadCacheCleanupService {
  constructor(private readonly cacheRoot: string) {}

  async cleanupReady(task: DurableDownloadTask): Promise<DownloadCacheCleanupResult> {
    if (task.phase !== 'ready') return { taskId: task.taskId, removed: false, freedBytes: 0 }
    const segments = task.transfer.partialRelativePath.split('/').filter(Boolean)
    if (
      segments.length < 2 ||
      segments[0] !== task.taskId ||
      path.isAbsolute(task.transfer.partialRelativePath)
    )
      throw Object.assign(new Error('Download cache path does not belong to its task'), {
        code: 'PATH_ESCAPE'
      })
    await mkdir(this.cacheRoot, { recursive: true })
    const root = await captureSafeRoot(this.cacheRoot)
    let taskDirectory: string
    try {
      taskDirectory = await resolveInside(root, task.taskId)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { taskId: task.taskId, removed: false, freedBytes: 0 }
      throw error
    }
    let payload: string
    try {
      payload = await resolveInside(root, task.transfer.partialRelativePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { taskId: task.taskId, removed: false, freedBytes: 0 }
      throw error
    }
    const payloadStat = await stat(payload)
    if (!payloadStat.isFile())
      throw Object.assign(new Error('Managed download cache is not a file'), {
        code: 'INVALID_CACHE_ENTRY'
      })
    await rm(taskDirectory, { recursive: true, force: false })
    return { taskId: task.taskId, removed: true, freedBytes: payloadStat.size }
  }

  async reconcile(tasks: DurableDownloadTask[]): Promise<DownloadCacheCleanupResult[]> {
    const results: DownloadCacheCleanupResult[] = []
    for (const task of tasks)
      if (task.phase === 'ready') results.push(await this.cleanupReady(task))
    return results
  }
}
