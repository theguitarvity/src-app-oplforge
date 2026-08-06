import path from 'node:path'
import type { ArtAssetType, GameArtStatus } from '../../../src/types/opl'
import { normalizeGameId } from '../images/game-naming.service'

export const ART_TYPES: ArtAssetType[] = ['ICO', 'SCR', 'SCR2', 'BG', 'LGO', 'COV', 'LAB', 'COV2']
export function parseArtName(name: string): { gameId: string; type: ArtAssetType } | null {
  const base = path.posix.basename(name.replace(/\\/g, '/'))
  const match = base.match(
    /^([A-Za-z]{4}[_-]?[0-9]{3}\.[0-9]{2})_(ICO|SCR|SCR2|BG|LGO|COV|LAB|COV2)\.png$/i
  )
  if (!match) return null
  const gameId = normalizeGameId(match[1])
  const type = match[2].toUpperCase() as ArtAssetType
  return gameId && ART_TYPES.includes(type) ? { gameId, type } : null
}
export function validatePng(bytes: Uint8Array, declaredName: string): void {
  if (!declaredName.toLowerCase().endsWith('.png'))
    throw Object.assign(new Error('Artwork extension is not PNG'), {
      code: 'INVALID_ART_EXTENSION'
    })
  if (bytes.byteLength < 32)
    throw Object.assign(new Error('Artwork is empty or truncated'), { code: 'INVALID_PNG' })
  const buffer = Buffer.from(bytes)
  if (
    !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    buffer.toString('ascii', 12, 16) !== 'IHDR' ||
    buffer.indexOf(Buffer.from('IEND', 'ascii')) < 0
  )
    throw Object.assign(new Error('Artwork content is not PNG'), { code: 'INVALID_PNG' })
}
export function artStatus(available: ArtAssetType[], installed: ArtAssetType[]): GameArtStatus {
  const present = new Set(installed)
  if (!present.size) return 'missing'
  const hasCover = present.has('COV') || present.has('COV2')
  if (available.length > 0 && available.every((type) => present.has(type))) return 'complete'
  return hasCover ? (installed.length === 1 ? 'cover-ready' : 'partial') : 'partial'
}
export function finalArtName(gameId: string, type: ArtAssetType): string {
  const normalized = normalizeGameId(gameId)
  if (!normalized) throw new Error('Invalid Game ID')
  return `${normalized}_${type}.png`
}
