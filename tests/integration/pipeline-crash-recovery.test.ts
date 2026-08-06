import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { DownloadRecoveryService } from '@electron/services/downloads/download-recovery.service'
import { DownloadTaskStore } from '@electron/services/downloads/download-task.store'
import type { DurableDownloadTask } from '@/types/opl-finalization'

const run = promisify(execFile)
const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('pipeline crash recovery', () => {
  it('reconciles an abruptly persisted active task to waiting-device when its volume is absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'pipeline-crash-'))
    roots.push(root)
    const file = path.join(root, 'tasks.json')
    const task: DurableDownloadTask = {
      schemaVersion: 1,
      revision: 2,
      taskId: 't1',
      source: { kind: 'http', sourceRef: 'opaque' },
      targetDeviceId: 'missing-device',
      targetProfileId: 'p1',
      requestedTitle: 'Game',
      selectedFiles: [],
      phase: 'installing',
      phaseProgress: 10,
      overallProgress: 77,
      transfer: {
        cacheKey: 'c1',
        partialRelativePath: 't1/payload.part',
        bytesConfirmed: 4096,
        resumeCapability: 'supported',
        checkpointedAt: new Date(0).toISOString()
      },
      attempt: 0,
      lastSequence: 2,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString()
    }
    const script =
      "const fs=require('fs');const p=process.argv[1],t=JSON.parse(process.argv[2]);fs.mkdirSync(require('path').dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify({schemaVersion:1,revision:1,updatedAt:new Date().toISOString(),data:{[t.taskId]:t}}));process.exit(91)"
    await expect(
      run(process.execPath, ['-e', script, file, JSON.stringify(task)])
    ).rejects.toMatchObject({ code: 91 })
    expect(JSON.parse(await readFile(file, 'utf8')).data.t1.phase).toBe('installing')
    const store = new DownloadTaskStore(file)
    const recovery = new DownloadRecoveryService(store, async () => undefined)
    await recovery.reconcile()
    expect((await store.get('t1'))?.phase).toBe('waiting-device')
  })
})
