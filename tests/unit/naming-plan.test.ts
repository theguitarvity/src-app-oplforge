import { describe, expect, it } from 'vitest'
import { NamingPlanService } from '@electron/services/naming/naming-plan.service'
import { classifyNamingCandidates } from '@electron/services/naming/naming-audit.service'

describe('NamingPlanService', () => {
  it('excludes collision graph and duplicate Game IDs and orders safe temp renames', () => {
    const audit = classifyNamingCandidates('d1', [
      { currentRelativePath: 'DVD/A.iso', gameId: 'SLUS_100.00', title: 'One', extension: 'iso' },
      { currentRelativePath: 'DVD/B.iso', gameId: 'SLUS_200.00', title: 'Two', extension: 'iso' },
      { currentRelativePath: 'DVD/C.iso', gameId: 'SLUS_200.00', title: 'Two', extension: 'iso' }
    ])
    const service = new NamingPlanService()
    const plan = service.create(audit, audit.revision)
    expect(plan.exclusions).toHaveLength(2)
    expect(plan.itemIds).toHaveLength(1)
    const steps = service.steps(plan.planId)
    expect(steps[0].temporaryRelativePath).toContain('.oplforge-rename-')
    expect(steps[0].toRelativePath).toBe('DVD/SLUS_100.00.One.iso')
  })
})
