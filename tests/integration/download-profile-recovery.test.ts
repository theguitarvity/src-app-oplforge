import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DownloadCoordinatorService } from '@electron/services/downloads/download-coordinator.service'
import { DownloadTaskStore } from '@electron/services/downloads/download-task.store'
import {
  DEFAULT_INSTALLATION_PROFILE,
  chooseInstallationFormat
} from '@electron/services/installation/installation-planner.service'
import type { DurableDownloadTask } from '@/types/opl-finalization'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('default OPL planning profile recovery', () => {
  it('supports the formats required by the standard download pipeline', () => {
    expect(DEFAULT_INSTALLATION_PROFILE.id).toBe('opl-default')
    expect(DEFAULT_INSTALLATION_PROFILE.capabilities).toMatchObject({
      iso: true,
      zso: true,
      usbExtreme: true
    })
    expect(
      chooseInstallationFormat({
        extension: '.iso',
        sourceBytes: 0x1_0000_0000,
        fileSystem: 'FAT32',
        zsoSupported: DEFAULT_INSTALLATION_PROFILE.capabilities.zso
      })
    ).toBe('USBExtreme')
  })

  it('requeues tasks previously blocked only by PROFILE_NOT_FOUND', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'profile-recovery-'))
    roots.push(root)
    const store = new DownloadTaskStore(path.join(root, 'tasks.json'))
    const now = new Date().toISOString()
    const task = {
      schemaVersion: 1,
      revision: 4,
      taskId: 'blocked',
      source: { kind: 'http', sourceRef: 'https://example.test/game.iso' },
      targetDeviceId: 'device',
      targetProfileId: 'opl-default',
      requestedTitle: 'Game',
      selectedFiles: [],
      phase: 'failed',
      phaseProgress: 100,
      overallProgress: 65,
      transfer: {
        cacheKey: 'cache',
        partialRelativePath: 'blocked/payload.part',
        bytesConfirmed: 100,
        totalBytes: 100,
        resumeCapability: 'supported',
        sourceFingerprint: 'fingerprint',
        checkpointedAt: now
      },
      attempt: 1,
      lastSequence: 0,
      lastError: {
        code: 'PROFILE_NOT_FOUND',
        message: 'old blocker',
        retryable: false,
        phase: 'planning'
      },
      createdAt: now,
      updatedAt: now
    } as DurableDownloadTask
    await store.put(task)
    const coordinator = new DownloadCoordinatorService(undefined, store)
    await coordinator.initialize()
    await expect(coordinator.get(task.taskId)).resolves.toMatchObject({
      phase: 'queued',
      revision: 5,
      lastError: undefined
    })
  })

  it('requeues an ISO rejected because its cache file used the .part suffix', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'format-recovery-'))
    roots.push(root)
    const store = new DownloadTaskStore(path.join(root, 'tasks.json'))
    const now = new Date().toISOString()
    const task = {
      schemaVersion: 1,
      revision: 2,
      taskId: 'format-blocked',
      source: {
        kind: 'http',
        sourceRef: 'https://example.test/game.iso',
        originalFileName: 'Real Game.iso'
      },
      targetDeviceId: 'device',
      targetProfileId: 'opl-default',
      requestedTitle: 'Game',
      selectedFiles: [],
      phase: 'failed',
      phaseProgress: 100,
      overallProgress: 65,
      transfer: {
        cacheKey: 'cache',
        partialRelativePath: 'format-blocked/payload.part',
        bytesConfirmed: 100,
        totalBytes: 100,
        resumeCapability: 'supported',
        sourceFingerprint: 'fingerprint',
        checkpointedAt: now
      },
      attempt: 1,
      lastSequence: 0,
      lastError: {
        code: 'UNSUPPORTED_FORMAT',
        message: 'Only ISO and ZSO sources are supported',
        retryable: true,
        phase: 'planning'
      },
      createdAt: now,
      updatedAt: now
    } as DurableDownloadTask
    await store.put(task)
    const coordinator = new DownloadCoordinatorService(undefined, store)
    await coordinator.initialize()
    await expect(coordinator.get(task.taskId)).resolves.toMatchObject({
      phase: 'queued',
      lastError: undefined
    })
  })

  it('wakes the worker when a failed task is retried', async () => {
    const coordinator = new DownloadCoordinatorService()
    const task = await coordinator.enqueue({
      source: { kind: 'http', url: 'https://example.test/game.iso' },
      deviceId: 'device',
      profileId: 'opl-default'
    })
    await coordinator.fail(task.taskId, Object.assign(new Error('temporary'), { code: 'NETWORK' }))
    await coordinator.start(async (queued) => {
      await coordinator.process(
        queued.taskId,
        async () => undefined,
        async () => {
          for (const phase of [
            'validating',
            'planning',
            'installing',
            'verifying',
            'cataloging',
            'queueing-art',
            'ready'
          ] as const)
            await coordinator.advance(queued.taskId, phase, 100)
        }
      )
    })
    const failed = await coordinator.get(task.taskId)
    await coordinator.retry({ taskId: task.taskId, expectedRevision: failed!.revision })
    await expect.poll(async () => (await coordinator.get(task.taskId))?.phase).toBe('ready')
  })
})
