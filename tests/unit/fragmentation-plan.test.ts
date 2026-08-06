import { describe, expect, it, vi } from 'vitest'
import type { FragmentationDiagnostic, GameDiagnostic, RepairPlan } from '@/types/opl'
import {
  FragmentationPlanService,
  operationalMarginBytes
} from '@electron/services/fragmentation-repair/plan.service'

const mib = 1024 ** 2
const game = (
  installationId: string,
  state: GameDiagnostic['state'] = 'fragmented',
  bytes = 100 * mib
): GameDiagnostic => ({
  identity: {
    installationId,
    deviceId: 'device-1',
    format: 'ISO',
    relativePaths: [`DVD/${installationId}.iso`],
    title: installationId,
    media: 'DVD'
  },
  files: [
    {
      relativePath: `DVD/${installationId}.iso`,
      role: 'game',
      sizeBytes: bytes,
      modifiedAt: '2026-01-01T00:00:00.000Z',
      sha256: 'a'.repeat(64),
      structuralState: 'valid',
      extentState:
        state === 'fragmented'
          ? 'fragmented'
          : state === 'contiguous'
            ? 'contiguous'
            : 'unverifiable',
      findings: []
    }
  ],
  state,
  totalBytes: bytes,
  temporaryBytes: bytes,
  findings: []
})

const diagnostic = (
  installations: GameDiagnostic[],
  revision = 3,
  freeBytes = 10_000 * mib
): FragmentationDiagnostic => ({
  diagnosticId: 'diagnostic-1',
  revision,
  device: {
    deviceId: 'device-1',
    mountPath: '/media/usb',
    realPath: '/media/usb',
    fileSystem: 'vfat',
    totalBytes: 20_000 * mib,
    freeBytes,
    extentVerification: 'supported',
    method: 'filefrag',
    homologated: true,
    limitations: [],
    observedAt: '2026-01-01T00:00:00.000Z'
  },
  status: 'complete',
  installations,
  summary: {
    total: installations.length,
    byState: {
      contiguous: 0,
      fragmented: installations.length,
      'partially-fragmented': 0,
      incomplete: 0,
      invalid: 0,
      unverifiable: 0
    },
    eligibleGames: installations.length,
    affectedFiles: installations.length,
    freeBytes,
    peakTemporaryBytes: 0
  },
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:01:00.000Z'
})

function setup(snapshot: FragmentationDiagnostic) {
  let persisted: RepairPlan | undefined
  const diagnostics = { get: vi.fn(async () => snapshot) }
  const plans = {
    put: vi.fn(async (plan: RepairPlan) => {
      persisted = structuredClone(plan)
      return {}
    })
  }
  const service = new FragmentationPlanService(
    { diagnostics, plans },
    { create: () => 'plan-1' },
    { now: () => new Date('2026-01-02T00:00:00.000Z') }
  )
  return { service, diagnostics, plans, persisted: () => persisted }
}

describe('fragmentation repair planning', () => {
  it('calculates max(64 MiB, 2%) at both boundaries', () => {
    expect(operationalMarginBytes(100 * mib)).toBe(64 * mib)
    expect(operationalMarginBytes(3_200 * mib)).toBe(64 * mib)
    expect(operationalMarginBytes(4_000 * mib)).toBe(80 * mib)
  })

  it('creates and persists an immutable revisioned single plan with exact space', async () => {
    const { service, plans, persisted } = setup(diagnostic([game('one')]))
    const plan = await service.create({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 3,
      mode: 'single',
      installationIds: ['one']
    })
    expect(plan).toMatchObject({
      planId: 'plan-1',
      revision: 0,
      diagnosticRevision: 3,
      status: 'awaiting-confirmation',
      peakTemporaryBytes: 164 * mib,
      freeBytesObserved: 10_000 * mib
    })
    expect(plan.items[0]).toMatchObject({
      filesToRewrite: ['DVD/one.iso'],
      candidateBytes: 100 * mib,
      operationalMarginBytes: 64 * mib,
      temporaryBytes: 164 * mib
    })
    expect(Object.isFrozen(plan)).toBe(true)
    expect(plans.put).toHaveBeenCalledOnce()
    expect(persisted()).toEqual(plan)
  })

  it('rejects stale diagnostics and source snapshots without persistence', async () => {
    const staleRevision = setup(diagnostic([game('one')], 4))
    await expect(
      staleRevision.service.create({
        diagnosticId: 'diagnostic-1',
        expectedRevision: 3,
        mode: 'single',
        installationIds: ['one']
      })
    ).rejects.toMatchObject({ code: 'STALE_REVISION' })
    expect(staleRevision.plans.put).not.toHaveBeenCalled()
    const running = diagnostic([game('one')])
    running.status = 'running'
    await expect(
      setup(running).service.create({
        diagnosticId: 'diagnostic-1',
        expectedRevision: 3,
        mode: 'single',
        installationIds: ['one']
      })
    ).rejects.toMatchObject({ code: 'STALE_REVISION' })
  })

  it('excludes ineligible states and missing fingerprints while retaining eligible items', async () => {
    const eligible = game('eligible')
    const invalid = game('invalid', 'invalid')
    const missingHash = game('missing-hash')
    delete missingHash.files[0].sha256
    const { service } = setup(diagnostic([eligible, invalid, missingHash]))
    const plan = await service.create({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 3,
      mode: 'batch'
    })
    expect(plan.items.map((item) => item.installation.installationId)).toEqual(['eligible'])
    expect(plan.exclusions.map((item) => [item.installation.installationId, item.code])).toEqual([
      ['invalid', 'INELIGIBLE_STATE'],
      ['missing-hash', 'SOURCE_FINGERPRINT_MISSING']
    ])
  })

  it('records insufficient free space as an actionable risk without changing the immutable estimate', async () => {
    const { service } = setup(diagnostic([game('one')], 3, 163 * mib))
    const plan = await service.create({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 3,
      mode: 'single',
      installationIds: ['one']
    })
    expect(plan.peakTemporaryBytes).toBe(164 * mib)
    expect(plan.items[0].risks.join(' ')).toMatch(/espaço insuficiente/i)
  })

  it('expands batch targets in deterministic order and uses peak rather than summed temporary space', async () => {
    const { service } = setup(
      diagnostic([
        game('z', 'fragmented', 200 * mib),
        game('a', 'fragmented', 100 * mib),
        game('m', 'contiguous', 50 * mib)
      ])
    )
    const plan = await service.create({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 3,
      mode: 'batch'
    })
    expect(plan.items.map(({ installation }) => installation.installationId)).toEqual(['a', 'z'])
    expect(plan.items.map(({ order }) => order)).toEqual([0, 1])
    expect(plan.peakTemporaryBytes).toBe(264 * mib)
    expect(plan.peakTemporaryBytes).toBeLessThan(
      plan.items.reduce((sum, item) => sum + item.temporaryBytes, 0)
    )
    expect(plan.exclusions[0]).toMatchObject({ code: 'INELIGIBLE_STATE' })
  })

  it('selects only fragmented USBExtreme parts and includes ul.cfg only with an explicit indispensable justification', async () => {
    const usb = game('usb', 'partially-fragmented', 10 * mib)
    usb.identity = {
      ...usb.identity,
      format: 'USBExtreme',
      relativePaths: ['ul.a.SLUS_123.45.00', 'ul.a.SLUS_123.45.01']
    }
    usb.files = [
      {
        ...usb.files[0],
        relativePath: usb.identity.relativePaths[0],
        role: 'usb-part',
        extentState: 'fragmented'
      },
      {
        ...usb.files[0],
        relativePath: usb.identity.relativePaths[1],
        role: 'usb-part',
        extentState: 'contiguous'
      },
      { ...usb.files[0], relativePath: 'ul.cfg', role: 'ul-cfg', extentState: 'not-applicable' }
    ]
    let plan = await setup(diagnostic([usb])).service.create({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 3,
      mode: 'single',
      installationIds: ['usb']
    })
    expect(plan.items[0]).toMatchObject({
      filesToRewrite: ['ul.a.SLUS_123.45.00'],
      ulCfgAction: 'none'
    })
    usb.files[2].findings = [
      {
        code: 'UL_CFG_REWRITE_REQUIRED',
        severity: 'warning',
        state: 'not-verified',
        message: 'references require update'
      }
    ]
    plan = await setup(diagnostic([usb])).service.create({
      diagnosticId: 'diagnostic-1',
      expectedRevision: 3,
      mode: 'single',
      installationIds: ['usb']
    })
    expect(plan.items[0].filesToRewrite).toEqual(['ul.a.SLUS_123.45.00', 'ul.cfg'])
    expect(plan.items[0]).toMatchObject({
      ulCfgAction: 'replace',
      ulCfgJustification: expect.stringMatching(/último/i)
    })
  })
})
