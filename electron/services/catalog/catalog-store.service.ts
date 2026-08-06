import type { CatalogSnapshot } from '../../../src/types/opl'
import { JsonStore } from '../persistence/json-store.service'

export interface GameIdOverride {
  deviceId: string
  relativePath: string
  size: number
  fingerprint: string
  gameId: string
  createdAt: string
}
interface CatalogData {
  snapshots: Record<string, CatalogSnapshot>
  overrides: GameIdOverride[]
}

export class CatalogStoreService {
  private readonly store: JsonStore<CatalogData>
  constructor(filePath: string) {
    this.store = new JsonStore(filePath, 1, () => ({ snapshots: {}, overrides: [] }))
  }
  async snapshot(deviceId: string): Promise<CatalogSnapshot | undefined> {
    return (await this.store.read()).data.snapshots[deviceId]
  }
  async publish(snapshot: CatalogSnapshot): Promise<CatalogSnapshot> {
    const document = await this.store.read()
    await this.store.write(
      {
        ...document.data,
        snapshots: { ...document.data.snapshots, [snapshot.deviceId]: snapshot }
      },
      document.revision
    )
    return snapshot
  }
  async setOverride(value: GameIdOverride): Promise<void> {
    const document = await this.store.read()
    const others = document.data.overrides.filter(
      (item) => item.deviceId !== value.deviceId || item.relativePath !== value.relativePath
    )
    await this.store.write({ ...document.data, overrides: [...others, value] }, document.revision)
  }
  async override(
    deviceId: string,
    relativePath: string,
    size: number,
    fingerprint: string
  ): Promise<GameIdOverride | undefined> {
    const document = await this.store.read()
    return document.data.overrides.find(
      (item) =>
        item.deviceId === deviceId &&
        item.relativePath === relativePath &&
        item.size === size &&
        item.fingerprint === fingerprint
    )
  }
}
