import { describe, expect, it, vi } from 'vitest'
import type {
  FragmentationDiagnostic,
  RepairOperation,
  RepairPlan,
  RepairPlanItem,
  RepairReport
} from '@/types/opl'
import { FragmentationBatchService } from '@electron/services/fragmentation-repair/batch.service'
import { FragmentationRepairReportService } from '@electron/services/fragmentation-repair/report.service'

const item = (id: string, order: number): RepairPlanItem => ({
  installation: {
    installationId: id,
    deviceId: 'device',
    format: 'ISO',
    relativePaths: [`DVD/${id}.iso`],
    title: id,
    media: 'DVD'
  },
  sourceFingerprints: [
    { relativePath: `DVD/${id}.iso`, sizeBytes: 10, sha256: id.repeat(64).slice(0, 64) }
  ],
  filesToRewrite: [`DVD/${id}.iso`],
  ulCfgAction: 'none',
  candidateBytes: 10,
  operationalMarginBytes: 64,
  temporaryBytes: 74,
  risks: [],
  order
})
const items = [item('a', 0), item('b', 1), item('c', 2)]
const plan: RepairPlan = {
  planId: 'plan',
  revision: 0,
  diagnosticId: 'diagnostic',
  diagnosticRevision: 1,
  deviceId: 'device',
  mode: 'batch',
  status: 'awaiting-confirmation',
  items,
  exclusions: [],
  peakTemporaryBytes: 74,
  freeBytesObserved: 100,
  confirmationText: 'CORRIGIR FRAGMENTAÇÃO',
  recoveryStrategy: 'rollback',
  createdAt: new Date(0).toISOString()
}
const diagnostic = (states: Array<'fragmented' | 'contiguous'>): FragmentationDiagnostic => ({
  diagnosticId: 'diagnostic',
  revision: 1,
  device: {
    deviceId: 'device',
    mountPath: '/device',
    realPath: '/device',
    fileSystem: 'exfat',
    totalBytes: 1000,
    freeBytes: 100,
    extentVerification: 'supported',
    method: 'fixture',
    homologated: true,
    limitations: [],
    observedAt: new Date(0).toISOString()
  },
  status: 'complete',
  installations: items.map((entry, index) => ({
    identity: entry.installation,
    files: [],
    state: states[index],
    totalBytes: 10,
    temporaryBytes: 74,
    findings: []
  })),
  summary: {
    total: 3,
    byState: {
      contiguous: 0,
      fragmented: 3,
      'partially-fragmented': 0,
      incomplete: 0,
      invalid: 0,
      unverifiable: 0
    },
    eligibleGames: 3,
    affectedFiles: 3,
    freeBytes: 100,
    peakTemporaryBytes: 74
  },
  startedAt: new Date(0).toISOString(),
  completedAt: new Date(1).toISOString()
})

describe('batch orchestration and reconciliation integration', () => {
  it('preserves every mixed outcome and performs one final diagnosis for accessible items', async () => {
    const transaction = {
      cancel: vi.fn(),
      execute: vi.fn(async (_operation: string, _plan: RepairPlan, current: RepairPlanItem) => {
        if (current.installation.installationId === 'b')
          throw Object.assign(new Error('locked'), { code: 'FILE_LOCKED' })
        return { journal: { state: 'cleanup-complete' }, modifiedFiles: current.filesToRewrite }
      })
    }
    const free = vi
      .fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)
    const batch = await new FragmentationBatchService(transaction as never, free).execute(
      'operation',
      plan,
      '/device'
    )
    const operation: RepairOperation = {
      operationId: 'operation',
      planId: 'plan',
      expectedDeviceRevision: 1,
      status: 'failed',
      items: batch.items,
      lastSequence: 6,
      startedAt: new Date(0).toISOString(),
      completedAt: new Date(2).toISOString()
    }
    let persisted: RepairReport | undefined
    const diagnosis = {
      diagnose: vi.fn(async () => diagnostic(['contiguous', 'fragmented', 'fragmented']))
    }
    const reports = {
      put: vi.fn(async (value: RepairReport) => {
        persisted = value
        return {}
      })
    }
    const report = await new FragmentationRepairReportService(
      diagnosis as never,
      reports as never,
      () => 'report',
      () => new Date(3)
    ).terminalBatch(
      plan,
      operation,
      diagnostic(['fragmented', 'fragmented', 'fragmented']),
      batch.modifiedFiles
    )
    expect(diagnosis.diagnose).toHaveBeenCalledOnce()
    expect(report.games.map(({ outcome }) => outcome)).toEqual(['corrected', 'failed', 'failed'])
    expect(report.counts).toMatchObject({ corrected: 1, failed: 2 })
    expect(Object.values(report.counts).reduce((sum, count) => sum + count, 0)).toBe(3)
    expect(persisted).toEqual(report)
  })
})
