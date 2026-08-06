import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AuditLogService } from '@electron/services/persistence/audit-log.service'
import { DeviceLockService } from '@electron/services/persistence/device-lock.service'
import { JsonStore } from '@electron/services/persistence/json-store.service'
import { captureSafeRoot, resolveInside } from '@electron/services/persistence/safe-path.service'

describe('persistence safety primitives', () => {
  it('writes revisions atomically and rejects stale writes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'store-'))
    const store = new JsonStore(path.join(root, 'state.json'), 1, () => ({ value: 0 }))
    expect((await store.write({ value: 1 }, 0)).revision).toBe(1)
    await expect(store.write({ value: 2 }, 0)).rejects.toMatchObject({ code: 'STALE_REVISION' })
  })

  it('confines paths and redacts sensitive audit fields', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'safe-'))
    await mkdir(path.join(root, 'DVD'))
    const safe = await captureSafeRoot(root)
    await expect(resolveInside(safe, '../outside', true)).rejects.toMatchObject({
      code: 'PATH_ESCAPE'
    })
    const audit = path.join(root, 'audit.jsonl')
    await new AuditLogService(audit).record({ biosPath: '/secret/bios.bin', result: 'ok' })
    expect(await readFile(audit, 'utf8')).toContain('[REDACTED]')
  })

  it('serializes device mutation and rejects stale revisions', async () => {
    const locks = new DeviceLockService()
    await locks.withLock('device', 0, async () => undefined)
    await expect(locks.withLock('device', 0, async () => undefined)).rejects.toMatchObject({
      code: 'STALE_REVISION'
    })
  })
})
