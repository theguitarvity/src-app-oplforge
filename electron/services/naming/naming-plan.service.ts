import { randomUUID } from 'node:crypto'
import type { NamingAudit, NamingPlan } from '../../../src/types/opl-finalization'

export interface NamingRenameStep {
  itemId: string
  fromRelativePath: string
  temporaryRelativePath: string
  toRelativePath: string
  expectedSha256?: string
}

export class NamingPlanService {
  private readonly renameSteps = new Map<string, NamingRenameStep[]>()
  private readonly plans = new Map<string, NamingPlan>()

  create(audit: NamingAudit, expectedRevision: number, selectedItemIds?: string[]): NamingPlan {
    if (audit.revision !== expectedRevision)
      throw Object.assign(new Error('Naming audit revision is stale'), { code: 'STALE_REVISION' })
    const selected = new Set(selectedItemIds ?? audit.items.map((item) => item.itemId))
    const itemIds: string[] = []
    const exclusions: NamingPlan['exclusions'] = []
    const steps: NamingRenameStep[] = []
    for (const item of audit.items) {
      if (!selected.has(item.itemId)) continue
      if (item.classification !== 'correctable' || !item.canonicalRelativePath) {
        exclusions.push({
          itemId: item.itemId,
          reason: item.findings[0]?.message ?? item.classification
        })
        continue
      }
      itemIds.push(item.itemId)
      const directory = item.currentRelativePath
        .replace(/\\/g, '/')
        .split('/')
        .slice(0, -1)
        .join('/')
      steps.push({
        itemId: item.itemId,
        fromRelativePath: item.currentRelativePath,
        temporaryRelativePath: `${directory}/.oplforge-rename-${randomUUID()}.tmp`,
        toRelativePath: item.canonicalRelativePath
      })
    }
    const now = new Date().toISOString()
    const plan: NamingPlan = {
      planId: randomUUID(),
      revision: 0,
      auditId: audit.auditId,
      deviceId: audit.deviceId,
      itemIds,
      exclusions,
      status: 'awaiting-confirmation',
      createdAt: now
    }
    this.plans.set(plan.planId, plan)
    this.renameSteps.set(plan.planId, steps)
    return structuredClone(plan)
  }

  get(planId: string): NamingPlan | undefined {
    const plan = this.plans.get(planId)
    return plan ? structuredClone(plan) : undefined
  }
  steps(planId: string): NamingRenameStep[] {
    return structuredClone(this.renameSteps.get(planId) ?? [])
  }
}
