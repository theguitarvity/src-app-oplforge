import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ReorganizationInventoryService } from '@electron/services/installation/reorganization-inventory.service'
import { ReorganizationService } from '@electron/services/installation/reorganization.service'
import { createTempDevice } from '../helpers/temp-device'

describe('safe device reorganization', () => {
  it('backs up, verifies, rewrites ISO/UL sequentially and rechecks fragmentation', async () => {
    const device = await createTempDevice()
    const game = path.join(device.root, 'DVD', 'game.iso')
    await writeFile(game, 'authorized synthetic')
    await writeFile(path.join(device.root, 'ul.cfg'), 'synthetic cfg')
    await writeFile(path.join(device.root, 'ul.12345678.SLUS_123.45.00'), 'part')
    const backup = await mkdtemp(path.join(tmpdir(), 'external-'))
    const adapter = {
      platform: 'linux' as const,
      inspect: async () => ({
        state: 'contiguous' as const,
        verification: 'verified' as const,
        method: 'fake',
        detail: 'one'
      })
    }
    const service = new ReorganizationService(
      new ReorganizationInventoryService(),
      adapter,
      async () => true
    )
    const plan = await service.plan('d', device.root, backup)
    await expect(service.confirm(plan.id, plan.expectedRevision, 'wrong')).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED'
    })
    const result = await service.confirm(
      plan.id,
      plan.expectedRevision,
      'REORGANIZAR COM BACKUP VERIFICADO'
    )
    expect(result.fragmentation).toBe('contiguous')
    expect(result.restoredFiles).toBe(3)
    expect(await readFile(game, 'utf8')).toBe('authorized synthetic')
    expect(await readFile(path.join(device.root, 'ul.cfg'), 'utf8')).toBe('synthetic cfg')
    await device.cleanup()
  })
  it('keeps a verified backup and restores files after a post-backup failure', async () => {
    const device = await createTempDevice()
    const game = path.join(device.root, 'DVD', 'game.iso')
    await writeFile(game, 'recoverable')
    const backup = await mkdtemp(path.join(tmpdir(), 'external-'))
    let calls = 0
    const adapter = {
      platform: 'linux' as const,
      inspect: async () => {
        calls++
        throw new Error('extent failure')
      }
    }
    const service = new ReorganizationService(
      new ReorganizationInventoryService(),
      adapter,
      async () => true
    )
    const plan = await service.plan('d2', device.root, backup)
    await expect(
      service.confirm(plan.id, plan.expectedRevision, 'REORGANIZAR COM BACKUP VERIFICADO')
    ).rejects.toThrow('extent failure')
    expect(calls).toBe(1)
    expect(await readFile(game, 'utf8')).toBe('recoverable')
    expect(await readFile(path.join(plan.backupRoot, 'files', 'DVD', 'game.iso'), 'utf8')).toBe(
      'recoverable'
    )
    await device.cleanup()
  })
})
