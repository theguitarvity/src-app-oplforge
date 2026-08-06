import { describe, expect, it } from 'vitest'
import { correlateUsbExtremeParts } from '../../electron/services/fragmentation-repair/diagnostic.service'

const entry = (gameId = 'SLUS_123.45') => ({
  title: 'Game',
  gameId,
  media: 'DVD' as const,
  parts: 2,
  unknown: Buffer.alloc(15)
})

describe('USBExtreme exact part correlation', () => {
  it('accepts only the exact indexed filename set and ignores lookalikes', () => {
    expect(
      correlateUsbExtremeParts(
        [
          'ul.a.SLUS_123.45.00',
          'ul.a.SLUS_123.45.01',
          'ul.a.SLUS_123.45.01.orphan',
          'ul.a.SLUS_123.45.010',
          'ul.a.SLUS_999.99.00'
        ],
        [entry()]
      )
    ).toEqual([
      { parts: ['ul.a.SLUS_123.45.00', 'ul.a.SLUS_123.45.01'], missing: [], collision: false }
    ])
  })

  it('rejects duplicate Game ID records and shared prefix groups as collisions', () => {
    const names = ['ul.a.SLUS_123.45.00', 'ul.a.SLUS_123.45.01', 'ul.b.SLUS_123.45.00']
    expect(
      correlateUsbExtremeParts(names, [entry(), entry()]).every(({ collision }) => collision)
    ).toBe(true)
    expect(correlateUsbExtremeParts(names, [entry()])[0]).toMatchObject({ collision: true })
  })

  it('reports every missing exact part index', () => {
    expect(correlateUsbExtremeParts(['ul.a.SLUS_123.45.00'], [entry()])[0]).toEqual({
      parts: ['ul.a.SLUS_123.45.00'],
      missing: [1],
      collision: false
    })
  })
})
