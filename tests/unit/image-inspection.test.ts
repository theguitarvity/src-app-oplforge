import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  syntheticIso,
  syntheticUncompressedZso,
  syntheticZso
} from '../fixtures/images/generate-fixtures'
import { inspectIso } from '@electron/services/images/iso9660.service'
import { canonicalGameName, normalizeGameId } from '@electron/services/images/game-naming.service'
import { readZsoBlock, readZsoHeader } from '@electron/services/images/zso.service'

describe('image inspection', () => {
  it('validates ISO9660 and derives media and normalized Game ID from contents', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'iso-'))
    const file = path.join(root, 'anything.bin')
    await writeFile(file, syntheticIso('slus-123.45', 500_000))
    await expect(inspectIso(file)).resolves.toMatchObject({
      valid: true,
      gameId: 'SLUS_123.45',
      media: 'DVD'
    })
  })
  it('reads logical sectors through the ZSO index', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zso-block-'))
    const file = path.join(root, 'sector.zso')
    await writeFile(file, syntheticUncompressedZso())
    expect(await readZsoBlock(file, 0)).toEqual(Buffer.alloc(2048, 0x2a))
  })
  it('rejects invalid ISO and validates ZSO geometry', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'image-'))
    const bad = path.join(root, 'bad.iso')
    const zso = path.join(root, 'ok.zso')
    await writeFile(bad, Buffer.alloc(40_000))
    await writeFile(zso, syntheticZso())
    expect((await inspectIso(bad)).valid).toBe(false)
    expect((await readZsoHeader(zso)).blockSize).toBe(2048)
  })
  it('normalizes identifiers and creates safe canonical names', () => {
    expect(normalizeGameId('boot=cdrom:\\SLUS-12345;1')).toBe('SLUS_123.45')
    expect(canonicalGameName('slus12345', 'A/B: Game', 'iso')).toBe('SLUS_123.45.A B Game.iso')
  })
})
