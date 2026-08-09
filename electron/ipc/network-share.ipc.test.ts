import { describe, expect, it, vi } from 'vitest'
import type { IpcMain } from 'electron'
import { registerNetworkShareIpc, NETWORK_SHARE_CHANNELS } from './network-share.ipc'
import type { NetworkShareService } from '../services/network-share/network-share.service'

function fakeIpcMain() {
  const handlers = new Map<string, (event: unknown, input?: unknown) => unknown>()
  const ipcMain = {
    handle: (channel: string, fn: (event: unknown, input?: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  } as unknown as IpcMain
  return {
    ipcMain,
    invoke: (channel: string, input?: unknown) => handlers.get(channel)!({}, input)
  }
}

describe('network-share IPC error serialization', () => {
  it('surfaces a specific, actionable message for invalid input instead of a generic fallback', async () => {
    const { ipcMain, invoke } = fakeIpcMain()
    const service = { onEvent: () => () => undefined } as unknown as NetworkShareService // save-config never reaches the service when validation fails first
    registerNetworkShareIpc(ipcMain, service, () => undefined)

    // Missing/empty username — the exact shape the UI sends when the field is left blank.
    await expect(
      invoke(NETWORK_SHARE_CHANNELS.saveConfig, {
        libraryRootPath: '/media/ps2',
        enabledProtocols: ['smb'],
        shareName: 'OPL Forge',
        username: '',
        autoStartOnLaunch: false
      })
    ).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      message: expect.stringMatching(/username/i)
    })
  })

  it('rejects unknown extra fields with INVALID_INPUT, not a generic failure', async () => {
    const { ipcMain, invoke } = fakeIpcMain()
    const service = { onEvent: () => () => undefined } as unknown as NetworkShareService
    registerNetworkShareIpc(ipcMain, service, () => undefined)

    await expect(
      invoke(NETWORK_SHARE_CHANNELS.saveConfig, {
        libraryRootPath: '/media/ps2',
        enabledProtocols: ['smb'],
        shareName: 'OPL Forge',
        username: 'tester',
        autoStartOnLaunch: false,
        unexpectedField: true
      })
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('still falls back to a generic message for truly unexpected errors', async () => {
    const { ipcMain, invoke } = fakeIpcMain()
    const service = {
      onEvent: () => () => undefined,
      getConfig: vi.fn().mockRejectedValue(new TypeError('boom'))
    } as unknown as NetworkShareService
    registerNetworkShareIpc(ipcMain, service, () => undefined)

    await expect(invoke(NETWORK_SHARE_CHANNELS.getConfig)).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Network sharing request failed'
    })
  })
})
