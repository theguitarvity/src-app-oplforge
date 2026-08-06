import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemas } from '@electron/ipc/schemas'

describe('report IPC contract', () => {
  it('validates generation, export and revisioned hardware smoke', () => {
    expect(
      schemas.reportGenerate.safeParse({ deviceId: 'd', snapshotId: 's', profileId: 'p' }).success
    ).toBe(true)
    expect(
      schemas.hardwareSmoke.safeParse({
        reportId: 'r',
        expectedRevision: 0,
        consoleModel: '',
        adapter: 'usb',
        oplVersion: '1',
        detected: true,
        artDisplayed: true,
        noFragmentationError: true,
        milestoneReached: true
      }).success
    ).toBe(false)
  })
  it('exposes named report channels', async () => {
    const source = await readFile(path.resolve('electron/preload.ts'), 'utf8')
    for (const channel of ['reports:generate', 'reports:get', 'reports:record-hardware-smoke'])
      expect(source).toContain(channel)
  })
})
