import { mkdir, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ValidationService } from '@electron/services/pcsx2/validation.service'

describe('PCSX2 validation with fake process', () => {
  it('records datapath, logs and nine timed stages well below the 20-minute limit', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'pcsx-run-'))
    const runner = {
      start: async (_profile: unknown, options: { datapath: string }) => {
        await mkdir(options.datapath, { recursive: true })
        await writeFile(path.join(options.datapath, 'stdout.log'), 'fake PCSX2')
        return { process: {}, stop: async () => ({ code: 0, signal: null, timedOut: false }) }
      }
    }
    const service = new ValidationService(runner as never)
    const profile = {
      id: 'p',
      executablePath: '/pcsx2',
      version: '2.4.0',
      architecture: 'x64',
      sha256: 'a'.repeat(64),
      adapterId: 'pcsx2-v2',
      supported: true
    }
    const started = Date.now()
    const plan = service.plan({
      profile,
      bios: { sha256: 'b'.repeat(64), region: 'USA', sizeBytes: 1 },
      biosPath: '/bios',
      memoryCardPath: '/card',
      usbImage: '/usb',
      workspace,
      bootMode: 'memory-card'
    })
    const run = await service.start(plan.id)
    for (let stage = 1; stage <= 9; stage++) service.checkpoint(run.id, stage, 'passed')
    const result = await service.stop(run.id)
    expect(result.status).toBe('passed')
    expect(result.checkpoints).toHaveLength(9)
    expect(result.artifacts).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'log' })])
    )
    expect(Date.now() - started).toBeLessThan(20 * 60_000)
    expect(result.datapath).toContain(workspace)
  })
})
