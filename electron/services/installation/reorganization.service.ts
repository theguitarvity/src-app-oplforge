import { copyFile, mkdir, open, rm, stat, statfs } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import type { ReorganizationPlan, ReorganizationResult } from '../../../src/types/opl'
import { deviceLocks } from '../persistence/device-lock.service'
import { sha256File } from './installation-planner.service'
import { ReorganizationInventoryService } from './reorganization-inventory.service'

export class ReorganizationService {
  private plans = new Map<string, ReorganizationPlan>()
  private cancelled = new Set<string>()
  constructor(
    private readonly inventoryService: ReorganizationInventoryService,
    private readonly fragmentation: FragmentationAdapter,
    private readonly isExternal: (
      devicePath: string,
      backupPath: string
    ) => Promise<boolean> = async (devicePath, backupPath) =>
      (await stat(devicePath, { bigint: true })).dev !==
      (await stat(backupPath, { bigint: true })).dev
  ) {}
  async plan(
    deviceId: string,
    devicePath: string,
    backupPath: string
  ): Promise<ReorganizationPlan> {
    if (!(await this.isExternal(devicePath, backupPath)))
      throw Object.assign(new Error('Backup must be on a different physical filesystem'), {
        code: 'BACKUP_NOT_EXTERNAL'
      })
    const inventory = await this.inventoryService.create(devicePath)
    const requiredBytes = inventory.reduce((sum, item) => sum + item.sizeBytes, 0)
    const fs = await statfs(backupPath)
    const availableBytes = Number(fs.bavail) * Number(fs.bsize)
    if (availableBytes < requiredBytes)
      throw Object.assign(new Error('Insufficient external backup space'), {
        code: 'INSUFFICIENT_BACKUP_SPACE'
      })
    const id = randomUUID()
    const value = {
      id,
      deviceId,
      devicePath: path.resolve(devicePath),
      backupPath: path.resolve(backupPath),
      backupRoot: path.join(path.resolve(backupPath), `.oplforge-backup-${id}`),
      requiredBytes,
      availableBytes,
      expectedRevision: deviceLocks.revision(deviceId),
      inventory
    }
    this.plans.set(id, value)
    return value
  }
  cancel(id: string) {
    this.cancelled.add(id)
  }
  async confirm(id: string, revision: number, confirmation: string): Promise<ReorganizationResult> {
    const plan = this.plans.get(id)
    if (!plan)
      throw Object.assign(new Error('Reorganization plan not found'), { code: 'PLAN_NOT_FOUND' })
    if (confirmation !== 'REORGANIZAR COM BACKUP VERIFICADO')
      throw Object.assign(new Error('Explicit reorganization confirmation required'), {
        code: 'CONFIRMATION_REQUIRED'
      })
    return deviceLocks.withLock(plan.deviceId, revision, async () => this.execute(plan))
  }
  private async execute(plan: ReorganizationPlan): Promise<ReorganizationResult> {
    const audit: string[] = []
    const journalPath = path.join(plan.backupRoot, 'journal.json')
    await mkdir(plan.backupRoot, { recursive: true })
    const journal = async (state: string) => {
      const handle = await open(journalPath, 'w', 0o600)
      try {
        await handle.writeFile(JSON.stringify({ state, plan, audit }, null, 2))
        await handle.sync()
      } finally {
        await handle.close()
      }
    }
    try {
      await journal('backing-up')
      for (const entry of plan.inventory) {
        if (this.cancelled.has(plan.id))
          throw Object.assign(new Error('Reorganization cancelled'), { code: 'CANCELLED' })
        const destination = path.join(plan.backupRoot, 'files', entry.relativePath)
        await mkdir(path.dirname(destination), { recursive: true })
        await copyFile(path.join(plan.devicePath, entry.relativePath), destination)
        if ((await sha256File(destination)) !== entry.sha256)
          throw Object.assign(new Error(`Backup hash mismatch: ${entry.relativePath}`), {
            code: 'HASH_MISMATCH'
          })
      }
      audit.push('backup-verified')
      await journal('backup-verified')
      for (const entry of plan.inventory)
        await rm(path.join(plan.devicePath, entry.relativePath), { force: true })
      await journal('rewriting')
      for (const entry of plan.inventory) {
        const destination = path.join(plan.devicePath, entry.relativePath)
        await mkdir(path.dirname(destination), { recursive: true })
        await copyFile(path.join(plan.backupRoot, 'files', entry.relativePath), destination)
        if ((await sha256File(destination)) !== entry.sha256)
          throw Object.assign(new Error(`Rewrite hash mismatch: ${entry.relativePath}`), {
            code: 'HASH_MISMATCH'
          })
      }
      const relevant = plan.inventory.filter((entry) =>
        /\.(iso|zso|\d{2})$/i.test(entry.relativePath)
      )
      const evidence = await Promise.all(
        relevant.map((entry) =>
          this.fragmentation.inspect(path.join(plan.devicePath, entry.relativePath))
        )
      )
      const fragmentation = evidence.some((item) => item.state === 'fragmented')
        ? 'fragmented'
        : evidence.length > 0 && evidence.every((item) => item.state === 'contiguous')
          ? 'contiguous'
          : 'unknown'
      audit.push('rewrite-verified')
      await journal('complete')
      this.plans.delete(plan.id)
      return { operationId: plan.id, restoredFiles: plan.inventory.length, fragmentation, audit }
    } catch (error) {
      audit.push('recovery-started')
      for (const entry of plan.inventory) {
        const backup = path.join(plan.backupRoot, 'files', entry.relativePath)
        try {
          const destination = path.join(plan.devicePath, entry.relativePath)
          await mkdir(path.dirname(destination), { recursive: true })
          await copyFile(backup, destination)
        } catch {
          /* report original failure; backup remains */
        }
      }
      await journal('recovery-required')
      throw error
    }
  }
  async recover(backupRoot: string): Promise<void> {
    const plan = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(path.join(backupRoot, 'journal.json'), 'utf8')
    ).plan as ReorganizationPlan
    for (const entry of plan.inventory) {
      const destination = path.join(plan.devicePath, entry.relativePath)
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(path.join(plan.backupRoot, 'files', entry.relativePath), destination)
    }
  }
}
