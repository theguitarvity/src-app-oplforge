import type { ArtAsset } from '../../../src/types/opl'
import type { ArtAssetRecord } from '../../../src/types/opl-finalization'
import { parseArtName } from './art-validation.service'
import { inflateRawSync } from 'node:zlib'

interface ArchiveMetadataResponse {
  files?: Array<Record<string, unknown>>
}
const identifier = 'OPLM_ART_2024_09'

export function indexNamedAssets(
  entries: Array<{ name: string; size?: number; url?: string }>,
  baseUrl = `https://archive.org/download/${identifier}/`
): ArtAsset[] {
  return entries.flatMap((entry) => {
    const parsed = parseArtName(entry.name)
    if (!parsed) return []
    return [
      {
        ...parsed,
        name: entry.name,
        url: entry.url ?? `${baseUrl}${entry.name.split('/').map(encodeURIComponent).join('/')}`,
        sizeBytes: entry.size
      }
    ]
  })
}

export function listZipEntryNames(buffer: Buffer): string[] {
  const names: string[] = []
  let offset = 0
  while ((offset = buffer.indexOf(Buffer.from('PK\x01\x02', 'binary'), offset)) >= 0) {
    if (offset + 46 > buffer.length) break
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extra = buffer.readUInt16LE(offset + 30)
    const comment = buffer.readUInt16LE(offset + 32)
    names.push(buffer.toString('utf8', offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extra + comment
  }
  return names
}

export function extractZipEntry(buffer: Buffer, wantedName: string): Buffer {
  let offset = 0
  while ((offset = buffer.indexOf(Buffer.from('PK\x01\x02', 'binary'), offset)) >= 0) {
    const compression = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const nameLength = buffer.readUInt16LE(offset + 28)
    const extra = buffer.readUInt16LE(offset + 30)
    const comment = buffer.readUInt16LE(offset + 32)
    const localOffset = buffer.readUInt32LE(offset + 42)
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength)
    if (name === wantedName) {
      if (buffer.toString('binary', localOffset, localOffset + 4) !== 'PK\x03\x04')
        throw new Error('Invalid ZIP local header')
      const localName = buffer.readUInt16LE(localOffset + 26)
      const localExtra = buffer.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + localName + localExtra
      const compressed = buffer.subarray(start, start + compressedSize)
      if (compression === 0) return Buffer.from(compressed)
      if (compression === 8) return inflateRawSync(compressed)
      throw new Error(`Unsupported ZIP compression ${compression}`)
    }
    offset += 46 + nameLength + extra + comment
  }
  throw Object.assign(new Error('Artwork entry missing from ZIP'), {
    code: 'ART_ARCHIVE_ENTRY_MISSING'
  })
}

export async function indexOplmArt(request: typeof fetch = fetch): Promise<ArtAsset[]> {
  const response = await request(`https://archive.org/metadata/${identifier}`)
  if (!response.ok)
    throw Object.assign(new Error(`OPLM ART index failed (${response.status})`), {
      code: 'ART_INDEX_FAILED'
    })
  const payload = (await response.json()) as ArchiveMetadataResponse
  const direct = (payload.files ?? []).flatMap((file) =>
    typeof file.name === 'string' ? [{ name: file.name, size: Number(file.size) || undefined }] : []
  )
  const assets = indexNamedAssets(direct)
  return assets
}

export async function loadOplmArtRecords(request: typeof fetch = fetch): Promise<ArtAssetRecord[]> {
  const assets = await indexOplmArt(request)
  return assets.map((asset) => ({
    assetId: `${asset.gameId}:${asset.type}:${asset.name}`,
    gameId: asset.gameId,
    type: asset.type,
    sourceId: identifier,
    directUrl: asset.url,
    compressedBytes: asset.sizeBytes,
    uncompressedBytes: asset.sizeBytes,
    sourceFormat: 'png'
  }))
}

/** @deprecated The durable artwork index owns cache invalidation. */
export function clearArtIndexCache() {}
