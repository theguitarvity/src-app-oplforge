import { describe, expect, it } from 'vitest'
import { DownloadSchedulerService } from '@electron/services/downloads/download-scheduler.service'

const delay = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('DownloadSchedulerService', () => {
  it('honors global network concurrency', async () => {
    const scheduler = new DownloadSchedulerService({ networkConcurrency: 2 })
    let active = 0
    let peak = 0
    await Promise.all(
      Array.from({ length: 8 }, (_, priority) =>
        scheduler.scheduleNetwork(priority, async () => {
          active += 1
          peak = Math.max(peak, active)
          await delay()
          active -= 1
        })
      )
    )
    expect(peak).toBe(2)
  })

  it('allows exactly one writer per physical device but parallel writers on distinct devices', async () => {
    const aliases = new Map([
      ['mount-a', 'device-1'],
      ['remount-a', 'device-1']
    ])
    const scheduler = new DownloadSchedulerService({
      canonicalDeviceId: (id) => aliases.get(id) ?? id
    })
    const active = new Map<string, number>()
    let sameDevicePeak = 0
    let globalPeak = 0
    const write = (id: string) =>
      scheduler.scheduleWrite(id, 0, async () => {
        const canonical = aliases.get(id) ?? id
        active.set(canonical, (active.get(canonical) ?? 0) + 1)
        sameDevicePeak = Math.max(sameDevicePeak, active.get('device-1') ?? 0)
        globalPeak = Math.max(
          globalPeak,
          [...active.values()].reduce((sum, value) => sum + value, 0)
        )
        await delay()
        active.set(canonical, (active.get(canonical) ?? 1) - 1)
      })
    await Promise.all([write('mount-a'), write('remount-a'), write('device-2')])
    expect(sameDevicePeak).toBe(1)
    expect(globalPeak).toBe(2)
  })
})
