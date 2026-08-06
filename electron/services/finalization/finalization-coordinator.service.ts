import type {
  DurableDownloadTask,
  FinalizationPlan,
  ValidatedGameImage
} from '../../../src/types/opl-finalization'
import type { DownloadCoordinatorService } from '../downloads/download-coordinator.service'
import { DownloadSchedulerService } from '../downloads/download-scheduler.service'
import { canonicalGameName, normalizeGameId } from '../images/game-naming.service'

export interface FinalizationCoordinatorDependencies {
  downloads: DownloadCoordinatorService
  scheduler?: DownloadSchedulerService
  inspect(task: DurableDownloadTask): Promise<ValidatedGameImage>
  plan(image: ValidatedGameImage, task: DurableDownloadTask): Promise<FinalizationPlan>
  install(plan: FinalizationPlan): Promise<void>
  verify(plan: FinalizationPlan): Promise<void>
  catalog(plan: FinalizationPlan): Promise<void>
  queueArt?(plan: FinalizationPlan): Promise<string | undefined>
}

export class FinalizationCoordinatorService {
  private readonly plans = new Map<string, FinalizationPlan>()
  private readonly images = new Map<string, ValidatedGameImage>()
  private readonly scheduler: DownloadSchedulerService

  constructor(private readonly dependencies: FinalizationCoordinatorDependencies) {
    this.scheduler = dependencies.scheduler ?? new DownloadSchedulerService()
  }

  async prepare(taskId: string): Promise<FinalizationPlan> {
    const task = await this.requireTask(taskId)
    await this.dependencies.downloads.advance(taskId, 'validating')
    const image = await this.dependencies.inspect(task)
    if (!image.gameIdentity.gameId)
      throw Object.assign(new Error('Authoritative Game ID is required before finalization'), {
        code: 'GAME_ID_REQUIRED'
      })
    this.images.set(image.imageId, structuredClone(image))
    await this.dependencies.downloads.advance(taskId, 'planning')
    const plan = await this.dependencies.plan(image, await this.requireTask(taskId))
    plan.canonicalName ??= canonicalGameName(
      image.gameIdentity.gameId,
      image.gameIdentity.title,
      image.extension
    )
    if (image.gameIdentity.conflicts.length)
      plan.warnings.push('Game ID hints disagree with the authoritative media identity')
    this.plans.set(plan.planId, structuredClone(plan))
    if (plan.status === 'awaiting-confirmation')
      await this.dependencies.downloads.advance(taskId, 'awaiting-confirmation')
    return structuredClone(plan)
  }

  getPlan(planId: string): FinalizationPlan | undefined {
    const plan = this.plans.get(planId)
    return plan ? structuredClone(plan) : undefined
  }

  async setGameId(
    planId: string,
    expectedRevision: number,
    gameId: string
  ): Promise<FinalizationPlan> {
    const current = this.plans.get(planId)
    if (!current)
      throw Object.assign(new Error('Finalization plan not found'), { code: 'PLAN_NOT_FOUND' })
    if (current.revision !== expectedRevision || current.status !== 'awaiting-confirmation')
      throw Object.assign(new Error('Finalization plan is stale'), { code: 'STALE_REVISION' })
    const normalized = normalizeGameId(gameId)
    if (!normalized) throw Object.assign(new Error('Invalid Game ID'), { code: 'INVALID_GAME_ID' })
    const image = this.images.get(current.imageId)
    if (!image)
      throw Object.assign(new Error('Validated image not found'), { code: 'IMAGE_NOT_FOUND' })
    image.gameIdentity.gameId = normalized
    image.gameIdentity.authoritativeSource = 'user-override'
    image.gameIdentity.evidence.push({
      source: 'user-override',
      value: normalized,
      authoritative: true
    })
    const replanned = await this.dependencies.plan(
      structuredClone(image),
      await this.requireTask(current.taskId)
    )
    const updated: FinalizationPlan = {
      ...replanned,
      planId,
      revision: current.revision + 1,
      status: 'awaiting-confirmation',
      canonicalName: canonicalGameName(normalized, image.gameIdentity.title, image.extension),
      updatedAt: new Date().toISOString()
    }
    this.plans.set(planId, updated)
    return structuredClone(updated)
  }

  async confirm(planId: string, expectedRevision: number): Promise<DurableDownloadTask> {
    const plan = this.plans.get(planId)
    if (!plan)
      throw Object.assign(new Error('Finalization plan not found'), { code: 'PLAN_NOT_FOUND' })
    if (plan.revision !== expectedRevision || plan.status !== 'awaiting-confirmation')
      throw Object.assign(new Error('Finalization plan is stale'), { code: 'STALE_REVISION' })
    plan.status = 'confirmed'
    plan.revision += 1
    plan.updatedAt = new Date().toISOString()
    await this.scheduler.scheduleWrite(plan.deviceId, 0, async () => {
      await this.dependencies.downloads.advance(plan.taskId, 'installing')
      await this.dependencies.install(structuredClone(plan))
      await this.dependencies.downloads.advance(plan.taskId, 'verifying')
      await this.dependencies.verify(structuredClone(plan))
      await this.dependencies.downloads.advance(plan.taskId, 'cataloging')
      await this.dependencies.catalog(structuredClone(plan))
      await this.dependencies.downloads.advance(plan.taskId, 'queueing-art')
      const artJobId = await this.dependencies.queueArt?.(structuredClone(plan))
      const current = await this.dependencies.downloads.advance(plan.taskId, 'ready', 100)
      if (artJobId) current.artJobId = artJobId
    })
    plan.status = 'consumed'
    plan.revision += 1
    plan.updatedAt = new Date().toISOString()
    return this.requireTask(plan.taskId)
  }

  async cancel(taskId: string, expectedRevision: number): Promise<DurableDownloadTask> {
    return this.dependencies.downloads.cancel({ taskId, expectedRevision })
  }

  private async requireTask(taskId: string): Promise<DurableDownloadTask> {
    const task = await this.dependencies.downloads.get(taskId)
    if (!task) throw Object.assign(new Error('Download task not found'), { code: 'TASK_NOT_FOUND' })
    return task
  }
}
