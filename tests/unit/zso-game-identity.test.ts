import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createZsoReader } from '@electron/services/images/zso.service'
import { inspectIsoReader } from '@electron/services/images/iso9660.service'
import { structuredIso } from '../fixtures/images/generate-fixtures'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

function uncompressedZso(image: Buffer, blockSize = 2048): Buffer {
  const blocks = Math.ceil(image.length / blockSize)
  const headerSize = 24
  const tableBytes = (blocks + 1) * 4
  const dataOffset = headerSize + tableBytes
  const header = Buffer.alloc(headerSize)
  header.write('ZISO')
  header.writeUInt32LE(headerSize, 4)
  header.writeBigUInt64LE(BigInt(image.length), 8)
  header.writeUInt32LE(blockSize, 16)
  const table = Buffer.alloc(tableBytes)
  for (let index = 0; index <= blocks; index += 1)
    table.writeUInt32LE(
      ((dataOffset + index * blockSize) | (index < blocks ? 0x80000000 : 0)) >>> 0,
      index * 4
    )
  return Buffer.concat([header, table, image])
}

describe('ZSO random-access identity', () => {
  it('finds internal SYSTEM.CNF independently of the filename', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zso-identity-'))
    roots.push(root)
    const file = path.join(root, 'totally-wrong-name.zso')
    await writeFile(
      file,
      uncompressedZso(structuredIso('SCUS_111.22', 'BOOT2 = cdrom0:\\SCUS_111.22;1\r\n', 64))
    )
    const reader = await createZsoReader(file)
    try {
      await expect(inspectIsoReader(reader)).resolves.toMatchObject({
        valid: true,
        gameId: 'SCUS_111.22'
      })
    } finally {
      await reader.close?.()
    }
  })

  it('reads across block boundaries without materializing the image', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'zso-random-'))
    roots.push(root)
    const file = path.join(root, 'image.zso')
    const image = Buffer.from(Array.from({ length: 8192 }, (_, index) => index % 251))
    await writeFile(file, uncompressedZso(image, 2048))
    const reader = await createZsoReader(file)
    try {
      expect(await reader.read(2040, 32)).toEqual(image.subarray(2040, 2072))
    } finally {
      await reader.close?.()
    }
  })
})
