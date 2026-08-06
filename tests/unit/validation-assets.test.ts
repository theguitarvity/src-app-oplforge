import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ValidationAssetsService } from '@electron/services/pcsx2/validation-assets.service'
import { UsbImageService } from '@electron/services/pcsx2/usb-image.service'
import { createTempDevice } from '../helpers/temp-device'

describe('validation assets', () => {
  it('identifies BIOS by hash/region without exposing bytes and clones a memory card', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'assets-'))
    const bios = path.join(root, 'bios.bin')
    const card = path.join(root, 'card.ps2')
    await writeFile(bios, Buffer.concat([Buffer.from('America USA'), Buffer.alloc(512 * 1024)]))
    await writeFile(card, 'memory-card')
    const service = new ValidationAssetsService()
    const identity = await service.identifyBios(bios)
    expect(identity.region).toBe('USA')
    expect(identity).not.toHaveProperty('path')
    const clone = await service.cloneMemoryCard(card, path.join(root, 'isolated'))
    expect(await readFile(clone.path, 'utf8')).toBe('memory-card')
  })
  it('builds a minimal image from one catalog item without mutating the device', async () => {
    const device = await createTempDevice()
    const game = path.join(device.root, 'DVD', 'game.iso')
    await writeFile(game, 'game')
    const before = await readFile(game)
    const workspace = await mkdtemp(path.join(tmpdir(), 'usb-image-'))
    const service = new UsbImageService(async (command, args) => {
      if (command === 'mkfs.fat') await writeFile(args[4], Buffer.alloc(4096))
    })
    const item = {
      itemId: 'i',
      kind: 'game',
      mediaType: 'DVD',
      installFormat: 'ISO',
      files: [{ relativePath: 'DVD/game.iso' }]
    }
    const result = await service.build(device.root, item as never, workspace)
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await readFile(game)).toEqual(before)
    await device.cleanup()
  })
})
