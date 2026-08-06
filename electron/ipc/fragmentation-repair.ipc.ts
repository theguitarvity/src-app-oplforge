import { BrowserWindow, type IpcMain } from 'electron'
import type { RepairEvent, SerializableError } from '../../src/types/opl'
import type { FragmentationRepairRuntime } from '../services/fragmentation-repair/runtime'
import { parseInput } from './schemas'

export const FRAGMENTATION_REPAIR_CHANNELS = {
  inventory: 'fragmentation-repair:inventory',
  diagnose: 'fragmentation-repair:diagnose',
  getCurrentDiagnosis: 'fragmentation-repair:get-current-diagnosis',
  cancelDiagnosis: 'fragmentation-repair:cancel-diagnosis',
  plan: 'fragmentation-repair:plan',
  confirm: 'fragmentation-repair:confirm',
  cancel: 'fragmentation-repair:cancel',
  getOperation: 'fragmentation-repair:get-operation',
  getReport: 'fragmentation-repair:get-report',
  getReportByOperation: 'fragmentation-repair:get-report-by-operation',
  listRecovery: 'fragmentation-repair:list-recovery',
  resolveRecovery: 'fragmentation-repair:resolve-recovery',
  event: 'fragmentation-repair:event'
} as const

const SAFE_CODES = new Set([
  'INVALID_INPUT',
  'INVALID_DEVICE_ROOT',
  'DEVICE_CHANGED',
  'DEVICE_INACCESSIBLE',
  'CAPABILITY_UNAVAILABLE',
  'DIAGNOSTIC_NOT_FOUND',
  'STALE_REVISION',
  'INVALID_SELECTION',
  'NO_ELIGIBLE_GAMES',
  'CONFIRMATION_REQUIRED',
  'PLAN_NOT_FOUND',
  'PLAN_ALREADY_USED',
  'SOURCE_CHANGED',
  'FILE_LOCKED',
  'INSUFFICIENT_SPACE',
  'HASH_MISMATCH',
  'STRUCTURE_INVALID',
  'STILL_FRAGMENTED',
  'CANCELLED',
  'ROLLBACK_FAILED',
  'MANUAL_RECOVERY_REQUIRED'
])

const RETRYABLE_CODES = new Set([
  'DEVICE_CHANGED',
  'DEVICE_INACCESSIBLE',
  'STALE_REVISION',
  'SOURCE_CHANGED',
  'FILE_LOCKED',
  'INSUFFICIENT_SPACE',
  'HASH_MISMATCH',
  'STILL_FRAGMENTED',
  'CANCELLED'
])

export function serializeFragmentationRepairError(error: unknown): SerializableError {
  const candidate = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
  const proposedCode = typeof candidate.code === 'string' ? candidate.code : 'INTERNAL_ERROR'
  const code = SAFE_CODES.has(proposedCode) ? proposedCode : 'INTERNAL_ERROR'
  const proposedMessage = typeof candidate.message === 'string' ? candidate.message : ''
  const sensitiveMessage =
    /(?:[A-Za-z]:[\\/]|\/(?:media|mnt|run|home|Users|Volumes|tmp)\/)|token|secret|authorization|cookie/i.test(
      proposedMessage
    )
  return {
    code,
    message:
      code === 'INTERNAL_ERROR'
        ? 'Fragmentation repair failed unexpectedly'
        : proposedMessage.length > 0 && proposedMessage.length <= 500 && !sensitiveMessage
          ? proposedMessage
          : 'Fragmentation repair request failed',
    retryable: RETRYABLE_CODES.has(code)
  }
}

export function registerFragmentationRepairIpc(
  ipcMain: IpcMain,
  runtime: FragmentationRepairRuntime,
  publish: (event: RepairEvent) => void = (event) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(FRAGMENTATION_REPAIR_CHANNELS.event, event)
  }
): void {
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.inventory, async (_event, input: unknown) => {
    try {
      return await runtime.diagnostic.inventory(
        parseInput('fragmentationInventory', input).devicePath
      )
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.diagnose, async (_event, input: unknown) => {
    try {
      return await runtime.diagnostic.diagnose(parseInput('fragmentationDiagnose', input), publish)
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(
    FRAGMENTATION_REPAIR_CHANNELS.getCurrentDiagnosis,
    async (_event, input: unknown) => {
      try {
        return await runtime.diagnostic.getCurrent(
          parseInput('fragmentationGetCurrentDiagnosis', input).devicePath
        )
      } catch (error) {
        throw controlledError(error)
      }
    }
  )
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.cancelDiagnosis, (_event, input: unknown) => {
    try {
      runtime.diagnostic.cancel(parseInput('fragmentationCancelDiagnosis', input).operationId)
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.plan, async (_event, input: unknown) => {
    try {
      return await runtime.plan.create(parseInput('fragmentationPlan', input))
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.confirm, async (_event, input: unknown) => {
    try {
      return await runtime.repair.confirm(parseInput('fragmentationConfirm', input), publish)
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.cancel, (_event, input: unknown) => {
    try {
      runtime.repair.cancel(parseInput('fragmentationCancel', input).operationId)
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.getOperation, (_event, input: unknown) =>
    runtime.repair.getOperation(parseInput('fragmentationGetOperation', input).operationId)
  )
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.getReport, (_event, input: unknown) =>
    runtime.repair.getReport(parseInput('fragmentationGetReport', input).reportId)
  )
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.getReportByOperation, (_event, input: unknown) =>
    runtime.repair.getReportByOperation(
      parseInput('fragmentationGetReportByOperation', input).operationId
    )
  )
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.listRecovery, async (_event, input: unknown) => {
    try {
      return await runtime.recovery.reconcile(
        parseInput('fragmentationListRecovery', input).deviceId
      )
    } catch (error) {
      throw controlledError(error)
    }
  })
  ipcMain.handle(FRAGMENTATION_REPAIR_CHANNELS.resolveRecovery, async (_event, input: unknown) => {
    try {
      return await runtime.recovery.resolve(parseInput('fragmentationResolveRecovery', input))
    } catch (error) {
      throw controlledError(error)
    }
  })
}

function controlledError(error: unknown): Error {
  const safe = serializeFragmentationRepairError(error)
  return Object.assign(new Error(safe.message), safe)
}
