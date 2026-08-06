import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { DeviceCapability } from '../../src/types/opl'
import { createTempDevice, type TempDevice } from '../helpers/temp-device'
import { encodeUlCfg } from '../../electron/services/usbextreme/ul-cfg.service'
import { FragmentationDiagnosticService } from '../../electron/services/fragmentation-repair/diagnostic.service'
import { createFragmentationRepairStores } from '../../electron/services/fragmentation-repair/store'

const devices: TempDevice[] = []
afterEach(async () => {
  await Promise.all(devices.splice(0).map((device) => device.cleanup()))
})

describe('fragmentation diagnosis integration', () => {
  it('discovers ISO, ZSO and USBExtreme without changing any device byte or mtime', async () => {
    const device = await createTempDevice()
    devices.push(device)
    await writeFile(
      path.join(device.root, 'DVD', 'SLUS_123.45.fragmented.iso'),
      syntheticIso('SLUS_123.45')
    )
    await writeFile(path.join(device.root, 'CD', 'SLUS_123.45.contiguous.zso'), syntheticZso())
    await writeFile(path.join(device.root, 'CFG', 'SLUS_123.45.cfg'), 'auxiliary')
    await writeFile(
      path.join(device.root, 'ul.cfg'),
      encodeUlCfg([
        {
          title: 'Multipart',
          gameId: 'SCES_111.22',
          media: 'DVD',
          parts: 2,
          unknown: Buffer.alloc(15)
        }
      ])
    )
    await writeFile(path.join(device.root, 'ul.a.SCES_111.22.00'), 'part-zero')
    await writeFile(path.join(device.root, 'ul.a.SCES_111.22.01'), 'part-one')
    const before = await snapshot(device.root)
    const service = await createService(device.root, async (filePath) => ({
      state:
        path.basename(filePath).includes('fragmented') || filePath.endsWith('.01')
          ? ('fragmented' as const)
          : ('contiguous' as const),
      verification: 'verified' as const,
      extents: filePath.endsWith('.01') ? 2 : 1,
      method: 'fake',
      detail: 'fixture'
    }))
    const events: number[] = []
    const diagnostic = await service.diagnose({ devicePath: device.root }, (event) =>
      events.push(event.sequence)
    )

    expect(diagnostic.status).toBe('complete')
    expect(diagnostic.installations.map(({ identity }) => identity.format)).toEqual(
      expect.arrayContaining(['ISO', 'ZSO', 'USBExtreme'])
    )
    expect(
      diagnostic.installations.find(({ identity }) => identity.format === 'USBExtreme')?.state
    ).toBe('partially-fragmented')
    expect(
      diagnostic.installations
        .filter(({ identity }) => identity.gameId === 'SLUS_123.45')
        .every(({ findings }) => findings.some(({ code }) => code === 'DUPLICATE_GAME_ID'))
    ).toBe(true)
    expect(
      diagnostic.installations.some(({ files }) => files.some(({ role }) => role === 'auxiliary'))
    ).toBe(true)
    expect(events).toEqual([...events].sort((a, b) => a - b))
    expect(await snapshot(device.root)).toEqual(before)
  })

  it('handles 500 images with an immediate initial progress event and reconciled summary', async () => {
    const device = await createTempDevice()
    devices.push(device)
    await Promise.all(
      Array.from({ length: 500 }, (_, index) =>
        writeFile(
          path.join(device.root, 'DVD', `${String(index).padStart(3, '0')}.iso`),
          syntheticIso()
        )
      )
    )
    const service = await createService(device.root, async () => ({
      state: 'contiguous' as const,
      verification: 'verified' as const,
      extents: 1,
      method: 'fake',
      detail: 'fixture'
    }))
    const events: Array<{ progress?: number }> = []
    const result = await service.diagnose({ devicePath: device.root }, (event) =>
      events.push(event)
    )
    expect(events[0]?.progress).toBe(0)
    expect(result.summary.total).toBe(500)
    expect(result.summary.byState.contiguous).toBe(500)
    expect(result.summary.total).toBe(
      Object.values(result.summary.byState).reduce((sum, count) => sum + count, 0)
    )
  }, 20_000)

  it('publishes initial progress before a slow probe and bounds concurrent extent work', async () => {
    const device = await createTempDevice()
    devices.push(device)
    await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        writeFile(path.join(device.root, 'DVD', `${index}.iso`), syntheticIso())
      )
    )
    const storeRoot = await mkdtemp(path.join(tmpdir(), 'fragmentation-store-'))
    const stores = createFragmentationRepairStores(storeRoot)
    let active = 0
    let peak = 0
    const adapter = {
      platform: 'linux' as const,
      inspect: async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 20))
        active--
        return {
          state: 'contiguous' as const,
          verification: 'verified' as const,
          extents: 1,
          method: 'fake',
          detail: 'fixture'
        }
      }
    }
    const capability: DeviceCapability = {
      deviceId: randomUUID(),
      mountPath: device.root,
      realPath: device.root,
      fileSystem: 'exfat',
      totalBytes: 1e9,
      freeBytes: 1e8,
      extentVerification: 'supported',
      method: 'fake',
      homologated: true,
      limitations: [],
      observedAt: new Date().toISOString()
    }
    const service = new FragmentationDiagnosticService({
      adapter,
      diagnostics: stores.diagnostics,
      probe: {
        probe: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
          return capability
        }
      }
    })
    const started = Date.now()
    let initialAt = Infinity
    const result = await service.diagnose({ devicePath: device.root }, (event) => {
      if (event.sequence === 1) initialAt = Date.now()
    })
    expect(initialAt - started).toBeLessThan(2_000)
    expect(result.summary.total).toBe(24)
    expect(peak).toBeGreaterThan(1)
    expect(peak).toBeLessThanOrEqual(8)
  })

  it('keeps one queryable diagnosis running when the renderer stops observing it', async () => {
    const device = await createTempDevice()
    devices.push(device)
    await writeFile(path.join(device.root, 'DVD', 'SLUS_123.45.iso'), syntheticIso('SLUS_123.45'))
    let releaseInspection: () => void = () => undefined
    const inspectionBlocked = new Promise<void>((resolve) => {
      releaseInspection = resolve
    })
    let inspectionStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      inspectionStarted = resolve
    })
    const service = await createService(device.root, async () => {
      inspectionStarted()
      await inspectionBlocked
      return {
        state: 'contiguous' as const,
        verification: 'verified' as const,
        extents: 1,
        method: 'fake',
        detail: 'fixture'
      }
    })

    const running = service.diagnose({ devicePath: device.root })
    await started
    const activity = await service.getCurrent(device.root)
    expect(activity).toMatchObject({
      status: 'running',
      processedItems: 0,
      totalItems: 1,
      currentItem: 'DVD/SLUS_123.45.iso'
    })
    expect(service.diagnose({ devicePath: device.root })).toBe(running)

    releaseInspection()
    const result = await running
    expect(await service.getCurrent(device.root)).toMatchObject({
      diagnosticId: result.diagnosticId,
      status: 'complete',
      processedItems: 1,
      totalItems: 1,
      progress: 1,
      diagnostic: { diagnosticId: result.diagnosticId }
    })
  })
})

async function createService(
  root: string,
  inspect: (
    filePath: string
  ) => Promise<{
    state: 'contiguous' | 'fragmented'
    verification: 'verified'
    extents: number
    method: string
    detail: string
  }>
) {
  const storeRoot = await mkdtemp(path.join(tmpdir(), 'fragmentation-store-'))
  const stores = createFragmentationRepairStores(storeRoot)
  const capability: DeviceCapability = {
    deviceId: randomUUID(),
    mountPath: root,
    realPath: root,
    fileSystem: 'exfat',
    totalBytes: 10_000_000,
    freeBytes: 5_000_000,
    extentVerification: 'supported',
    method: 'fake',
    homologated: true,
    limitations: [],
    observedAt: new Date().toISOString()
  }
  return new FragmentationDiagnosticService({
    adapter: { platform: 'linux', inspect },
    diagnostics: stores.diagnostics,
    probe: { probe: async () => capability }
  })
}

async function snapshot(root: string): Promise<Record<string, { hash: string; mtimeMs: number }>> {
  const result: Record<string, { hash: string; mtimeMs: number }> = {}
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile()) {
        const info = await stat(absolute)
        result[path.relative(root, absolute)] = {
          hash: createHash('sha256')
            .update(await readFile(absolute))
            .digest('hex'),
          mtimeMs: info.mtimeMs
        }
      }
    }
  }
  await walk(root)
  return result
}

function syntheticIso(gameId = ''): Buffer {
  const buffer = Buffer.alloc(18 * 2048)
  const pvd = 16 * 2048
  buffer[pvd] = 1
  buffer.write('CD001', pvd + 1, 'ascii')
  buffer.writeUInt32LE(18, pvd + 80)
  if (gameId) buffer.write(`BOOT2 = cdrom0:\\${gameId};1`, 128, 'ascii')
  return buffer
}

function syntheticZso(): Buffer {
  const buffer = Buffer.alloc(36)
  buffer.write('ZISO')
  buffer.writeUInt32LE(24, 4)
  buffer.writeBigUInt64LE(2048n, 8)
  buffer.writeUInt32LE(2048, 16)
  return buffer
}
