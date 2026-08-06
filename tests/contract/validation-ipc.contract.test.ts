import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemas } from '@electron/ipc/schemas'

describe('validation IPC', () => {
  it('validates plan and all checkpoint states', () => {
    expect(
      schemas.validationPlan.safeParse({
        deviceId: 'd',
        snapshotId: 's',
        itemId: 'i',
        profileId: 'p',
        pcsx2Path: '/pcsx2',
        biosPath: '/bios',
        memoryCardPath: '/card',
        bootMode: 'memory-card'
      }).success
    ).toBe(true)
    expect(
      schemas.checkpoint.safeParse({ operationId: 'r', stage: 10, result: 'passed' }).success
    ).toBe(false)
  })
  it('exposes only named plan/start/checkpoint/stop channels', async () => {
    const source = await readFile(path.resolve('electron/preload.ts'), 'utf8')
    for (const channel of [
      'validation:plan',
      'validation:start',
      'validation:checkpoint',
      'validation:stop'
    ])
      expect(source).toContain(channel)
  })
})
