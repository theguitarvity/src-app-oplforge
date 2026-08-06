import { describe, expect, it } from 'vitest'
import { DeviceLockService } from '@electron/services/persistence/device-lock.service'

describe('DeviceLockService', () => {
  it('serializes aliases that resolve to the same physical device', async () => {
    const aliases = new Map([
      ['/media/usb', 'volume-1'],
      ['/mnt/remount', 'volume-1']
    ])
    const lock = new DeviceLockService((value) => aliases.get(value) ?? value)
    const timeline: string[] = []
    const first = lock.withLock('/media/usb', 0, async () => {
      timeline.push('first:start')
      await new Promise((resolve) => setTimeout(resolve, 10))
      timeline.push('first:end')
    })
    const second = lock.withLock('/mnt/remount', undefined, async () => {
      timeline.push('second:start')
      timeline.push('second:end')
    })
    await Promise.all([first, second])
    expect(timeline).toEqual(['first:start', 'first:end', 'second:start', 'second:end'])
    expect(lock.revision('/mnt/remount')).toBe(2)
  })

  it('allows different physical devices to run concurrently', async () => {
    const lock = new DeviceLockService()
    let active = 0
    let peak = 0
    const work = (id: string) =>
      lock.withLock(id, 0, async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
      })
    await Promise.all([work('volume-a'), work('volume-b')])
    expect(peak).toBe(2)
  })
})
