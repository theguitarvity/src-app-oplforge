import type { SpaceReservation } from '../../../src/types/opl-finalization'

export interface ReservationRequest extends Pick<
  SpaceReservation,
  'reservationId' | 'taskId' | 'deviceId' | 'scope' | 'bytes'
> {
  resourceId: string
}

interface HeldReservation extends ReservationRequest {
  observedFreeBytes: number
}

export class SpaceReservationService {
  private readonly held = new Map<string, HeldReservation>()

  constructor(private readonly freeBytes: (resourceId: string) => Promise<number>) {}

  async reserve(request: ReservationRequest): Promise<SpaceReservation> {
    const existing = this.held.get(request.reservationId)
    if (existing) return this.toPublic(existing)
    const available = await this.freeBytes(request.resourceId)
    const committed = this.totalFor(request.resourceId)
    if (request.bytes < 0 || committed + request.bytes > available)
      throw this.insufficient(request.resourceId, request.bytes, available - committed)
    const held = { ...request, observedFreeBytes: available }
    this.held.set(request.reservationId, held)
    return this.toPublic(held)
  }

  async revalidate(reservationId: string): Promise<SpaceReservation> {
    const reservation = this.held.get(reservationId)
    if (!reservation)
      throw Object.assign(new Error('Reservation not found'), { code: 'RESERVATION_NOT_FOUND' })
    const available = await this.freeBytes(reservation.resourceId)
    const committed = this.totalFor(reservation.resourceId)
    if (committed > available) throw this.insufficient(reservation.resourceId, committed, available)
    reservation.observedFreeBytes = available
    return this.toPublic(reservation)
  }

  release(reservationId: string): boolean {
    return this.held.delete(reservationId)
  }

  reservedBytes(resourceId: string): number {
    return this.totalFor(resourceId)
  }

  private totalFor(resourceId: string): number {
    let total = 0
    for (const item of this.held.values()) if (item.resourceId === resourceId) total += item.bytes
    return total
  }

  private toPublic(item: HeldReservation): SpaceReservation {
    return { ...item, state: 'held' }
  }

  private insufficient(resourceId: string, required: number, available: number): Error {
    return Object.assign(new Error(`Insufficient space on ${resourceId}`), {
      code: 'INSUFFICIENT_SPACE',
      required,
      available
    })
  }
}
