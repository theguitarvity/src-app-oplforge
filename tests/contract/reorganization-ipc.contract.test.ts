import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemas } from '@electron/ipc/schemas'

describe('reorganization IPC', () => {
  it('requires absolute targets, revision and explicit confirmation', () => {
    expect(
      schemas.reorganizationPlan.safeParse({
        deviceId: 'd',
        devicePath: '/device',
        backupPath: '/backup'
      }).success
    ).toBe(true)
    expect(
      schemas.operationConfirm.safeParse({
        operationId: 'x',
        expectedRevision: -1,
        confirmation: 'x'
      }).success
    ).toBe(false)
  })
  it('exposes named plan/confirm/cancel channels', async () => {
    const preload = await readFile(path.resolve('electron/preload.ts'), 'utf8')
    for (const channel of [
      'reorganization:plan',
      'reorganization:confirm',
      'reorganization:cancel'
    ])
      expect(preload).toContain(channel)
  })
})
