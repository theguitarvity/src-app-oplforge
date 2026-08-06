import { mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  ArtAsset,
  ArtAssetType,
  ArtSyncEntryResult,
  ArtSyncPlan,
  CatalogSnapshot
} from '../../../src/types/opl'
import { artStatus, finalArtName, validatePng } from './art-validation.service'

export class ArtSyncService {
  private plans = new Map<string, ArtSyncPlan>()
  constructor(private readonly request: typeof fetch = fetch) {}
  async plan(
    devicePath: string,
    snapshot: CatalogSnapshot,
    assets: ArtAsset[]
  ): Promise<ArtSyncPlan> {
    const artDir = path.join(devicePath, 'ART')
    let names: string[] = []
    try {
      names = await readdir(artDir)
    } catch {
      /* absent ART is allowed before confirmation */
    }
    const entries = await Promise.all(
      snapshot.items
        .filter((item) => item.kind === 'game' && item.gameId)
        .map(async (item) => {
          const gameId = item.gameId!
          const available = assets.filter((asset) => asset.gameId === gameId)
          const existing: ArtAssetType[] = []
          for (const type of available.map((asset) => asset.type))
            if (names.includes(finalArtName(gameId, type)))
              try {
                validatePng(
                  await readFile(path.join(artDir, finalArtName(gameId, type))),
                  finalArtName(gameId, type)
                )
                existing.push(type)
              } catch {
                /* invalid existing art is not trusted or overwritten until confirmation */
              }
          return {
            itemId: item.itemId,
            gameId,
            gameIdSource: item.gameIdSource,
            title: item.title,
            available,
            existing,
            destination: artDir
          }
        })
    )
    const plan = { id: randomUUID(), devicePath, snapshotId: snapshot.snapshotId, entries }
    this.plans.set(plan.id, plan)
    return plan
  }
  async confirm(planId: string): Promise<ArtSyncEntryResult[]> {
    const plan = this.plans.get(planId)
    if (!plan) throw Object.assign(new Error('Art plan not found'), { code: 'PLAN_NOT_FOUND' })
    const staging = path.join(plan.devicePath, '.oplforge-staging', plan.id, 'ART')
    await mkdir(staging, { recursive: true })
    await mkdir(path.join(plan.devicePath, 'ART'), { recursive: true })
    const results: ArtSyncEntryResult[] = []
    try {
      for (const entry of plan.entries) {
        const downloaded: ArtAssetType[] = []
        const errors: ArtSyncEntryResult['errors'] = []
        for (const asset of entry.available.filter(
          (candidate) => !entry.existing.includes(candidate.type)
        ))
          try {
            if (asset.url.startsWith('zip+'))
              throw Object.assign(
                new Error('Archive assets require the durable art job pipeline'),
                { code: 'DURABLE_ART_JOB_REQUIRED' }
              )
            const response = await this.request(asset.url)
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const bytes = new Uint8Array(await response.arrayBuffer())
            if (asset.sizeBytes && bytes.byteLength !== asset.sizeBytes)
              throw new Error('Size differs from source index')
            validatePng(bytes, asset.name)
            const staged = path.join(staging, finalArtName(entry.gameId, asset.type))
            const handle = await open(staged, 'wx', 0o600)
            try {
              await handle.writeFile(bytes)
              await handle.sync()
            } finally {
              await handle.close()
            }
            await rename(
              staged,
              path.join(entry.destination, finalArtName(entry.gameId, asset.type))
            )
            downloaded.push(asset.type)
          } catch (error) {
            errors.push({ type: asset.type, message: (error as Error).message })
          }
        const installed = [...entry.existing, ...downloaded]
        results.push({
          gameId: entry.gameId,
          found: entry.available.map((asset) => asset.type),
          downloaded,
          existing: entry.existing,
          errors,
          destination: entry.destination,
          status: artStatus(
            entry.available.map((asset) => asset.type),
            installed
          )
        })
      }
      this.plans.delete(planId)
      return results
    } finally {
      await rm(path.dirname(staging), { recursive: true, force: true })
    }
  }
}
