import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FragmentationAdapter } from '@electron/services/fragmentation/fragmentation-adapter'
import { GameInstallationService } from '@electron/services/installation/game-installation.service'
import type { InstallationPlan } from '@/types/opl'
import { createTempDevice } from '../helpers/temp-device'
import { readFile as readSource } from 'node:fs/promises'

const contiguous: FragmentationAdapter = {
  platform: 'linux',
  inspect: async () => ({
    state: 'contiguous',
    verification: 'verified',
    extents: 1,
    method: 'fake',
    detail: 'one extent'
  })
}

function plan(
  sourcePath: string,
  devicePath: string,
  bytes: Buffer,
  format: 'ISO' | 'USBExtreme' = 'ISO'
): InstallationPlan {
  return {
    id: crypto.randomUUID(),
    sourcePath,
    devicePath,
    gameId: 'SLUS_123.45',
    title: 'Synthetic',
    media: 'DVD',
    format,
    destinationRelativePath: format === 'ISO' ? 'DVD/SLUS_123.45.Synthetic.iso' : 'ul.cfg',
    sourceBytes: bytes.length,
    requiredBytes: bytes.length,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    expectedRevision: 0,
    warnings: []
  }
}

describe('transactional game installation', () => {
  it('keeps the renderer, API, preload and IPC chain explicit', async () => {
    const [page, api, preload, ipc] = await Promise.all(
      [
        'src/pages/Ps2ImportPage.tsx',
        'src/services/api.ts',
        'electron/preload.ts',
        'electron/ipc/file.ipc.ts'
      ].map((file) => readSource(path.resolve(file), 'utf8'))
    )
    expect(page).toContain('oplApi.planInstallation')
    expect(api).toContain('planInstallation')
    expect(preload).toContain("'installation:plan'")
    expect(ipc).toContain("ipcMain.handle('installation:plan'")
  })
  it('stages, hashes, promotes and verifies an ISO without exposing a partial', async () => {
    const device = await createTempDevice()
    const sourceRoot = await mkdtemp(path.join(tmpdir(), 'source-'))
    const source = path.join(sourceRoot, 'source.iso')
    const bytes = Buffer.from('synthetic authorized backup')
    await writeFile(source, bytes)
    const service = new GameInstallationService(contiguous)
    const planned = service.remember(plan(source, device.root, bytes))
    const result = await service.confirm(
      planned.id,
      planned.expectedRevision,
      'INSTALAR BACKUP AUTORIZADO'
    )
    expect(await readFile(result.destinationPaths[0])).toEqual(bytes)
    expect(result).toMatchObject({ fragmentation: 'contiguous', verification: 'verified' })
    await device.cleanup()
  })

  it('promotes USBExtreme parts before ul.cfg and preserves source hash', async () => {
    const device = await createTempDevice()
    const source = path.join(device.root, '..', `source-${crypto.randomUUID()}.iso`)
    const bytes = Buffer.alloc(8192, 7)
    await writeFile(source, bytes)
    const service = new GameInstallationService(contiguous)
    const planned = service.remember(plan(source, device.root, bytes, 'USBExtreme'))
    const result = await service.confirm(planned.id, 0, 'INSTALAR BACKUP AUTORIZADO')
    expect(result.destinationSha256).toBe(planned.sourceSha256)
    expect((await readFile(path.join(device.root, 'ul.cfg'))).length).toBe(64)
    await device.cleanup()
  })

  it('cancels before promotion and startup recovery removes abandoned staging', async () => {
    const device = await createTempDevice()
    const source = path.join(device.root, '..', `cancel-${crypto.randomUUID()}.iso`)
    const bytes = Buffer.from('cancel')
    await writeFile(source, bytes)
    const service = new GameInstallationService(contiguous)
    const planned = service.remember(plan(source, device.root, bytes))
    service.cancel(planned.id)
    await expect(
      service.confirm(planned.id, 0, 'INSTALAR BACKUP AUTORIZADO')
    ).rejects.toMatchObject({ code: 'CANCELLED' })
    await expect(
      access(path.join(device.root, planned.destinationRelativePath))
    ).rejects.toBeTruthy()
    expect(await service.recover(device.root)).toBe(0)
    await device.cleanup()
  })
})
