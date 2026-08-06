import { AtomicEntityStore } from '../persistence/atomic-entity-store.service'

export interface TorrentCheckpoint {
  taskId: string
  magnet?: string
  torrentToken?: string
  infoHash: string
  selectedFiles: string[]
  verifiedBytes?: number
  updatedAt?: string
}

export interface TorrentRecoveryAdapter {
  recheck(checkpoint: TorrentCheckpoint): Promise<{ verifiedBytes: number }>
}

export class TorrentTransferService {
  private readonly store: AtomicEntityStore<TorrentCheckpoint>
  constructor(filePath: string) {
    this.store = new AtomicEntityStore(filePath, 'taskId', { schemaVersion: 1 })
  }

  async remember(checkpoint: TorrentCheckpoint): Promise<void> {
    await this.store.put({ ...structuredClone(checkpoint), updatedAt: new Date().toISOString() })
  }

  async recover(taskId: string, adapter: TorrentRecoveryAdapter): Promise<TorrentCheckpoint> {
    const checkpoint = await this.store.get(taskId)
    if (!checkpoint)
      throw Object.assign(new Error('Torrent checkpoint not found'), {
        code: 'CHECKPOINT_NOT_FOUND'
      })
    const result = await adapter.recheck(structuredClone(checkpoint))
    const recovered = {
      ...checkpoint,
      verifiedBytes: result.verifiedBytes,
      updatedAt: new Date().toISOString()
    }
    await this.store.put(recovered)
    return recovered
  }
}
