import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseInput } from '@electron/ipc/schemas'

describe('OPL finalization IPC security contract', () => {
  it('validates enqueue, list and get download contracts', () => {
    expect(parseInput('downloadList', { phases: ['queued', 'failed'], limit: 500 })).toEqual({
      phases: ['queued', 'failed'],
      limit: 500
    })
    expect(parseInput('downloadGet', { taskId: 'task-1' })).toEqual({ taskId: 'task-1' })
    expect(() => parseInput('downloadList', { phases: ['unknown'] })).toThrow()
    expect(() => parseInput('downloadList', { limit: 501 })).toThrow()
  })

  it('validates revisioned finalization plan, confirm and cancel contracts', () => {
    expect(parseInput('finalizationGetPlan', { planId: 'plan-1' })).toEqual({ planId: 'plan-1' })
    expect(
      parseInput('finalizationConfirm', {
        planId: 'plan-1',
        expectedRevision: 2,
        collisionResolution: 'keep-existing',
        confirmation: 'FINALIZAR BACKUP PARA OPL'
      })
    ).toMatchObject({ planId: 'plan-1', expectedRevision: 2 })
    expect(parseInput('finalizationCancel', { taskId: 'task-1', expectedRevision: 3 })).toEqual({
      taskId: 'task-1',
      expectedRevision: 3
    })
  })

  it('validates Game ID override and collision confirmation literally', () => {
    expect(
      parseInput('finalizationSetGameId', {
        planId: 'plan-1',
        expectedRevision: 4,
        gameId: 'SLUS_123.45',
        confirmation: 'USAR GAME ID INFORMADO'
      })
    ).toMatchObject({ gameId: 'SLUS_123.45' })
    expect(() =>
      parseInput('finalizationSetGameId', {
        planId: 'plan-1',
        expectedRevision: 4,
        gameId: 'bad-id',
        confirmation: 'USAR GAME ID INFORMADO'
      })
    ).toThrow()
    expect(() =>
      parseInput('finalizationConfirm', {
        planId: 'plan-1',
        expectedRevision: 4,
        collisionResolution: 'replace-authorized',
        confirmation: 'SUBSTITUIR'
      })
    ).toThrow()
  })

  it('uses strict inputs and rejects renderer-provided internal paths', () => {
    const valid = {
      source: { kind: 'http' as const, url: 'https://downloads.example.test/game.iso' },
      deviceId: 'device-1',
      profileId: 'opl-1'
    }
    expect(parseInput('downloadEnqueue', valid)).toEqual(valid)
    expect(() =>
      parseInput('downloadEnqueue', { ...valid, cachePath: '/tmp/payload.part' })
    ).toThrow()
    expect(() =>
      parseInput('downloadEnqueue', {
        ...valid,
        source: { ...valid.source, stagingPath: '/media/usb/staging' }
      })
    ).toThrow()
  })

  it('requires exact confirmation literals and non-stale revisions', () => {
    expect(() =>
      parseInput('finalizationConfirm', {
        planId: 'plan-1',
        expectedRevision: -1,
        confirmation: 'FINALIZAR BACKUP PARA OPL'
      })
    ).toThrow()
    expect(() =>
      parseInput('finalizationConfirm', {
        planId: 'plan-1',
        expectedRevision: 0,
        confirmation: 'finalizar'
      })
    ).toThrow()
  })

  it('validates revisioned pause, resume, cancel and retry controls', () => {
    for (const schema of ['downloadPause', 'downloadResume', 'downloadRetry'] as const)
      expect(parseInput(schema, { taskId: 'task-1', expectedRevision: 2 })).toMatchObject({
        taskId: 'task-1'
      })
    expect(
      parseInput('downloadCancel', {
        taskId: 'task-1',
        expectedRevision: 2,
        partialPolicy: 'keep-for-resume'
      })
    ).toMatchObject({ partialPolicy: 'keep-for-resume' })
    expect(() =>
      parseInput('downloadCancel', {
        taskId: 'task-1',
        expectedRevision: 2,
        partialPolicy: 'discard'
      })
    ).toThrow()
    expect(parseInput('downloadRetryFailed', { expectedQueueRevision: 4 })).toEqual({
      expectedQueueRevision: 4
    })
    expect(parseInput('downloadClearTerminal', { expectedQueueRevision: 4 })).toEqual({
      expectedQueueRevision: 4
    })
  })

  it('validates paginated art index and durable art job controls', () => {
    expect(
      parseInput('artIndexQuery', { gameIds: ['SLUS_123.45'], types: ['COV', 'BG'], limit: 500 })
    ).toMatchObject({ types: ['COV', 'BG'] })
    expect(() => parseInput('artIndexQuery', { types: ['COV', 'COV'] })).toThrow()
    expect(
      parseInput('artSyncPlanV2', {
        deviceId: 'd1',
        catalogSnapshotId: 's1',
        scope: 'single',
        gameIds: ['SLUS_123.45'],
        types: ['COV'],
        replacePolicy: 'missing-only'
      })
    ).toMatchObject({ scope: 'single' })
    for (const schema of [
      'artSyncPause',
      'artSyncResume',
      'artSyncCancel',
      'artSyncRetryFailed'
    ] as const)
      expect(parseInput(schema, { jobId: 'j1', expectedRevision: 2 })).toMatchObject({
        jobId: 'j1'
      })
  })

  it('validates naming audit, plan, confirmation and operation lookup', () => {
    expect(parseInput('namingAudit', { deviceId: 'd1', profileId: 'p1' })).toEqual({
      deviceId: 'd1',
      profileId: 'p1'
    })
    expect(
      parseInput('namingPlan', { auditId: 'a1', expectedRevision: 0, itemIds: ['i1'] })
    ).toMatchObject({ itemIds: ['i1'] })
    expect(
      parseInput('namingConfirm', {
        planId: 'p1',
        expectedRevision: 0,
        confirmation: 'ADEQUAR NOMES OPL'
      })
    ).toMatchObject({ planId: 'p1' })
    expect(() =>
      parseInput('namingConfirm', { planId: 'p1', expectedRevision: 0, confirmation: 'RENOMEAR' })
    ).toThrow()
    expect(parseInput('namingGetOperation', { operationId: 'o1' })).toEqual({ operationId: 'o1' })
  })

  it('keeps the preload bridge named and does not expose ipcRenderer or filesystem primitives', async () => {
    const preload = await readFile(path.join(process.cwd(), 'electron', 'preload.ts'), 'utf8')
    expect(preload).toContain("contextBridge.exposeInMainWorld('oplApi', api)")
    expect(preload).not.toMatch(/exposeInMainWorld\([^\n]+ipcRenderer/)
    expect(preload).not.toMatch(/from ['"]node:(?:fs|path|child_process)['"]/)
    expect(preload).toContain("ipcRenderer.on('opl-pipeline:event'")
    expect(preload).toContain("ipcRenderer.removeListener('opl-pipeline:event'")
  })
})
