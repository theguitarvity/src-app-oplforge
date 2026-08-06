import type {
  DurableDownloadTask,
  PipelinePhase,
  SerializableTaskError
} from '../../../src/types/opl-finalization'

const transitions: Record<PipelinePhase, ReadonlySet<PipelinePhase>> = {
  queued: new Set(['probing', 'paused', 'cancelled', 'failed']),
  probing: new Set(['transferring', 'paused', 'cancelled', 'failed']),
  transferring: new Set(['paused', 'downloaded', 'cancelled', 'failed']),
  paused: new Set(['queued', 'probing', 'transferring', 'cancelled']),
  downloaded: new Set(['validating', 'cancelled', 'failed']),
  validating: new Set(['planning', 'failed', 'cancelled']),
  planning: new Set([
    'awaiting-confirmation',
    'installing',
    'waiting-device',
    'failed',
    'cancelled'
  ]),
  'awaiting-confirmation': new Set(['installing', 'cancelled', 'failed']),
  installing: new Set(['verifying', 'recovery-pending', 'failed', 'cancelled']),
  verifying: new Set(['cataloging', 'recovery-pending', 'failed']),
  cataloging: new Set(['queueing-art', 'ready', 'failed']),
  'queueing-art': new Set(['ready', 'failed']),
  'waiting-device': new Set(['planning', 'installing', 'cancelled']),
  'recovery-pending': new Set(['planning', 'installing', 'verifying', 'failed', 'cancelled']),
  failed: new Set([
    'queued',
    'probing',
    'validating',
    'planning',
    'installing',
    'verifying',
    'cataloging',
    'queueing-art',
    'cancelled'
  ]),
  ready: new Set(),
  cancelled: new Set()
}

const progressWindow: Record<PipelinePhase, [number, number]> = {
  queued: [0, 0],
  probing: [0, 2],
  transferring: [2, 62],
  paused: [0, 62],
  downloaded: [62, 62],
  validating: [62, 70],
  planning: [70, 75],
  'awaiting-confirmation': [75, 75],
  installing: [75, 90],
  verifying: [90, 96],
  cataloging: [96, 98],
  'queueing-art': [98, 99],
  ready: [100, 100],
  'waiting-device': [70, 75],
  failed: [0, 99],
  cancelled: [0, 99],
  'recovery-pending': [75, 96]
}

export function summarizeTaskProgress(phase: PipelinePhase, phaseProgress: number): number {
  if (phase === 'ready') return 100
  const [start, end] = progressWindow[phase]
  const normalized = Math.min(100, Math.max(0, phaseProgress)) / 100
  return Math.round((start + (end - start) * normalized) * 100) / 100
}

export function transitionDownloadTask(
  task: DurableDownloadTask,
  phase: PipelinePhase,
  options: { phaseProgress?: number; error?: SerializableTaskError; now?: Date } = {}
): DurableDownloadTask {
  if (phase !== task.phase && !transitions[task.phase].has(phase)) {
    throw Object.assign(new Error(`Invalid download transition: ${task.phase} -> ${phase}`), {
      code: 'INVALID_PHASE_TRANSITION'
    })
  }
  const phaseProgress = options.phaseProgress ?? (phase === 'ready' ? 100 : 0)
  return {
    ...task,
    phase,
    phaseProgress,
    overallProgress: summarizeTaskProgress(phase, phaseProgress),
    revision: task.revision + 1,
    lastError: options.error,
    updatedAt: (options.now ?? new Date()).toISOString()
  }
}
