import { beforeEach, describe, expect, it } from 'vitest'
import { useDownloadStore } from './download-store'
import type { DurableDownloadTaskSummary, PipelineEvent } from '@/types/opl-finalization'

const task = {
  taskId: 't1',
  revision: 2,
  phase: 'transferring',
  requestedTitle: 'Game',
  transfer: { bytesConfirmed: 10 },
  lastSequence: 0
} as DurableDownloadTaskSummary
const event = (sequence: number, revision = sequence + 2): PipelineEvent => ({
  operationId: 't1',
  sequence,
  revision,
  kind: 'download',
  phase: 'transferring',
  progress: sequence * 10,
  message: 'progress',
  timestamp: new Date(sequence).toISOString()
})

beforeEach(() =>
  useDownloadStore.setState({ tasks: {}, queueRevision: 0, lastSequenceByOperation: {} })
)
describe('durable download UI projection', () => {
  it('rebuilds authority from a snapshot and ignores stale events', () => {
    useDownloadStore.getState().setSnapshot({ items: [task], revision: 7 })
    useDownloadStore.getState().applyEvent(event(1, 1))
    expect(useDownloadStore.getState().tasks.t1.revision).toBe(2)
    expect(useDownloadStore.getState().queueRevision).toBe(7)
  })
  it('detects event gaps so the caller can refetch after reload', () => {
    useDownloadStore.getState().setSnapshot({ items: [task], revision: 7 })
    expect(useDownloadStore.getState().applyEvent(event(1))).toBe(false)
    expect(useDownloadStore.getState().applyEvent(event(3))).toBe(true)
    expect(useDownloadStore.getState().tasks.t1.lastSequence).toBe(3)
  })
})
