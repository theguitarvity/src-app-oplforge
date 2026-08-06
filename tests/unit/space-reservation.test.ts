import { describe, expect, it } from 'vitest'
import { SpaceReservationService } from '@electron/services/downloads/space-reservation.service'

describe('SpaceReservationService', () => {
  it('accounts reservations by resource and rejects aggregate overcommit', async () => {
    const free = new Map([
      ['cache', 100],
      ['device-1', 80]
    ])
    const service = new SpaceReservationService((resource) =>
      Promise.resolve(free.get(resource) ?? 0)
    )
    await service.reserve({
      reservationId: 'r1',
      taskId: 't1',
      deviceId: 'device-1',
      scope: 'local-cache',
      resourceId: 'cache',
      bytes: 60
    })
    await service.reserve({
      reservationId: 'r2',
      taskId: 't2',
      deviceId: 'device-1',
      scope: 'local-cache',
      resourceId: 'cache',
      bytes: 40
    })
    await expect(
      service.reserve({
        reservationId: 'r3',
        taskId: 't3',
        deviceId: 'device-1',
        scope: 'local-cache',
        resourceId: 'cache',
        bytes: 1
      })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_SPACE' })
  })

  it('revalidates current free space and releases idempotently', async () => {
    let available = 100
    const service = new SpaceReservationService(() => Promise.resolve(available))
    await service.reserve({
      reservationId: 'r1',
      taskId: 't1',
      deviceId: 'device-1',
      scope: 'device-staging',
      resourceId: 'device-1',
      bytes: 80
    })
    available = 50
    await expect(service.revalidate('r1')).rejects.toMatchObject({ code: 'INSUFFICIENT_SPACE' })
    expect(service.release('r1')).toBe(true)
    expect(service.release('r1')).toBe(false)
  })
})
