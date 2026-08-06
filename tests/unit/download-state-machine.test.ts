import { describe, expect, it } from 'vitest'
import {
  transitionDownloadTask,
  summarizeTaskProgress
} from '@electron/services/downloads/download-state-machine'
import type { DurableDownloadTask } from '@/types/opl-finalization'

const task = (phase: DurableDownloadTask['phase']): DurableDownloadTask => ({
  schemaVersion: 1,
  revision: 0,
  taskId: 'task-1',
  source: { kind: 'http', sourceRef: 'opaque' },
  targetDeviceId: 'device-1',
  targetProfileId: 'opl-1',
  requestedTitle: 'Game',
  selectedFiles: [],
  phase,
  phaseProgress: 0,
  overallProgress: 0,
  transfer: {
    cacheKey: 'cache-1',
    partialRelativePath: 'task-1/payload.part',
    bytesConfirmed: 0,
    resumeCapability: 'unknown',
    checkpointedAt: new Date(0).toISOString()
  },
  attempt: 0,
  lastSequence: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
})

describe('download state machine', () => {
  it('prevents downloaded from skipping validation and becoming ready', () => {
    expect(() => transitionDownloadTask(task('downloaded'), 'ready')).toThrowError(
      expect.objectContaining({ code: 'INVALID_PHASE_TRANSITION' })
    )
  })

  it('accepts the verified finalization sequence and increments revision', () => {
    const phases: DurableDownloadTask['phase'][] = [
      'validating',
      'planning',
      'installing',
      'verifying',
      'cataloging',
      'queueing-art',
      'ready'
    ]
    const result = phases.reduce(
      (current, phase) => transitionDownloadTask(current, phase),
      task('downloaded')
    )
    expect(result.phase).toBe('ready')
    expect(result.revision).toBe(phases.length)
    expect(result.overallProgress).toBe(100)
  })

  it('weights progress by phase instead of presenting transfer completion as readiness', () => {
    expect(summarizeTaskProgress('transferring', 100)).toBeLessThan(70)
    expect(summarizeTaskProgress('ready', 100)).toBe(100)
  })
})
