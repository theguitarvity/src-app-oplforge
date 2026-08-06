import { readdir, rm, stat } from 'node:fs/promises'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'

export interface LegacyStagingItem {
  itemId: string
  relativePath: string
  bytes: number
  kind: 'file' | 'directory'
}

export class LegacyStagingService {
  async inventory(devicePath: string): Promise<LegacyStagingItem[]> {
    const root = await captureSafeRoot(devicePath)
    const legacy = await resolveInside(root, '_OPL_FORGE_STAGING', true).catch(() => undefined)
    if (!legacy) return []
    const entries = await readdir(legacy, { withFileTypes: true }).catch(() => [])
    return Promise.all(
      entries.map(async (entry) => {
        const relativePath = `_OPL_FORGE_STAGING/${entry.name}`
        const info = await stat(await resolveInside(root, relativePath))
        return {
          itemId: Buffer.from(relativePath).toString('base64url'),
          relativePath,
          bytes: info.size,
          kind: entry.isDirectory() ? ('directory' as const) : ('file' as const)
        }
      })
    )
  }

  async cleanup(
    devicePath: string,
    relativePaths: string[],
    confirmation: string
  ): Promise<number> {
    if (confirmation !== 'LIMPAR STAGING LEGADO')
      throw Object.assign(new Error('Legacy staging cleanup confirmation required'), {
        code: 'CONFIRMATION_REQUIRED'
      })
    const root = await captureSafeRoot(devicePath)
    let removed = 0
    for (const relativePath of relativePaths) {
      if (!relativePath.startsWith('_OPL_FORGE_STAGING/'))
        throw Object.assign(new Error('Only inventoried legacy staging can be removed'), {
          code: 'PATH_ESCAPE'
        })
      await rm(await resolveInside(root, relativePath), { recursive: true })
      removed += 1
    }
    return removed
  }
}
