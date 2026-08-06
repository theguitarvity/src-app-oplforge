import type { ArtAssetRecord } from '../../../src/types/opl-finalization'

export interface ArtManifestSnapshot {
  sourceId: string
  revision: string
  assets: ArtAssetRecord[]
  etag?: string
  lastModified?: string
}
export interface ArtSourceAdapter {
  readonly sourceId: string
  loadManifest(validators?: { etag?: string; lastModified?: string }): Promise<ArtManifestSnapshot>
}
