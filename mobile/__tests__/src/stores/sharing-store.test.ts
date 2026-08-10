jest.mock('../../../src/native/SharingModule', () => ({
  __esModule: true,
  getSession: jest.fn(),
  saveCredentials: jest.fn(),
  acknowledgeWriteAccess: jest.fn(),
  startSharing: jest.fn(),
  stopSharing: jest.fn(),
  onSharingSessionEvent: jest.fn().mockReturnValue(() => undefined),
  SharingModuleError: class SharingModuleError extends Error {
    code: string
    constructor(error: { code: string; message: string }) {
      super(error.message)
      this.code = error.code
    }
  }
}))

import { useSharingStore } from '../../../src/stores/sharing-store'
import * as SharingModule from '../../../src/native/SharingModule'

const mockSharingModule = SharingModule as unknown as Record<string, jest.Mock>

// Captured immediately at module-load time (before any beforeEach's
// jest.clearAllMocks() would otherwise wipe this call record) — sharing-store.ts
// subscribes to onSharingSessionEvent exactly once as a top-level side effect.
const subscribedOnceAtLoad = mockSharingModule.onSharingSessionEvent.mock.calls.length

const offSession = {
  state: 'off',
  shareName: 'OPLFORGE',
  hasCredentials: false
}

const runningSession = {
  state: 'running-idle',
  boundAddress: '192.168.1.42',
  port: 445,
  shareName: 'OPLFORGE',
  hasCredentials: true
}

describe('sharing-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useSharingStore.setState({ session: undefined, status: 'idle', errorMessage: undefined })
  })

  it('loadSession populates the current session', async () => {
    mockSharingModule.getSession.mockResolvedValue(offSession)

    await useSharingStore.getState().loadSession()

    expect(useSharingStore.getState().session?.state).toBe('off')
  })

  it('saveCredentials updates hasCredentials on the session', async () => {
    mockSharingModule.saveCredentials.mockResolvedValue({ ...offSession, hasCredentials: true })

    await useSharingStore.getState().saveCredentials('opl', 'forge')

    expect(mockSharingModule.saveCredentials).toHaveBeenCalledWith('opl', 'forge')
    expect(useSharingStore.getState().session?.hasCredentials).toBe(true)
  })

  it('startSharing transitions to running-idle on success', async () => {
    mockSharingModule.startSharing.mockResolvedValue(runningSession)

    await useSharingStore.getState().startSharing('oplforge')

    expect(useSharingStore.getState().session?.state).toBe('running-idle')
    expect(useSharingStore.getState().session?.boundAddress).toBe('192.168.1.42')
    expect(useSharingStore.getState().status).toBe('idle')
  })

  it('startSharing surfaces a plain-language error when no local network is available (FR-030)', async () => {
    mockSharingModule.startSharing.mockRejectedValue(
      new SharingModule.SharingModuleError({
        code: 'NO_LOCAL_NETWORK',
        message: 'Conecte-se a uma rede Wi-Fi para compartilhar.'
      })
    )

    await useSharingStore.getState().startSharing('oplforge')

    expect(useSharingStore.getState().status).toBe('error')
    expect(useSharingStore.getState().errorMessage).toBe('Conecte-se a uma rede Wi-Fi para compartilhar.')
  })

  it('stopSharing is idempotent and returns to the off session', async () => {
    mockSharingModule.stopSharing.mockResolvedValue(offSession)

    await useSharingStore.getState().stopSharing()

    expect(useSharingStore.getState().session?.state).toBe('off')
  })

  it('subscribes to onSharingSessionEvent exactly once at module load', () => {
    expect(subscribedOnceAtLoad).toBe(1)
  })
})
