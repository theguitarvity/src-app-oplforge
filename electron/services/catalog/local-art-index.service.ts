import { createHash, randomUUID } from 'node:crypto'
import { lstat, open, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import type { ArtAssetType, GameArtView, LocalArtAsset } from '../../../src/types/opl'
import { captureSafeRoot, resolveInside, type SafeRoot } from '../persistence/safe-path.service'

const ART_NAME = /^([A-Z]{4}[-_.][0-9]{3}[.][0-9]{2})_(ICO|SCR2?|BG|LGO|COV2?|LAB)[.]png$/i
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
export interface LocalArtIndexSnapshot {
  snapshotId: string
  revision: number
  deviceId: string
  root: SafeRoot
  assets: LocalArtAsset[]
  byGameId: Map<string, LocalArtAsset[]>
}

export class LocalArtIndexService {
  private readonly snapshots = new Map<string, LocalArtIndexSnapshot>()
  private readonly assets = new Map<
    string,
    { snapshot: LocalArtIndexSnapshot; asset: LocalArtAsset }
  >()
  private revision = 0
  async scan(devicePath: string, deviceId: string): Promise<LocalArtIndexSnapshot> {
    const root = await captureSafeRoot(devicePath)
    const assets: LocalArtAsset[] = []
    let entries: Dirent<string>[]
    try {
      entries = await readdir(await resolveInside(root, 'ART'), { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      entries = []
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.isSymbolicLink()) continue
      const match = ART_NAME.exec(entry.name)
      if (!match) continue
      const relativePath = path.posix.join('ART', entry.name)
      const absolute = await resolveInside(root, relativePath)
      if ((await lstat(absolute)).isSymbolicLink()) continue
      const metadata = await stat(absolute)
      const handle = await open(absolute, 'r')
      const signature = Buffer.alloc(8)
      try {
        await handle.read(signature, 0, 8, 0)
      } finally {
        await handle.close()
      }
      const valid = metadata.size > 8 && signature.equals(PNG_SIGNATURE)
      assets.push({
        assetId: randomUUID(),
        deviceId,
        gameId: match[1].replace('_', '-').toUpperCase(),
        type: match[2].toUpperCase() as ArtAssetType,
        relativePath,
        sizeBytes: metadata.size,
        modifiedAt: metadata.mtime.toISOString(),
        validity: valid ? 'valid' : 'invalid',
        findingCodes: valid ? [] : ['ART_INVALID_PNG']
      })
    }
    assets.sort(
      (a, b) =>
        a.relativePath.localeCompare(b.relativePath, 'en', { sensitivity: 'base' }) ||
        a.relativePath.localeCompare(b.relativePath)
    )
    const byGameId = new Map<string, LocalArtAsset[]>()
    for (const asset of assets)
      byGameId.set(asset.gameId, [...(byGameId.get(asset.gameId) ?? []), asset])
    const snapshot = {
      snapshotId: randomUUID(),
      revision: ++this.revision,
      deviceId,
      root,
      assets,
      byGameId
    }
    for (const asset of assets) this.assets.set(asset.assetId, { snapshot, asset })
    this.snapshots.set(deviceId, snapshot)
    return snapshot
  }
  get(deviceId: string): LocalArtIndexSnapshot | undefined {
    return this.snapshots.get(deviceId)
  }
  view(snapshot: LocalArtIndexSnapshot, gameId: string): GameArtView {
    const all = snapshot.byGameId.get(gameId.replace('_', '-').toUpperCase()) ?? []
    const valid = all.filter((asset) => asset.validity === 'valid')
    const selected = ['COV', 'COV2'].flatMap((type) =>
      valid.filter((asset) => asset.type === type)
    )[0]
    const ambiguous = Boolean(
      selected && valid.filter((asset) => asset.type === selected.type).length > 1
    )
    return {
      primaryCoverAssetId: selected?.assetId,
      coverUrl: selected
        ? `opl-art://device/${createHash('sha256').update(snapshot.deviceId).digest('hex').slice(0, 16)}/${selected.assetId}?rev=${snapshot.revision}`
        : undefined,
      availableTypes: [...new Set(valid.map((asset) => asset.type))],
      completeness: ambiguous
        ? 'ambiguous'
        : selected
          ? valid.length > 1
            ? 'complete'
            : 'partial'
          : all.length
            ? 'invalid'
            : 'missing',
      placeholderKind: 'ps2',
      findings: ambiguous
        ? [
            {
              code: 'ART_AMBIGUOUS',
              severity: 'warning',
              state: 'not-verified',
              message: 'Multiple deterministic cover candidates were found'
            }
          ]
        : []
    }
  }
  resolve(assetId: string) {
    return this.assets.get(assetId)
  }
}
export const localArtIndex = new LocalArtIndexService()
