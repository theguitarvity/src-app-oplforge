import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectIso } from '@electron/services/images/iso9660.service'
import { structuredIso } from '../fixtures/images/generate-fixtures'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('ISO9660 SYSTEM.CNF reader', () => {
  it('reads SYSTEM.CNF by directory extent beyond the first 4 MiB', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'iso9660-cnf-'))
    roots.push(root)
    const file = path.join(root, 'arbitrary.iso')
    await writeFile(file, structuredIso())
    await expect(inspectIso(file)).resolves.toMatchObject({ valid: true, gameId: 'SLES_999.99' })
  })

  it.each([
    ['BOOT2 = cdrom0:\\SLUS_123.45;1\r\n', 'SLUS_123.45'],
    ['BOOT = cdrom0:\\SCES-777.88;1\n', 'SCES_777.88']
  ])('accepts PS2 boot syntax %s', async (boot, gameId) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'iso9660-boot-'))
    roots.push(root)
    const file = path.join(root, 'game.iso')
    await writeFile(file, structuredIso(gameId, boot, 40))
    expect((await inspectIso(file)).gameId).toBe(gameId)
  })
})
