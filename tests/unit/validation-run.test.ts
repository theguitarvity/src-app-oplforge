import { describe, expect, it } from 'vitest'
import { ValidationService } from '@electron/services/pcsx2/validation.service'

const profile = {
  id: 'p',
  executablePath: '/pcsx2',
  version: '2.4.0',
  architecture: 'x64',
  sha256: 'a'.repeat(64),
  adapterId: 'pcsx2-v2',
  supported: true
}
const input = {
  profile,
  bios: { sha256: 'b'.repeat(64), region: 'USA', sizeBytes: 1 },
  biosPath: '/bios',
  memoryCardPath: '/card',
  usbImage: '/usb',
  workspace: '/tmp/test-validation',
  bootMode: 'memory-card' as const
}
async function completedRun(processResult: {
  code: number | null
  signal: null
  timedOut: boolean
}) {
  const service = new ValidationService({
    start: async () => ({ process: {}, stop: async () => processResult })
  } as never)
  const run = await service.start(service.plan(input).id)
  for (let stage = 1; stage <= 9; stage++) service.checkpoint(run.id, stage, 'passed')
  return service.stop(run.id)
}

describe('validation run', () => {
  it('requires all nine checkpoints and records memory-card boot distinctly', async () => {
    const run = await completedRun({ code: 0, signal: null, timedOut: false })
    expect(run.status).toBe('passed')
    expect(run.bootMode).toBe('memory-card')
  })
  it('keeps failed and not-verified checkpoints from becoming approval', async () => {
    const service = new ValidationService({
      start: async () => ({
        process: {},
        stop: async () => ({ code: 0, signal: null, timedOut: false })
      })
    } as never)
    const plan = service.plan({
      ...input,
      workspace: '/tmp/test-validation-2',
      bootMode: 'elf-fallback',
      elfPath: '/opl.elf'
    })
    const run = await service.start(plan.id)
    service.checkpoint(run.id, 1, 'not-verified')
    expect((await service.stop(run.id)).status).toBe('failed')
    expect(run.bootMode).toBe('elf-fallback')
  })
  it('classifies process crashes and timeouts independently', async () => {
    expect((await completedRun({ code: 2, signal: null, timedOut: false })).status).toBe('failed')
    expect((await completedRun({ code: null, signal: null, timedOut: true })).status).toBe(
      'timeout'
    )
  })
})
