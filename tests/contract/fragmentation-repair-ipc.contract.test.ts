import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { schemas } from '../../electron/ipc/schemas'
import {
  FRAGMENTATION_REPAIR_CHANNELS,
  registerFragmentationRepairIpc,
  serializeFragmentationRepairError
} from '../../electron/ipc/fragmentation-repair.ipc'

describe('fragmentation repair base IPC contract', () => {
  it('declares stable, dedicated channel names', () => {
    expect(FRAGMENTATION_REPAIR_CHANNELS).toEqual({
      inventory: 'fragmentation-repair:inventory',
      diagnose: 'fragmentation-repair:diagnose',
      getCurrentDiagnosis: 'fragmentation-repair:get-current-diagnosis',
      cancelDiagnosis: 'fragmentation-repair:cancel-diagnosis',
      plan: 'fragmentation-repair:plan',
      confirm: 'fragmentation-repair:confirm',
      cancel: 'fragmentation-repair:cancel',
      getOperation: 'fragmentation-repair:get-operation',
      getReport: 'fragmentation-repair:get-report',
      getReportByOperation: 'fragmentation-repair:get-report-by-operation',
      listRecovery: 'fragmentation-repair:list-recovery',
      resolveRecovery: 'fragmentation-repair:resolve-recovery',
      event: 'fragmentation-repair:event'
    })
  })

  it('registers only the implemented read-only diagnosis handlers', () => {
    const ipcMain = { handle: vi.fn() }
    registerFragmentationRepairIpc(ipcMain as never, { diagnostic: {} } as never, vi.fn())
    expect(ipcMain.handle.mock.calls.map(([channel]) => channel)).toEqual([
      'fragmentation-repair:inventory',
      'fragmentation-repair:diagnose',
      'fragmentation-repair:get-current-diagnosis',
      'fragmentation-repair:cancel-diagnosis',
      'fragmentation-repair:plan',
      'fragmentation-repair:confirm',
      'fragmentation-repair:cancel',
      'fragmentation-repair:get-operation',
      'fragmentation-repair:get-report',
      'fragmentation-repair:get-report-by-operation',
      'fragmentation-repair:list-recovery',
      'fragmentation-repair:resolve-recovery'
    ])
  })

  it('requires exact confirmation literals and strict requests', () => {
    expect(
      schemas.fragmentationConfirm.safeParse({
        planId: 'plan-1',
        expectedRevision: 0,
        confirmation: 'CORRIGIR FRAGMENTAÇÃO'
      }).success
    ).toBe(true)
    expect(
      schemas.fragmentationConfirm.safeParse({
        planId: 'plan-1',
        expectedRevision: 0,
        confirmation: 'corrigir fragmentação'
      }).success
    ).toBe(false)
    expect(
      schemas.fragmentationResolveRecovery.safeParse({
        journalId: 'journal-1',
        expectedRevision: 0,
        action: 'restore-original',
        confirmation: 'RECUPERAR JOGO',
        extra: true
      }).success
    ).toBe(false)
  })

  it('serializes controlled errors without leaking unknown details', () => {
    expect(
      serializeFragmentationRepairError(
        Object.assign(new Error('Device moved'), {
          code: 'DEVICE_CHANGED',
          details: { path: '/secret/game.iso' }
        })
      )
    ).toEqual({ code: 'DEVICE_CHANGED', message: 'Device moved', retryable: true })

    expect(
      serializeFragmentationRepairError(
        Object.assign(new Error('/secret/game.iso token=abc'), {
          code: 'SOMETHING_PRIVATE',
          stack: 'private stack'
        })
      )
    ).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Fragmentation repair failed unexpectedly',
      retryable: false
    })
  })

  it('routes plan, confirmation, cancellation and report queries through typed services', async () => {
    const handlers = new Map<string, (_event: unknown, input: unknown) => unknown>()
    const runtime = {
      diagnostic: {
        diagnose: vi.fn(),
        cancel: vi.fn(),
        getCurrent: vi.fn(async () => ({ diagnosticId: 'diagnostic-1', status: 'running' }))
      },
      plan: { create: vi.fn(async () => ({ planId: 'plan-1' })) },
      repair: {
        confirm: vi.fn(async () => ({ operationId: 'operation-1' })),
        cancel: vi.fn(),
        getOperation: vi.fn(async () => ({ operationId: 'operation-1' })),
        getReport: vi.fn(async () => ({ reportId: 'report-1' })),
        getReportByOperation: vi.fn(async () => ({ reportId: 'report-1' }))
      },
      recovery: {
        reconcile: vi.fn(async () => [{ journalId: 'journal-1', revision: 3 }]),
        resolve: vi.fn(async () => ({ journalId: 'journal-1', revision: 4, state: 'restored' }))
      }
    }
    registerFragmentationRepairIpc(
      {
        handle: (channel: string, handler: never) => {
          handlers.set(channel, handler)
        }
      } as never,
      runtime as never,
      vi.fn()
    )
    await expect(
      handlers.get('fragmentation-repair:get-current-diagnosis')?.({}, { devicePath: '/media/opl' })
    ).resolves.toMatchObject({ diagnosticId: 'diagnostic-1', status: 'running' })
    await expect(
      handlers.get('fragmentation-repair:plan')?.(
        {},
        {
          diagnosticId: 'diagnostic-1',
          expectedRevision: 1,
          mode: 'single',
          installationIds: ['installation-1']
        }
      )
    ).resolves.toMatchObject({ planId: 'plan-1' })
    await expect(
      handlers.get('fragmentation-repair:confirm')?.(
        {},
        { planId: 'plan-1', expectedRevision: 0, confirmation: 'CORRIGIR FRAGMENTAÇÃO' }
      )
    ).resolves.toMatchObject({ operationId: 'operation-1' })
    await handlers.get('fragmentation-repair:cancel')?.({}, { operationId: 'operation-1' })
    await expect(
      handlers.get('fragmentation-repair:get-report')?.({}, { reportId: 'report-1' })
    ).resolves.toMatchObject({ reportId: 'report-1' })
    expect(runtime.repair.cancel).toHaveBeenCalledWith('operation-1')
    await expect(handlers.get('fragmentation-repair:list-recovery')?.({}, {})).resolves.toEqual([
      { journalId: 'journal-1', revision: 3 }
    ])
    await expect(
      handlers.get('fragmentation-repair:resolve-recovery')?.(
        {},
        {
          journalId: 'journal-1',
          expectedRevision: 3,
          action: 'restore-original',
          confirmation: 'RECUPERAR JOGO'
        }
      )
    ).resolves.toMatchObject({ revision: 4, state: 'restored' })
    await expect(
      handlers.get('fragmentation-repair:resolve-recovery')?.(
        {},
        {
          journalId: 'journal-1',
          expectedRevision: 3,
          action: 'restore-original',
          confirmation: 'recuperar'
        }
      )
    ).rejects.toMatchObject({ code: 'INTERNAL_ERROR' })
  })

  it('exposes named methods and exact-listener unsubscribe without generic IPC or filesystem', async () => {
    const preload = await readFile(new URL('../../electron/preload.ts', import.meta.url), 'utf8')
    expect(preload).toContain("ipcRenderer.invoke('fragmentation-repair:diagnose'")
    expect(preload).toContain("ipcRenderer.on('fragmentation-repair:event', listener)")
    expect(preload).toContain("ipcRenderer.removeListener('fragmentation-repair:event', listener)")
    expect(preload).not.toMatch(/send\s*:\s*ipcRenderer\.send/)
    expect(preload).not.toMatch(/invoke\s*:\s*ipcRenderer\.invoke/)
    expect(preload).not.toMatch(/(?:readFile|writeFile|node:fs)\s*:/)
  })
})
