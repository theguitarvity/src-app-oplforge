import { randomUUID } from 'node:crypto'
import type {
  ArtAssetRecord,
  ArtReplacePolicy,
  ArtSyncItem,
  ArtSyncPlanSummary,
  OplArtType
} from '../../../src/types/opl-finalization'

export interface CreateArtSyncPlanInput {
  deviceId: string
  gameIds: string[]
  types: OplArtType[]
  replacePolicy: ArtReplacePolicy
  assets: ArtAssetRecord[]
  existing?: Set<string>
}

export interface CreatedArtSyncPlan {
  summary: ArtSyncPlanSummary
  items: ArtSyncItem[]
}

export class ArtSyncPlanService {
  create(input: CreateArtSyncPlanInput): CreatedArtSyncPlan {
    const planId = randomUUID()
    const warnings: string[] = []
    const items: ArtSyncItem[] = []
    for (const gameId of input.gameIds.slice(0, 500))
      for (const type of input.types) {
        const asset = input.assets.find(
          (candidate) => candidate.gameId === gameId && candidate.type === type
        )
        const exists = input.existing?.has(`${gameId}:${type}`) ?? false
        const skipped = exists && input.replacePolicy === 'missing-only'
        if (!asset) warnings.push(`${gameId}:${type} unavailable`)
        items.push({
          itemId: `${gameId}:${type}`,
          gameId,
          type,
          assetId: asset?.assetId ?? `missing:${gameId}:${type}`,
          cacheKey: asset?.archiveId ?? asset?.assetId ?? `missing:${gameId}:${type}`,
          state: skipped ? 'skipped' : asset ? 'pending' : 'failed',
          attempts: 0,
          error: asset
            ? undefined
            : {
                code: 'ART_NOT_FOUND',
                message: 'Artwork is not available in the index',
                retryable: false
              }
        })
      }
    return {
      summary: {
        planId,
        revision: 0,
        deviceId: input.deviceId,
        gameCount: Math.min(input.gameIds.length, 500),
        itemCount: items.length,
        replacePolicy: input.replacePolicy,
        warnings
      },
      items
    }
  }
}
