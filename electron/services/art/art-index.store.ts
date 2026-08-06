import type { ArtAssetRecord } from '../../../src/types/opl-finalization'
import { AtomicEntityStore } from '../persistence/atomic-entity-store.service'

export class ArtIndexStore extends AtomicEntityStore<ArtAssetRecord> {
  constructor(filePath: string) {
    super(filePath, 'assetId', { schemaVersion: 1 })
  }
}
