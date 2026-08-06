import { mkdir, mkdtemp, rename, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  captureSafeRoot,
  resolveInside
} from '../../electron/services/persistence/safe-path.service'
import { serializeFragmentationRepairError } from '../../electron/ipc/fragmentation-repair.ipc'
import { FragmentationRecoveryService } from '../../electron/services/fragmentation-repair/recovery.service'

describe('fragmentation repair security boundaries', () => {
  it('rejects traversal, symlink escape and remounted root identities', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fragmentation-security-'))
    await mkdir(path.join(root, 'DVD'))
    const safe = await captureSafeRoot(root)
    await expect(resolveInside(safe, '../outside', true)).rejects.toMatchObject({
      code: 'PATH_ESCAPE'
    })
    await symlink(tmpdir(), path.join(root, 'DVD', 'escape'))
    await expect(resolveInside(safe, 'DVD/escape')).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
    await rename(root, `${root}-old`)
    await mkdir(root)
    await expect(resolveInside(safe, '.', false)).rejects.toMatchObject({ code: 'DEVICE_CHANGED' })
  })

  it('does not leak absolute paths, tokens, stacks or arbitrary details in IPC errors', () => {
    const serialized = serializeFragmentationRepairError(
      Object.assign(new Error('/media/private/game.iso token=secret'), {
        code: 'UNEXPECTED_NATIVE_FAILURE',
        details: { path: '/media/private/game.iso' },
        stack: '/private/source.ts:1'
      })
    )
    expect(JSON.stringify(serialized)).not.toMatch(/media\/private|token=|source\.ts|details/)
    expect(serialized).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Fragmentation repair failed unexpectedly',
      retryable: false
    })
  })

  it('refuses cleanup or restore without the exact confirmation before touching journals', async () => {
    const journals = { get: vi.fn(), list: vi.fn() }
    const recovery = new FragmentationRecoveryService(journals as never)
    await expect(
      recovery.resolve({
        journalId: 'journal',
        expectedRevision: 1,
        action: 'clean-verified-residue',
        confirmation: 'wrong' as never
      })
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' })
    expect(journals.get).not.toHaveBeenCalled()
  })
})
