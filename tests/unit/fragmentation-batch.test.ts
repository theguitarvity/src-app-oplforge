import { describe, expect, it, vi } from 'vitest'
import type { RepairPlan, RepairPlanItem } from '@/types/opl'
import { FragmentationBatchService } from '@electron/services/fragmentation-repair/batch.service'

const item = (id: string, order: number): RepairPlanItem => ({
  installation: {
    installationId: id,
    deviceId: 'device',
    format: 'ISO',
    relativePaths: [`DVD/${id}.iso`],
    title: id,
    media: 'DVD'
  },
  sourceFingerprints: [],
  filesToRewrite: [`DVD/${id}.iso`],
  ulCfgAction: 'none',
  candidateBytes: 10,
  operationalMarginBytes: 64,
  temporaryBytes: 74,
  risks: [],
  order
})
const plan = (items: RepairPlanItem[]): RepairPlan => ({
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
})

describe('sequential fragmentation batch', () => {
  it('orders deterministically, keeps one active item and rechecks space per item', async () => {
    let active = 0
    let peak = 0
    const execute = vi.fn(
      async (_operation: string, _plan: RepairPlan, current: RepairPlanItem) => {
        active++
        peak = Math.max(peak, active)
        await Promise.resolve()
        active--
        return { journal: { state: 'cleanup-complete' }, modifiedFiles: current.filesToRewrite }
      }
    )
    const free = vi
      .fn()
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)
    const result = await new FragmentationBatchService(
      { execute, cancel: vi.fn() } as never,
      free
    ).execute('operation', plan([item('c', 2), item('a', 0), item('b', 1)]), '/device')
    expect(execute.mock.calls.map((call) => call[2].installation.installationId)).toEqual([
      'a',
      'b'
    ])
    expect(free).toHaveBeenCalledTimes(3)
    expect(peak).toBe(1)
    expect(result.items.map(({ installationId, outcome }) => [installationId, outcome])).toEqual([
      ['a', 'corrected'],
      ['b', 'corrected'],
      ['c', 'failed']
    ])
    expect(result.items[2].error?.code).toBe('INSUFFICIENT_SPACE')
  })

  it('continues after isolated safe failures but stops after unsafe device/recovery failures', async () => {
    const execute = vi.fn(
      async (_operation: string, _plan: RepairPlan, current: RepairPlanItem) => {
        if (current.installation.installationId === 'a')
          throw Object.assign(new Error('locked'), { code: 'FILE_LOCKED' })
        if (current.installation.installationId === 'b')
          throw Object.assign(new Error('removed'), { code: 'DEVICE_CHANGED' })
        return { journal: { state: 'cleanup-complete' }, modifiedFiles: [] }
      }
    )
    const result = await new FragmentationBatchService(
      { execute, cancel: vi.fn() } as never,
      async () => 100
    ).execute('operation', plan([item('a', 0), item('b', 1), item('c', 2)]), '/device')
    expect(execute).toHaveBeenCalledTimes(2)
    expect(result.items.map(({ outcome }) => outcome)).toEqual([
      'failed',
      'recovery-pending',
      'skipped'
    ])
  })

  it('cancels the current transaction and marks remaining items cancelled', async () => {
    const transaction = {
      cancel: vi.fn(),
      execute: vi.fn(async () => {
        service.cancel('operation')
        return { journal: { state: 'aborted-unchanged' }, modifiedFiles: [] }
      })
    }
    const service = new FragmentationBatchService(transaction as never, async () => 100)
    const result = await service.execute('operation', plan([item('a', 0), item('b', 1)]), '/device')
    expect(transaction.cancel).toHaveBeenCalledWith('operation')
    expect(result.items.map(({ outcome }) => outcome)).toEqual(['cancelled', 'cancelled'])
  })
})
