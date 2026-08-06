import type { ArtAssetRecord, OplArtType, Page } from '../../../src/types/opl-finalization'
import { ArtIndexStore } from './art-index.store'

export interface ArtIndexSummary {
  revision: number
  itemCount: number
  refreshedAt?: string
  stale: boolean
  error?: string
}
export interface ArtIndexQuery {
  gameIds?: string[]
  types?: OplArtType[]
  cursor?: string
  limit?: number
}

export class ArtIndexService {
  private readonly store: ArtIndexStore
  private lastRefreshMs?: number

  constructor(
    filePath: string,
    private readonly ttlMs = 24 * 60 * 60_000,
    private readonly now: () => number = Date.now
  ) {
    this.store = new ArtIndexStore(filePath)
  }

  async refresh(load: () => Promise<ArtAssetRecord[]>, force = false): Promise<ArtIndexSummary> {
    const current = await this.store.document()
    const persistedRefreshMs = current.updatedAt ? Date.parse(current.updatedAt) : undefined
    const refreshedAt = this.lastRefreshMs ?? persistedRefreshMs
    if (
      !force &&
      refreshedAt !== undefined &&
      this.now() - refreshedAt < this.ttlMs &&
      Object.keys(current.data).length > 0
    )
      return {
        revision: current.revision,
        itemCount: Object.keys(current.data).length,
        refreshedAt: current.updatedAt,
        stale: false
      }
    try {
      const assets = await load()
      const replaced = await this.store.replaceAll(assets, current.revision)
      const revision = replaced.revision
      this.lastRefreshMs = this.now()
      const document = await this.store.document()
      return { revision, itemCount: assets.length, refreshedAt: document.updatedAt, stale: false }
    } catch (error) {
      if (Object.keys(current.data).length)
        return {
          revision: current.revision,
          itemCount: Object.keys(current.data).length,
          refreshedAt: current.updatedAt,
          stale: true,
          error: (error as Error).message
        }
      throw error
    }
  }

  async query(input: ArtIndexQuery = {}): Promise<Page<ArtAssetRecord>> {
    const document = await this.store.document()
    const offset = input.cursor ? Number(input.cursor) : 0
    const limit = input.limit ?? 100
    const filtered = Object.values(document.data)
      .filter(
        (asset) =>
          (!input.gameIds?.length || input.gameIds.includes(asset.gameId)) &&
          (!input.types?.length || input.types.includes(asset.type))
      )
      .sort((left, right) =>
        `${left.gameId}:${left.type}`.localeCompare(`${right.gameId}:${right.type}`)
      )
    return {
      items: filtered.slice(offset, offset + limit),
      nextCursor: offset + limit < filtered.length ? String(offset + limit) : undefined,
      revision: document.revision
    }
  }
}
