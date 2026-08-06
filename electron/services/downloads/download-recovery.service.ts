import type { DurableDownloadTask, PipelinePhase } from '../../../src/types/opl-finalization'
import type { DownloadTaskStore } from './download-task.store'

export type DeviceResolver = (deviceId: string) => Promise<string | undefined>

export class DownloadRecoveryService {
  constructor(
    private readonly store: DownloadTaskStore,
    private readonly resolveDevice: DeviceResolver
  ) {}

  async reconcile(): Promise<DurableDownloadTask[]> {
    const snapshot = await this.store.list()
    const reconciled: DurableDownloadTask[] = []
    for (const task of snapshot.items) {
      if (!this.isActive(task.phase)) continue
      const devicePath = await this.resolveDevice(task.targetDeviceId)
      const phase: PipelinePhase = devicePath ? this.safeRestartPhase(task.phase) : 'waiting-device'
      const updated: DurableDownloadTask = {
        ...task,
        phase,
        phaseProgress: 0,
        revision: task.revision + 1,
        updatedAt: new Date().toISOString(),
        lastError: devicePath
          ? undefined
          : {
              code: 'DEVICE_NOT_FOUND',
              message: 'Target device is not currently mounted',
              retryable: true,
              phase: task.phase
            }
      }
      await this.store.put(updated)
      reconciled.push(updated)
    }
    return reconciled
  }

  private isActive(phase: PipelinePhase): boolean {
    return !['ready', 'failed', 'cancelled', 'paused', 'waiting-device'].includes(phase)
  }
  private safeRestartPhase(phase: PipelinePhase): PipelinePhase {
    if (['probing', 'transferring', 'downloaded'].includes(phase)) return 'queued'
    if (['installing', 'verifying', 'cataloging', 'queueing-art'].includes(phase))
      return 'recovery-pending'
    return phase
  }
}
