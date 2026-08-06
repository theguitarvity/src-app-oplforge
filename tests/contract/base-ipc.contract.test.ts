import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemas } from '@electron/ipc/schemas'

describe('privileged IPC contract', () => {
  it('rejects traversal-like relative device paths and latest OPL aliases', () => {
    expect(schemas.devicePath.safeParse({ devicePath: '../usb' }).success).toBe(false)
    expect(
      schemas.oplProfile.safeParse({
        id: 'x',
        version: 'latest',
        variant: 'release',
        officialUrl: 'https://example.com/opl',
        elfSha256: 'a'.repeat(64),
        obtainedAt: new Date().toISOString(),
        capabilities: { iso: true, zso: true, usbExtreme: true, fileSystems: [] }
      }).success
    ).toBe(false)
  })

  it('exposes explicit channels and no generic filesystem or process bridge', async () => {
    const source = await readFile(path.resolve('electron/preload.ts'), 'utf8')
    expect(source).toContain("ipcRenderer.invoke('opl:profiles:list')")
    expect(source).not.toMatch(
      /(?:\b(?:readFile|writeFile|exec|spawn)\s*\(|ipcRenderer\.invoke\(\s*channel)/
    )
    expect(source).not.toContain('ipcRenderer.send(')
  })

  it('requires controlled confirmation tokens and revisions', () => {
    expect(
      schemas.operationConfirm.safeParse({
        operationId: 'one',
        expectedRevision: 0,
        confirmation: ''
      }).success
    ).toBe(false)
    expect(
      schemas.oplUpdateConfirm.safeParse({
        planId: 'one',
        confirmation: 'ATUALIZAR OPL',
        patchedImagePath: '/tmp/card.ps2'
      }).success
    ).toBe(true)
  })
})
