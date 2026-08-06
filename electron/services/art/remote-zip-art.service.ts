import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inflateRawSync } from 'node:zlib'
import type { ArtAssetRecord } from '../../../src/types/opl-finalization'
import { parseArtName } from './art-validation.service'

export const OPLM_ART_ARCHIVE_URL =
  'https://archive.org/download/OPLM_ART_2024_09/OPLM_ART_2024_09.zip'

async function range(
  url: string,
  start: number,
  end?: number,
  request: typeof fetch = fetch
): Promise<Buffer> {
  const response = await request(url, { headers: { Range: `bytes=${start}-${end ?? ''}` } })
  if (response.status !== 206)
    throw Object.assign(new Error(`Artwork source rejected byte range (${response.status})`), {
      code: 'ART_RANGE_UNAVAILABLE'
    })
  return Buffer.from(await response.arrayBuffer())
}

function uint64(buffer: Buffer, offset: number): number {
  const value = buffer.readBigUInt64LE(offset)
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error('ZIP64 offset exceeds safe integer range')
  return Number(value)
}

function zip64Values(
  extra: Buffer,
  needs: { uncompressed: boolean; compressed: boolean; offset: boolean }
) {
  let cursor = 0
  while (cursor + 4 <= extra.length) {
    const id = extra.readUInt16LE(cursor)
    const size = extra.readUInt16LE(cursor + 2)
    const data = extra.subarray(cursor + 4, cursor + 4 + size)
    if (id === 0x0001) {
      let position = 0
      const result: { uncompressed?: number; compressed?: number; offset?: number } = {}
      if (needs.uncompressed) {
        result.uncompressed = uint64(data, position)
        position += 8
      }
      if (needs.compressed) {
        result.compressed = uint64(data, position)
        position += 8
      }
      if (needs.offset) result.offset = uint64(data, position)
      return result
    }
    cursor += 4 + size
  }
  return {}
}

export async function indexRemoteOplmArchive(
  request: typeof fetch = fetch
): Promise<ArtAssetRecord[]> {
  const tailResponse = await request(OPLM_ART_ARCHIVE_URL, { headers: { Range: 'bytes=-131072' } })
  if (tailResponse.status !== 206)
    throw Object.assign(new Error('Artwork ZIP64 tail is unavailable'), {
      code: 'ART_ARCHIVE_INDEX_FAILED'
    })
  const tail = Buffer.from(await tailResponse.arrayBuffer())
  const locator = tail.lastIndexOf(Buffer.from('PK\x06\x07', 'binary'))
  if (locator < 0) throw new Error('ZIP64 locator was not found')
  const zip64Offset = uint64(tail, locator + 8)
  const zip64 = await range(OPLM_ART_ARCHIVE_URL, zip64Offset, zip64Offset + 55, request)
  if (zip64.toString('binary', 0, 4) !== 'PK\x06\x06') throw new Error('Invalid ZIP64 end record')
  const centralSize = uint64(zip64, 40)
  const centralOffset = uint64(zip64, 48)
  const central = await range(
    OPLM_ART_ARCHIVE_URL,
    centralOffset,
    centralOffset + centralSize - 1,
    request
  )
  const assets: ArtAssetRecord[] = []
  let cursor = 0
  while (
    cursor + 46 <= central.length &&
    central.toString('binary', cursor, cursor + 4) === 'PK\x01\x02'
  ) {
    const compressionMethod = central.readUInt16LE(cursor + 10)
    const crc = central.readUInt32LE(cursor + 16)
    const compressed32 = central.readUInt32LE(cursor + 20)
    const uncompressed32 = central.readUInt32LE(cursor + 24)
    const nameLength = central.readUInt16LE(cursor + 28)
    const extraLength = central.readUInt16LE(cursor + 30)
    const commentLength = central.readUInt16LE(cursor + 32)
    const offset32 = central.readUInt32LE(cursor + 42)
    const entryName = central.toString('utf8', cursor + 46, cursor + 46 + nameLength)
    const extra = central.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength)
    const zip64ValuesFound = zip64Values(extra, {
      uncompressed: uncompressed32 === 0xffffffff,
      compressed: compressed32 === 0xffffffff,
      offset: offset32 === 0xffffffff
    })
    const parsed = parseArtName(entryName)
    if (parsed && (compressionMethod === 0 || compressionMethod === 8))
      assets.push({
        assetId: `${parsed.gameId}:${parsed.type}:${entryName}`,
        gameId: parsed.gameId,
        type: parsed.type,
        sourceId: 'OPLM_ART_2024_09',
        archiveId: OPLM_ART_ARCHIVE_URL,
        entryName,
        archiveOffset: zip64ValuesFound.offset ?? offset32,
        compressionMethod,
        compressedBytes: zip64ValuesFound.compressed ?? compressed32,
        uncompressedBytes: zip64ValuesFound.uncompressed ?? uncompressed32,
        crc32: crc.toString(16).padStart(8, '0'),
        sourceFormat: 'png'
      })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return assets
}

export async function cacheRemoteArtEntry(
  asset: ArtAssetRecord,
  cacheRoot: string,
  request: typeof fetch = fetch
): Promise<string> {
  if (
    !asset.archiveId ||
    !asset.entryName ||
    asset.archiveOffset === undefined ||
    asset.compressedBytes === undefined ||
    asset.compressionMethod === undefined
  )
    throw Object.assign(new Error('Artwork archive metadata is incomplete'), {
      code: 'ART_SOURCE_UNAVAILABLE'
    })
  await mkdir(cacheRoot, { recursive: true })
  const key = createHash('sha256').update(asset.assetId).digest('hex')
  const destination = path.join(cacheRoot, `${key}.png`)
  try {
    await readFile(destination)
    return destination
  } catch {
    /* cache miss */
  }
  const header = await range(
    asset.archiveId,
    asset.archiveOffset,
    asset.archiveOffset + 29,
    request
  )
  if (header.toString('binary', 0, 4) !== 'PK\x03\x04')
    throw new Error('Invalid artwork local ZIP header')
  const dataOffset = asset.archiveOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
  const compressed = await range(
    asset.archiveId,
    dataOffset,
    dataOffset + asset.compressedBytes - 1,
    request
  )
  const bytes = asset.compressionMethod === 0 ? compressed : inflateRawSync(compressed)
  if (asset.uncompressedBytes !== undefined && bytes.length !== asset.uncompressedBytes)
    throw Object.assign(new Error('Artwork entry size mismatch'), {
      code: 'ART_ENTRY_SIZE_MISMATCH'
    })
  const temporary = `${destination}.part`
  await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 })
  await rename(temporary, destination)
  return destination
}
