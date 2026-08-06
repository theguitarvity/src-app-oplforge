import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import type { CatalogSnapshot, OplProfile } from '../../../src/types/opl'
import { CatalogScannerService } from './catalog-scanner.service'
import { CatalogStoreService } from './catalog-store.service'

export function diffSnapshots(previous: CatalogSnapshot | undefined, current: CatalogSnapshot) {
  const before = new Map((previous?.items ?? []).map((item) => [item.relativePath, item]))
  const after = new Map(current.items.map((item) => [item.relativePath, item]))
  return {
    added: current.items.filter((item) => !before.has(item.relativePath)),
    removed: (previous?.items ?? []).filter((item) => !after.has(item.relativePath)),
    changed: current.items.filter((item) => {
      const prior = before.get(item.relativePath)
      return Boolean(
        prior && prior.files[0]?.structuralSignature !== item.files[0]?.structuralSignature
      )
    })
  }
}

export class CatalogService {
  private readonly active = new Map<string, AbortController>()
  private readonly mounts = new Map<string, string>()
  constructor(
    private readonly store: CatalogStoreService,
    private readonly scanner: CatalogScannerService
  ) {}
  deviceId(devicePath: string): string {
    return createHash('sha256').update(path.resolve(devicePath)).digest('hex').slice(0, 24)
  }
  mount(deviceId: string): string | undefined {
    return this.mounts.get(deviceId)
  }
  snapshot(deviceId: string) {
    return this.store.snapshot(deviceId)
  }
  cancel(scanId: string): void {
    this.active.get(scanId)?.abort()
  }

  async scan(
    devicePath: string,
    profile?: OplProfile,
    publish?: (snapshot: CatalogSnapshot) => void
  ): Promise<CatalogSnapshot> {
    const deviceId = this.deviceId(devicePath)
    const scanId = randomUUID()
    const controller = new AbortController()
    this.active.set(scanId, controller)
    this.mounts.set(deviceId, path.resolve(devicePath))
    const prior = await this.store.snapshot(deviceId)
    const provisional: CatalogSnapshot = {
      snapshotId: randomUUID(),
      scanId,
      deviceId,
      profileId: profile?.id,
      status: 'provisional',
      capturedAt: new Date().toISOString(),
      items: [],
      findings: [],
      supersedesSnapshotId: prior?.snapshotId,
      revision: (prior?.revision ?? 0) + 1
    }
    publish?.(provisional)
    try {
      const result = await this.scanner.scan(devicePath, deviceId, profile, controller.signal)
      const byGameId = new Map<string, number>()
      for (const item of result.items)
        if (item.gameId) byGameId.set(item.gameId, (byGameId.get(item.gameId) ?? 0) + 1)
      for (const item of result.items)
        if (item.gameId && (byGameId.get(item.gameId) ?? 0) > 1) {
          item.classification = item.classification === 'invalid' ? 'invalid' : 'warning'
          item.findings.push({
            code: 'DUPLICATE_GAME_ID',
            severity: 'warning',
            state: 'failed',
            message: `Duplicate Game ID ${item.gameId}`
          })
        }
      for (const item of result.items) {
        const file = item.files[0]
        if (!file) continue
        const override = await this.store.override(
          deviceId,
          file.relativePath,
          file.sizeBytes,
          file.structuralSignature ?? ''
        )
        if (override) {
          item.gameId = override.gameId
          item.gameIdSource = 'manual'
        }
      }
      const complete = {
        ...provisional,
        status: 'complete' as const,
        items: result.items,
        findings: result.findings,
        capturedAt: new Date().toISOString()
      }
      diffSnapshots(prior, complete)
      await this.store.publish(complete)
      publish?.(complete)
      return complete
    } catch (error) {
      const failed = {
        ...provisional,
        status: 'failed' as const,
        findings: [
          {
            code: (error as { code?: string }).code ?? 'SCAN_FAILED',
            severity: 'error' as const,
            state: 'failed' as const,
            message: (error as Error).message
          }
        ]
      }
      publish?.(failed)
      throw error
    } finally {
      this.active.delete(scanId)
    }
  }

  async override(input: {
    deviceId: string
    relativePath: string
    size: number
    fingerprint: string
    gameId: string
  }) {
    await this.store.setOverride({ ...input, createdAt: new Date().toISOString() })
  }
}
