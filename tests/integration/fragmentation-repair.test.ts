import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTempDevice } from '../helpers/temp-device'
import { createFragmentationRepairRuntime } from '../../electron/services/fragmentation-repair/runtime'
import type { DeviceCapability } from '../../src/types/opl'

describe('single ISO fragmentation repair', () => {
  it('promotes only a verified candidate and produces a terminal rediagnosis report', async () => {
    const device = await createTempDevice()
    const userData = await mkdtemp(path.join(tmpdir(), 'repair-runtime-'))
    const source = path.join(device.root, 'DVD', 'SLUS_123.45.Game.iso')
    const bytes = syntheticIso()
    await writeFile(source, bytes)
    let sourceInspections = 0
    const adapter = {
      platform: 'linux' as const,
      inspect: async (filePath: string) => {
        const candidate = filePath.endsWith('.candidate')
        if (!candidate) sourceInspections++
        return {
          state:
            candidate || sourceInspections > 1 ? ('contiguous' as const) : ('fragmented' as const),
          verification: 'verified' as const,
          extents: candidate || sourceInspections > 1 ? 1 : 2,
          method: 'fake',
          detail: 'fixture'
        }
      }
    }
    const capability: DeviceCapability = {
      deviceId: 'device',
      mountPath: device.root,
      realPath: device.root,
      fileSystem: 'exfat',
      totalBytes: 2 ** 40,
      freeBytes: 2 ** 39,
      extentVerification: 'supported',
      method: 'fake',
      homologated: true,
      limitations: [],
      observedAt: new Date().toISOString()
    }
    const runtime = createFragmentationRepairRuntime(userData, {
      adapter,
      capabilityProbe: { probe: async () => capability }
    })
    const diagnostic = await runtime.diagnostic.diagnose({ devicePath: device.root })
    const installationId = diagnostic.installations[0].identity.installationId
    const plan = await runtime.plan.create({
      diagnosticId: diagnostic.diagnosticId,
      expectedRevision: diagnostic.revision,
      mode: 'single',
      installationIds: [installationId]
    })
    const operation = await runtime.repair.confirm(
      {
        planId: plan.planId,
        expectedRevision: plan.revision,
        confirmation: 'CORRIGIR FRAGMENTAÇÃO'
      },
      () => undefined
    )
    const terminal = await waitFor(
      async () => runtime.repair.getOperation(operation.operationId),
      (value) => value?.status !== 'running'
    )
    const report = await waitFor(
      async () => runtime.repair.getReportByOperation(operation.operationId),
      Boolean
    )
    expect(terminal?.status).toBe('completed')
    expect(report?.games[0]).toMatchObject({
      previousState: 'fragmented',
      finalState: 'contiguous',
      outcome: 'corrected'
    })
    expect(
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex')
    ).toBe(createHash('sha256').update(bytes).digest('hex'))
    await device.cleanup()
  })
})

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read()
    if (done(value)) return value
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting for repair')
}

function syntheticIso(): Buffer {
  const buffer = Buffer.alloc(18 * 2048)
  const offset = 16 * 2048
  buffer[offset] = 1
  buffer.write('CD001', offset + 1)
  buffer.writeUInt32LE(18, offset + 80)
  buffer.write('BOOT2 = cdrom0:\\SLUS_123.45;1', 64)
  return buffer
}
