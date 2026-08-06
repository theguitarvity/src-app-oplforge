import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DownloadCacheCleanupService } from '@electron/services/downloads/download-cache-cleanup.service'
import type { DurableDownloadTask } from '@/types/opl-finalization'

const roots: string[] = []
afterEach(() =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

function task(id: string, phase: DurableDownloadTask['phase']): DurableDownloadTask {
  const now = new Date().toISOString()
  return {
    schemaVersion: 1,
    revision: 1,
    taskId: id,
    source: { kind: 'http', sourceRef: 'https://example.test/game.iso' },
    targetDeviceId: 'device',
    targetProfileId: 'profile',
    requestedTitle: 'Game',
    selectedFiles: [],
    phase,
    phaseProgress: 100,
    overallProgress: 100,
    transfer: {
      cacheKey: 'key',
      partialRelativePath: `${id}/payload.part`,
      bytesConfirmed: 4,
      resumeCapability: 'supported',
      checkpointedAt: now
    },
    attempt: 1,
    lastSequence: 1,
    createdAt: now,
    updatedAt: now
  }
}

describe('DownloadCacheCleanupService', () => {
  it('removes only the managed cache of a ready task', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'opl-cache-'))
    roots.push(root)
    await mkdir(path.join(root, 'ready-id'))
    await writeFile(path.join(root, 'ready-id', 'payload.part'), 'game')
    const result = await new DownloadCacheCleanupService(root).cleanupReady(
      task('ready-id', 'ready')
    )
    expect(result).toMatchObject({ removed: true, freedBytes: 4 })
    await expect(stat(path.join(root, 'ready-id'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves partial downloads and rejects paths owned by another task', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'opl-cache-'))
    roots.push(root)
    await mkdir(path.join(root, 'active-id'))
    await writeFile(path.join(root, 'active-id', 'payload.part'), 'keep')
    const service = new DownloadCacheCleanupService(root)
    expect(await service.cleanupReady(task('active-id', 'transferring'))).toMatchObject({
      removed: false
    })
    expect(await readFile(path.join(root, 'active-id', 'payload.part'), 'utf8')).toBe('keep')
    const mismatched = task('ready-id', 'ready')
    mismatched.transfer.partialRelativePath = 'active-id/payload.part'
    await expect(service.cleanupReady(mismatched)).rejects.toMatchObject({ code: 'PATH_ESCAPE' })
  })
})
