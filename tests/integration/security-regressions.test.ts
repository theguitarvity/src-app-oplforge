import { mkdtemp, mkdir, rename, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { captureSafeRoot, resolveInside } from '@electron/services/persistence/safe-path.service'
import { DeviceLockService } from '@electron/services/persistence/device-lock.service'
import { redact } from '@electron/services/persistence/audit-log.service'
import { parseInput } from '@electron/ipc/schemas'

describe('security regressions', () => {
  it('blocks traversal and symlinks outside the root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'security-'))
    await mkdir(path.join(root, 'DVD'))
    await symlink('/tmp', path.join(root, 'DVD', 'outside'))
    const safe = await captureSafeRoot(root)
    await expect(resolveInside(safe, '../escape', true)).rejects.toMatchObject({
      code: 'PATH_ESCAPE'
    })
    await expect(resolveInside(safe, 'DVD/outside')).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
  })
  it('detects a mount/root swap and stale revisions', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'swap-'))
    const safe = await captureSafeRoot(root)
    await rename(root, `${root}-old`)
    await mkdir(root)
    await expect(resolveInside(safe, '.', false)).rejects.toMatchObject({ code: 'DEVICE_CHANGED' })
    const locks = new DeviceLockService()
    await locks.withLock('d', 0, async () => undefined)
    await expect(locks.withLock('d', 0, async () => undefined)).rejects.toMatchObject({
      code: 'STALE_REVISION'
    })
  })
  it('redacts BIOS, tokens, URLs and internal paths recursively', () =>
    expect(
      redact({
        biosPath: '/bios',
        nested: {
          accessToken: 'token',
          safe: 'ok',
          message: 'https://user:secret@example.test/a?token=x /home/private/file'
        }
      })
    ).toEqual({
      biosPath: '[REDACTED]',
      nested: { accessToken: '[REDACTED]', safe: 'ok', message: '[REDACTED_URL] [REDACTED_PATH]' }
    }))
  it('rejects unsupported URL schemes and embedded credentials', () => {
    const base = { deviceId: 'd1', profileId: 'p1' }
    expect(() =>
      parseInput('downloadEnqueue', {
        ...base,
        source: { kind: 'http', url: 'ftp://example.test/game.iso' }
      })
    ).toThrow()
    expect(() =>
      parseInput('downloadEnqueue', {
        ...base,
        source: { kind: 'http', url: 'https://user:secret@example.test/game.iso' }
      })
    ).toThrow()
  })
})
