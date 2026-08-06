import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DownloadTaskStore } from '@electron/services/downloads/download-task.store'
import type { DurableDownloadTask } from '@/types/opl-finalization'

const roots: string[] = []
afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
const task = (): DurableDownloadTask => ({
  schemaVersion: 1,
  revision: 0,
  taskId: 't1',
  source: { kind: 'http', sourceRef: 'opaque' },
  targetDeviceId: 'd1',
  targetProfileId: 'p1',
  requestedTitle: 'Game',
  selectedFiles: [],
  phase: 'transferring',
  phaseProgress: 1,
  overallProgress: 1,
  transfer: {
    cacheKey: 'c1',
    partialRelativePath: 't1/payload.part',
    bytesConfirmed: 0,
    resumeCapability: 'supported',
    checkpointedAt: new Date(0).toISOString()
  },
  attempt: 0,
  lastSequence: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
})

describe('DownloadTaskStore', () => {
  it('coalesces checkpoints for one second unless 16 MiB advanced', async () => {
    vi.useFakeTimers()
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-store-'))
    roots.push(root)
    const store = new DownloadTaskStore(path.join(root, 'tasks.json'))
    await store.put(task())
    const first = store.checkpoint('t1', 1024)
    const second = store.checkpoint('t1', 2048)
    expect((await store.get('t1'))?.transfer.bytesConfirmed).toBe(0)
    await vi.advanceTimersByTimeAsync(1000)
    await Promise.all([first, second])
    expect((await store.get('t1'))?.transfer.bytesConfirmed).toBe(2048)
    await store.checkpoint('t1', 16 * 1024 * 1024 + 2048)
    expect((await store.get('t1'))?.transfer.bytesConfirmed).toBe(16 * 1024 * 1024 + 2048)
  })

  it('reconstructs a revisioned snapshot after reopening', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-reopen-'))
    roots.push(root)
    const file = path.join(root, 'tasks.json')
    const first = new DownloadTaskStore(file)
    await first.put(task())
    const second = new DownloadTaskStore(file)
    await expect(second.list()).resolves.toMatchObject({ items: [{ taskId: 't1' }], revision: 1 })
  })

  it('replaces the persisted task history atomically', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'task-clear-'))
    roots.push(root)
    const store = new DownloadTaskStore(path.join(root, 'tasks.json'))
    await store.put(task())
    await store.replaceAll([])
    await expect(store.list()).resolves.toMatchObject({ items: [], revision: 2 })
  })
})
