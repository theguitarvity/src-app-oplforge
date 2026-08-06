import { describe, expect, it } from 'vitest'
import {
  artStatus,
  finalArtName,
  parseArtName,
  validatePng
} from '@electron/services/art/art-validation.service'
import { htmlError, storedZip, validPng } from '../fixtures/art/generate-fixtures'
import {
  extractZipEntry,
  indexNamedAssets,
  listZipEntryNames
} from '@electron/services/art/oplm-art.service'

describe('OPL artwork validation', () => {
  it('recognizes nested names and preserves all supported suffixes', () => {
    expect(parseArtName('deep/path/slus_123.45_COV2.png')).toEqual({
      gameId: 'SLUS_123.45',
      type: 'COV2'
    })
    expect(finalArtName('slus12345', 'SCR2')).toBe('SLUS_123.45_SCR2.png')
    expect(indexNamedAssets([{ name: 'dir/SLUS_123.45_LAB.png' }])).toHaveLength(1)
  })
  it('rejects HTML, empty and fake PNG bodies', () => {
    expect(() => validatePng(htmlError, 'SLUS_123.45_COV.png')).toThrow()
    expect(() => validatePng(Buffer.alloc(0), 'x.png')).toThrow()
    expect(() => validatePng(validPng(), 'x.png')).not.toThrow()
  })
  it('derives completeness from advertised types, not a fixed count', () => {
    expect(artStatus(['COV'], ['COV'])).toBe('complete')
    expect(artStatus(['COV', 'BG'], ['COV'])).toBe('cover-ready')
    expect(artStatus(['COV', 'BG'], ['COV', 'BG'])).toBe('complete')
    expect(artStatus([], [])).toBe('missing')
  })
  it('indexes and extracts assets nested inside ZIP archives', () => {
    const name = 'nested/SLUS_123.45_COV.png'
    const zip = storedZip(name, validPng())
    expect(listZipEntryNames(zip)).toEqual([name])
    expect(extractZipEntry(zip, name)).toEqual(validPng())
  })
})
