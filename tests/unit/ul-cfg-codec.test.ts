import { describe, expect, it } from 'vitest'
import { decodeUlCfg, encodeUlCfg } from '@electron/services/usbextreme/ul-cfg.service'

describe('ul.cfg codec', () => {
  it('round-trips known and unknown bytes without loss', () => {
    const encoded = encodeUlCfg([
      {
        title: 'Synthetic',
        gameId: 'SLUS_123.45',
        media: 'DVD',
        parts: 3,
        unknown: Buffer.alloc(15, 0x7f)
      }
    ])
    const decoded = decodeUlCfg(encoded)
    expect(decoded[0]).toMatchObject({
      title: 'Synthetic',
      gameId: 'SLUS_123.45',
      media: 'DVD',
      parts: 3
    })
    expect(encodeUlCfg(decoded)).toEqual(encoded)
  })
  it('rejects a partial record', () =>
    expect(() => decodeUlCfg(Buffer.alloc(63))).toThrow(/incomplete/))
})
