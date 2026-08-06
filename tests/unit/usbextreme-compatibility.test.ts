import { describe, expect, it } from 'vitest'
import {
  USBEXTREME_PART_BYTES,
  createUsbExtremeLayout,
  decodeUsbExtremeRecord,
  encodeUsbExtremeRecord,
  oplManagerTitleCrc32
} from '@electron/services/usbextreme/codec.service'

describe('USBExtreme OPL Manager compatibility', () => {
  it('matches the OPL Manager CRC32 variant over ASCII title plus NUL', () => {
    expect(oplManagerTitleCrc32('Shadow of the Colossus')).toBe('AB84175D')
    expect(oplManagerTitleCrc32('Gran Turismo 4')).toBe('DD77C066')
  })

  it('uses the Game ID suffix and exact 0x3ff00000 split boundary', () => {
    const layout = createUsbExtremeLayout({
      title: 'Shadow of the Colossus',
      gameId: 'SCUS_974.72',
      media: 'DVD',
      sourceBytes: USBEXTREME_PART_BYTES * 2 + 1
    })
    expect(layout.partSize).toBe(0x3ff00000)
    expect(layout.partCount).toBe(3)
    expect(layout.gameIdSuffix).toBe('S_974.72')
    expect(layout.partNames).toEqual([
      'ul.AB84175D.S_974.72.00',
      'ul.AB84175D.S_974.72.01',
      'ul.AB84175D.S_974.72.02'
    ])
  })

  it('round-trips a 64-byte record and preserves all 15 unknown bytes', () => {
    const unknown = Buffer.from(Array.from({ length: 15 }, (_, index) => index + 1))
    const record = encodeUsbExtremeRecord({
      title: 'GAME',
      gameId: 'SLUS_000.01',
      media: 'CD',
      parts: 5,
      unknown
    })
    expect(record).toHaveLength(64)
    const decoded = decodeUsbExtremeRecord(record)
    expect(decoded).toMatchObject({ title: 'GAME', gameId: 'SLUS_000.01', media: 'CD', parts: 5 })
    expect(decoded.unknown).toEqual(unknown)
    expect(encodeUsbExtremeRecord(decoded)).toEqual(record)
  })
})
