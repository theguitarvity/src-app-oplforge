import { describe, expect, it } from 'vitest'
import {
  canonicalGameName,
  planCanonicalGameName,
  sanitizeOplTitle
} from '@electron/services/images/game-naming.service'

describe('OPL canonical naming', () => {
  it('uses conservative ASCII, removes forbidden characters and limits title to 32 bytes', () => {
    const title = sanitizeOplTitle(
      '  Ōkami™: Edição / Especial com um nome muito muito longo  ',
      32
    )
    expect(title).toMatch(/^[\x20-\x7E]+$/)
    expect(title).not.toMatch(/[<>:"/\\|?*]/)
    expect(Buffer.byteLength(title, 'ascii')).toBeLessThanOrEqual(32)
    expect(canonicalGameName('slus12345', title, 'iso')).toBe(`SLUS_123.45.${title}.iso`)
  })

  it('normalizes extension and reports exact case-insensitive collisions', () => {
    const planned = planCanonicalGameName('SLUS_123.45', 'Game', 'ISO', ['slus_123.45.game.iso'])
    expect(planned).toEqual({ fileName: 'SLUS_123.45.Game.iso', collision: 'slus_123.45.game.iso' })
  })
})
