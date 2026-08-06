import type { CatalogSnapshot } from '../../../src/types/opl'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'
import { sha256File } from '../installation/installation-planner.service'

export class CatalogHashService {
  async hash(devicePath: string, snapshot: CatalogSnapshot, relativePath: string): Promise<string> {
    const item = snapshot.items.find((candidate) =>
      candidate.files.some((file) => file.relativePath === relativePath)
    )
    if (!item)
      throw Object.assign(new Error('Catalog file not found'), { code: 'CATALOG_ITEM_NOT_FOUND' })
    const root = await captureSafeRoot(devicePath)
    return sha256File(await resolveInside(root, relativePath))
  }
}
