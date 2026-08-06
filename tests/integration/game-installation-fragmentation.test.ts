import { createHash, randomUUID } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { FragmentationAdapter } from '@electron/services/fragmentation/fragmentation-adapter'
import { GameInstallationService } from '@electron/services/installation/game-installation.service'
import type { InstallationPlan } from '@/types/opl'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

async function setup(replaces = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opl-install-fragmentation-'))
  roots.push(root)
  const device = path.join(root, 'device')
  const source = path.join(root, 'source.iso')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path.join(device, 'DVD'), { recursive: true })
  const bytes = Buffer.from('new validated authorized backup')
  await writeFile(source, bytes)
  const destinationRelativePath = 'DVD/SLUS_123.45.Game.iso'
  if (replaces) await writeFile(path.join(device, destinationRelativePath), 'previous valid game')
  const plan: InstallationPlan = {
    id: randomUUID(),
    sourcePath: source,
    devicePath: device,
    gameId: 'SLUS_123.45',
    title: 'Game',
    media: 'DVD',
    format: 'ISO',
    destinationRelativePath,
    sourceBytes: bytes.length,
    requiredBytes: bytes.length,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    expectedRevision: 0,
    replaces: replaces ? destinationRelativePath : undefined,
    warnings: []
  }
  return { device, plan, destination: path.join(device, destinationRelativePath) }
}

describe('fragmentation-safe installation', () => {
  it('does not promote a candidate proven fragmented', async () => {
    const { plan, destination } = await setup()
    const fragmented: FragmentationAdapter = {
      platform: 'linux',
      inspect: async () => ({
        state: 'fragmented',
        verification: 'verified',
        extents: 4,
        method: 'fake',
        detail: 'four extents'
      })
    }
    const service = new GameInstallationService(fragmented)
    service.remember(plan)
    await expect(service.confirm(plan.id, 0, 'INSTALAR BACKUP AUTORIZADO')).rejects.toMatchObject({
      code: 'STILL_FRAGMENTED'
    })
    await expect(access(destination)).rejects.toBeTruthy()
  })

  it('rolls back the active destination if post-promotion verification reports fragmentation', async () => {
    const { plan, destination } = await setup(true)
    let inspections = 0
    const adapter: FragmentationAdapter = {
      platform: 'linux',
      inspect: async () => ({
        state: ++inspections === 1 ? 'contiguous' : 'fragmented',
        verification: 'verified',
        extents: inspections,
        method: 'fake',
        detail: 'fault injection'
      })
    }
    const service = new GameInstallationService(adapter)
    service.remember(plan)
    await expect(service.confirm(plan.id, 0, 'SUBSTITUIR BACKUP AUTORIZADO')).rejects.toMatchObject(
      { code: 'STILL_FRAGMENTED' }
    )
    expect(await readFile(destination, 'utf8')).toBe('previous valid game')
  })

  it('reports not-verified explicitly when the platform cannot prove contiguity', async () => {
    const { plan } = await setup()
    const unknown: FragmentationAdapter = {
      platform: 'linux',
      inspect: async () => ({
        state: 'unknown',
        verification: 'not-verified',
        method: 'fake',
        detail: 'unsupported'
      })
    }
    const service = new GameInstallationService(unknown)
    service.remember(plan)
    await expect(service.confirm(plan.id, 0, 'INSTALAR BACKUP AUTORIZADO')).resolves.toMatchObject({
      fragmentation: 'unknown',
      verification: 'not-verified'
    })
  })
})
