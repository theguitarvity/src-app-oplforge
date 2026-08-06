import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ArtArchiveService } from '@electron/services/art/art-archive.service'
import { hostileZipEntries, storedZip, validPng } from '../fixtures/art/generate-fixtures'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('ArtArchiveService security', () => {
  it('extracts one lazy entry without loading the whole archive', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-zip-'))
    roots.push(root)
    const archive = path.join(root, 'art.zip')
    const destination = path.join(root, 'out.png')
    await writeFile(archive, storedZip('nested/SLUS_123.45_COV.png', validPng()))
    const service = new ArtArchiveService()
    expect(await service.list(archive)).toEqual(['nested/SLUS_123.45_COV.png'])
    await service.extract(archive, 'nested/SLUS_123.45_COV.png', destination)
    expect(await readFile(destination)).toEqual(validPng())
  })

  it.each([
    ['traversal', hostileZipEntries.traversal],
    ['absolute', hostileZipEntries.absolute],
    ['oversized', hostileZipEntries.oversizedClaim]
  ])('rejects hostile %s entries', async (_name, bytes) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-hostile-'))
    roots.push(root)
    const archive = path.join(root, 'hostile.zip')
    await writeFile(archive, bytes)
    await expect(
      new ArtArchiveService({ maxEntryBytes: 1024 * 1024 }).list(archive)
    ).rejects.toMatchObject({ code: 'UNSAFE_ART_ARCHIVE' })
  })
})
