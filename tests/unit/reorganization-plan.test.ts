import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ReorganizationInventoryService } from '@electron/services/installation/reorganization-inventory.service'
import { ReorganizationService } from '@electron/services/installation/reorganization.service'
import { createTempDevice } from '../helpers/temp-device'

const adapter = {
  platform: 'linux' as const,
  inspect: async () => ({
    state: 'contiguous' as const,
    verification: 'verified' as const,
    method: 'fake',
    detail: 'one'
  })
}
describe('reorganization plan', () => {
  it('inventories games, art, cfg, vmc and apps and computes external backup space', async () => {
    const device = await createTempDevice()
    for (const [directory, file] of [
      ['DVD', 'game.iso'],
      ['ART', 'cover.png'],
      ['CFG', 'game.cfg'],
      ['VMC', 'card.bin'],
      ['APPS', 'app.elf']
    ])
      await writeFile(path.join(device.root, directory, file), directory)
    const backup = await mkdtemp(path.join(tmpdir(), 'backup-'))
    const service = new ReorganizationService(
      new ReorganizationInventoryService(),
      adapter,
      async () => true
    )
    const plan = await service.plan('d', device.root, backup)
    expect(plan.inventory).toHaveLength(5)
    expect(plan.requiredBytes).toBeGreaterThan(0)
    await device.cleanup()
  })
  it('rejects backup on the selected device/filesystem', async () => {
    const device = await createTempDevice()
    const service = new ReorganizationService(
      new ReorganizationInventoryService(),
      adapter,
      async () => false
    )
    await expect(service.plan('d', device.root, device.root)).rejects.toMatchObject({
      code: 'BACKUP_NOT_EXTERNAL'
    })
    await device.cleanup()
  })
})
