import { app, ipcMain } from 'electron'
import { indexOplmArt } from '../services/art/oplm-art.service'
import { ArtSyncService } from '../services/art/art-sync.service'
import { getCatalogService } from '../services/catalog/catalog-runtime'
import { parseInput } from './schemas'
import { ArtIndexService } from '../services/art/art-index.service'
import { ArtSyncPlanService, type CreatedArtSyncPlan } from '../services/art/art-sync-plan.service'
import { ArtSyncJobService } from '../services/art/art-sync-job.service'
import { ArtCacheService } from '../services/art/art-cache.service'
import { copyFile, mkdir, readFile, readdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { deviceLocks } from '../services/persistence/device-lock.service'
import { finalArtName, validatePng } from '../services/art/art-validation.service'
import { cacheRemoteArtEntry, indexRemoteOplmArchive } from '../services/art/remote-zip-art.service'

const sync = new ArtSyncService()
let automaticSync: ((devicePath: string) => Promise<string | undefined>) | undefined
export function queueAutomaticArtSync(devicePath: string) {
  return automaticSync?.(devicePath) ?? Promise.resolve(undefined)
}
export function registerArtIpc() {
  const userData = app.getPath('userData')
  const index = new ArtIndexService(path.join(userData, 'opl-finalization', 'art-index.json'))
  const cache = new ArtCacheService(
    path.join(userData, 'opl-finalization', 'art-cache'),
    4 * 1024 * 1024 * 1024
  )
  const plans = new Map<string, CreatedArtSyncPlan>()
  const jobs = new ArtSyncJobService(
    path.join(userData, 'opl-finalization', 'art-jobs.json'),
    async (item, job) => {
      const asset = (await index.query({ gameIds: [item.gameId], types: [item.type], limit: 1 }))
        .items[0]
      if (!asset)
        throw Object.assign(new Error('Artwork is missing from the index'), {
          code: 'ART_SOURCE_UNAVAILABLE'
        })
      const mount = getCatalogService().mount(job.deviceId)
      if (!mount)
        throw Object.assign(new Error('Target device is not mounted'), { code: 'DEVICE_NOT_FOUND' })
      const consume = async (cached: string) =>
        deviceLocks.withLock(job.deviceId, undefined, async () => {
          const bytes = await readFile(cached)
          validatePng(bytes, `${item.gameId}_${item.type}.png`)
          const staging = path.join(mount, '.oplforge-staging', job.jobId, 'ART')
          await mkdir(staging, { recursive: true })
          await mkdir(path.join(mount, 'ART'), { recursive: true })
          const candidate = path.join(staging, finalArtName(item.gameId, item.type))
          await copyFile(cached, candidate)
          await rename(candidate, path.join(mount, 'ART', finalArtName(item.gameId, item.type)))
        })
      if (asset.archiveId)
        await consume(
          await cacheRemoteArtEntry(
            asset,
            path.join(userData, 'opl-finalization', 'art-entry-cache')
          )
        )
      else if (asset.directUrl) await cache.withReference(item.cacheKey, asset.directUrl, consume)
      else
        throw Object.assign(new Error('Indexed artwork has no usable source'), {
          code: 'ART_SOURCE_UNAVAILABLE'
        })
    },
    3
  )
  automaticSync = async (devicePath) => {
    await index.refresh(() => indexRemoteOplmArchive(), false)
    const snapshot = await getCatalogService().scan(devicePath)
    const types = ['ICO', 'COV', 'COV2', 'LAB', 'LGO', 'SCR', 'SCR2', 'BG'] as const
    const gameIds = [
      ...new Set(snapshot.items.flatMap((item) => (item.gameId ? [item.gameId] : [])))
    ]
    const assets = []
    let cursor: string | undefined
    do {
      const page = await index.query({ gameIds, types: [...types], limit: 500, cursor })
      assets.push(...page.items)
      cursor = page.nextCursor
    } while (cursor)
    const existing = new Set<string>()
    for (const name of await readdir(path.join(devicePath, 'ART')).catch(() => []))
      for (const gameId of gameIds)
        for (const type of types)
          if (name.toLowerCase() === finalArtName(gameId, type).toLowerCase())
            existing.add(`${gameId}:${type}`)
    const plan = new ArtSyncPlanService().create({
      deviceId: snapshot.deviceId,
      gameIds,
      types: [...types],
      replacePolicy: 'missing-only',
      assets,
      existing
    })
    plans.set(plan.summary.planId, plan)
    const job = await jobs.start(plan.summary.planId, snapshot.deviceId, plan.items)
    return job.jobId
  }
  ipcMain.handle('art:index', () => indexOplmArt())
  ipcMain.handle('art:plan', async (_event, input: { deviceId: string; snapshotId: string }) => {
    const parsed = parseInput('artPlan', input)
    const snapshot = await getCatalogService().snapshot(parsed.deviceId)
    const mount = getCatalogService().mount(parsed.deviceId)
    if (!snapshot || snapshot.snapshotId !== parsed.snapshotId || !mount)
      throw Object.assign(new Error('Catalog snapshot is stale or device removed'), {
        code: 'STALE_REVISION'
      })
    return sync.plan(mount, snapshot, await indexOplmArt())
  })
  ipcMain.handle('art:confirm', (_event, input: { operationId: string }) =>
    sync.confirm(parseInput('operationCancel', input).operationId)
  )
  ipcMain.handle('art:index:refresh', async (_event, input: unknown) => {
    const parsed = parseInput('artIndexRefresh', input)
    return index.refresh(() => indexRemoteOplmArchive(), parsed.force)
  })
  ipcMain.handle('art:index:query', (_event, input: unknown) =>
    index.query(parseInput('artIndexQuery', input))
  )
  ipcMain.handle('art:sync:plan', async (_event, input: unknown) => {
    const parsed = parseInput('artSyncPlanV2', input)
    const snapshot = await getCatalogService().snapshot(parsed.deviceId)
    if (!snapshot || snapshot.snapshotId !== parsed.catalogSnapshotId)
      throw Object.assign(new Error('Catalog snapshot is stale'), { code: 'STALE_REVISION' })
    const gameIds = [
      ...new Set(
        parsed.scope === 'library' || parsed.scope === 'missing'
          ? snapshot.items.flatMap((item) => (item.gameId ? [item.gameId] : []))
          : (parsed.gameIds ?? [])
      )
    ].slice(0, 500)
    const assets = []
    let cursor: string | undefined
    do {
      const page = await index.query({ gameIds, types: parsed.types, limit: 500, cursor })
      assets.push(...page.items)
      cursor = page.nextCursor
    } while (cursor)
    const mount = getCatalogService().mount(parsed.deviceId)
    const existing = new Set<string>()
    if (mount)
      for (const name of await readdir(path.join(mount, 'ART')).catch(() => []))
        for (const gameId of gameIds)
          for (const type of parsed.types)
            if (name.toLowerCase() === finalArtName(gameId, type).toLowerCase())
              existing.add(`${gameId}:${type}`)
    const plan = new ArtSyncPlanService().create({
      deviceId: parsed.deviceId,
      gameIds,
      types: parsed.types,
      replacePolicy: parsed.replacePolicy,
      assets,
      existing
    })
    plans.set(plan.summary.planId, plan)
    return plan.summary
  })
  ipcMain.handle('art:sync:start', (_event, input: unknown) => {
    const parsed = parseInput('artSyncStart', input)
    const plan = plans.get(parsed.planId)
    if (!plan || plan.summary.revision !== parsed.expectedRevision)
      throw Object.assign(new Error('Art plan is stale'), { code: 'STALE_REVISION' })
    if (
      plan.summary.replacePolicy === 'replace-all' &&
      parsed.confirmation !== 'SUBSTITUIR ARTES EXISTENTES'
    )
      throw Object.assign(new Error('Replacement confirmation required'), {
        code: 'CONFIRMATION_REQUIRED'
      })
    return jobs.start(plan.summary.planId, plan.summary.deviceId, plan.items)
  })
  ipcMain.handle('art:sync:get', (_event, input: unknown) =>
    jobs.get(parseInput('artSyncGet', input).jobId)
  )
  ipcMain.handle('art:sync:list', (_event, input: unknown) => {
    const parsed = parseInput('artSyncList', input)
    return jobs.list(parsed.cursor ? Number(parsed.cursor) : 0, parsed.limit)
  })
  ipcMain.handle('art:sync:pause', (_event, input: unknown) => {
    const parsed = parseInput('artSyncPause', input)
    return jobs.pause(parsed.jobId, parsed.expectedRevision)
  })
  ipcMain.handle('art:sync:resume', (_event, input: unknown) => {
    const parsed = parseInput('artSyncResume', input)
    return jobs.resume(parsed.jobId, parsed.expectedRevision)
  })
  ipcMain.handle('art:sync:cancel', (_event, input: unknown) => {
    const parsed = parseInput('artSyncCancel', input)
    return jobs.cancel(parsed.jobId, parsed.expectedRevision)
  })
  ipcMain.handle('art:sync:retry-failed', (_event, input: unknown) => {
    const parsed = parseInput('artSyncRetryFailed', input)
    return jobs.retryFailed(parsed.jobId, parsed.expectedRevision)
  })
}
