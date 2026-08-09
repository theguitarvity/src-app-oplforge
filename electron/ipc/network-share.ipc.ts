import { BrowserWindow, type IpcMain } from 'electron'
import { ZodError } from 'zod'
import type { NetworkShareEvent, SerializableError } from '../../src/types/opl'
import {
  NetworkShareServiceError,
  type NetworkShareService
} from '../services/network-share/network-share.service'
import { parseInput } from './schemas'

export const NETWORK_SHARE_CHANNELS = {
  getConfig: 'network-share:get-config',
  saveConfig: 'network-share:save-config',
  acknowledgeWriteAccess: 'network-share:acknowledge-write-access',
  start: 'network-share:start',
  stop: 'network-share:stop',
  getStatus: 'network-share:get-status',
  getSetupInstructions: 'network-share:get-setup-instructions',
  event: 'network-share:event'
} as const

const SAFE_CODES = new Set([
  'INVALID_INPUT',
  'DEVICE_NOT_SELECTED',
  'LIBRARY_STRUCTURE_INVALID',
  'PORT_IN_USE',
  'BIND_FAILED',
  'ALREADY_RUNNING',
  'WRITE_ACCESS_NOT_ACKNOWLEDGED',
  'SERVICE_NOT_RUNNING',
  'SECRET_STORAGE_UNAVAILABLE'
])

function serializeError(error: unknown): SerializableError {
  if (error instanceof NetworkShareServiceError) {
    return {
      code: SAFE_CODES.has(error.code) ? error.code : 'INTERNAL_ERROR',
      message: error.message,
      retryable: error.code === 'PORT_IN_USE' || error.code === 'BIND_FAILED'
    }
  }
  if (error instanceof ZodError) {
    const [firstIssue] = error.issues
    const field = firstIssue?.path.join('.') || 'entrada'
    return {
      code: 'INVALID_INPUT',
      message: firstIssue ? `Campo inválido: ${field} — ${firstIssue.message}` : 'Entrada inválida',
      retryable: false
    }
  }
  const candidate = error && typeof error === 'object' ? (error as Record<string, unknown>) : {}
  const code =
    typeof candidate.code === 'string' && SAFE_CODES.has(candidate.code)
      ? candidate.code
      : 'INTERNAL_ERROR'
  return {
    code,
    message:
      code === 'INTERNAL_ERROR' ? 'Network sharing request failed' : String(candidate.message),
    retryable: false
  }
}

function controlledError(error: unknown): Error {
  const safe = serializeError(error)
  return Object.assign(new Error(safe.message), safe)
}

export function registerNetworkShareIpc(
  ipcMain: IpcMain,
  service: NetworkShareService,
  publish: (event: NetworkShareEvent) => void = (event) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send(NETWORK_SHARE_CHANNELS.event, event)
  }
): void {
  service.onEvent(publish)

  ipcMain.handle(NETWORK_SHARE_CHANNELS.getConfig, async () => {
    try {
      return await service.getConfig()
    } catch (error) {
      throw controlledError(error)
    }
  })

  ipcMain.handle(NETWORK_SHARE_CHANNELS.saveConfig, async (_event, input: unknown) => {
    try {
      return await service.saveConfig(parseInput('networkShareSaveConfig', input))
    } catch (error) {
      throw controlledError(error)
    }
  })

  ipcMain.handle(NETWORK_SHARE_CHANNELS.acknowledgeWriteAccess, async () => {
    try {
      return await service.acknowledgeWriteAccess()
    } catch (error) {
      throw controlledError(error)
    }
  })

  ipcMain.handle(NETWORK_SHARE_CHANNELS.start, async () => {
    try {
      return await service.start()
    } catch (error) {
      throw controlledError(error)
    }
  })

  ipcMain.handle(NETWORK_SHARE_CHANNELS.stop, async () => {
    try {
      return await service.stop()
    } catch (error) {
      throw controlledError(error)
    }
  })

  ipcMain.handle(NETWORK_SHARE_CHANNELS.getStatus, () => service.getStatus())

  ipcMain.handle(NETWORK_SHARE_CHANNELS.getSetupInstructions, async (_event, input: unknown) => {
    try {
      const { protocol } = parseInput('networkShareGetSetupInstructions', input)
      return await service.getSetupInstructions(protocol)
    } catch (error) {
      throw controlledError(error)
    }
  })
}
