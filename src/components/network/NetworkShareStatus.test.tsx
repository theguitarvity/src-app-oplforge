// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import type { ComponentType } from 'react'
import type {
  DeviceInfo,
  NetworkShareConfig,
  NetworkShareStatus as NetworkShareStatusType,
  OplApi
} from '@/types/opl'
import type { useDeviceStore as UseDeviceStoreType } from '@/stores/device-store'

const fakeDevice: DeviceInfo = {
  id: 'device-1',
  name: 'PS2 HD',
  path: '/media/ps2',
  total: 1_000_000_000,
  free: 500_000_000,
  used: 500_000_000,
  fileSystem: 'exFAT',
  status: 'ready'
}

function offConfig(overrides: Partial<NetworkShareConfig> = {}): NetworkShareConfig {
  return {
    libraryRootPath: '',
    enabledProtocols: [],
    shareName: 'OPL Forge',
    username: '',
    smbPort: 445,
    ftpPort: 21,
    autoStartOnLaunch: false,
    writeAccessAcknowledgedAt: undefined,
    ...overrides
  }
}

function offStatus(): NetworkShareStatusType {
  return {
    smb: { state: 'off', boundAddresses: [] },
    ftp: { state: 'off', boundAddresses: [] },
    connectedClients: []
  }
}

describe('NetworkShareStatus', () => {
  let config: NetworkShareConfig
  let status: NetworkShareStatusType
  let acknowledgeCalled = false
  let NetworkShareStatus: ComponentType
  let useDeviceStore: typeof UseDeviceStoreType

  beforeEach(async () => {
    config = offConfig()
    status = offStatus()
    acknowledgeCalled = false

    const fakeApi: Partial<OplApi> = {
      getNetworkShareConfig: async () => config,
      getNetworkShareStatus: async () => status,
      onNetworkShareEvent: () => () => undefined,
      saveNetworkShareConfig: async (input) => {
        config = { ...config, ...input, password: undefined } as NetworkShareConfig
        return config
      },
      acknowledgeNetworkShareWriteAccess: async () => {
        acknowledgeCalled = true
        config = { ...config, writeAccessAcknowledgedAt: new Date().toISOString() }
        return config
      },
      startNetworkShare: async () => {
        status = {
          smb: {
            state: 'running',
            boundAddresses: ['192.168.15.20'],
            port: 445,
            startedAt: new Date().toISOString()
          },
          ftp: { state: 'off', boundAddresses: [] },
          connectedClients: []
        }
        return status
      },
      stopNetworkShare: async () => {
        status = offStatus()
        return status
      }
    }
    // @ts-expect-error partial mock is sufficient for this component's usage
    window.oplApi = fakeApi

    // `oplApi` in src/services/api.ts binds to `window.oplApi` once, at
    // module-evaluation time — reset the module graph so the component (and
    // its `services/api` import) re-evaluate against the mock set above,
    // instead of the cached fallback from a previous test file import.
    vi.resetModules()
    ;({ NetworkShareStatus } = await import('@/components/network/NetworkShareStatus'))
    ;({ useDeviceStore } = await import('@/stores/device-store'))
    // Matches the rest of the app: sharing operates on whichever device the
    // user already selected on the Dispositivos screen.
    useDeviceStore.getState().setActiveDevice(fakeDevice)
  })

  afterEach(() => {
    cleanup()
    // @ts-expect-error cleanup test-only global
    delete window.oplApi
    vi.restoreAllMocks()
  })

  it('starts off, blocks start until write access is acknowledged, then shows connection details (US1 AS1)', async () => {
    render(<NetworkShareStatus />)

    await screen.findByText('Ligar compartilhamento')
    expect(
      screen.getByText('Desligado — nenhum dispositivo pode acessar sua biblioteca pela rede.')
    ).toBeInTheDocument()
    expect(screen.getByText('PS2 HD')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'tester' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByText('Ligar compartilhamento'))

    await waitFor(() =>
      expect(
        screen.getByText(
          'Confirme que o PS2 poderá gravar/sobrescrever arquivos na biblioteca antes de continuar.'
        )
      ).toBeInTheDocument()
    )
    expect(acknowledgeCalled).toBe(false)

    fireEvent.click(screen.getByRole('checkbox', { name: /criar, modificar e sobrescrever/i }))
    fireEvent.click(screen.getByText('Ligar compartilhamento'))

    await waitFor(() => expect(acknowledgeCalled).toBe(true))
    await screen.findByText(/SMB — 192.168.15.20:445/)
    expect(config.libraryRootPath).toBe('/media/ps2')
  })

  it('blocks starting without a username instead of hitting the API with an invalid request', async () => {
    const saveConfigSpy = vi.fn()
    window.oplApi.saveNetworkShareConfig = saveConfigSpy

    render(<NetworkShareStatus />)
    await screen.findByText('Ligar compartilhamento')

    fireEvent.click(screen.getByText('Ligar compartilhamento'))

    await waitFor(() =>
      expect(screen.getByText('Informe um usuário para o compartilhamento.')).toBeInTheDocument()
    )
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  it('blocks starting and disables the button when no device is active', async () => {
    useDeviceStore.getState().setActiveDevice(null)
    const saveConfigSpy = vi.fn()
    window.oplApi.saveNetworkShareConfig = saveConfigSpy

    render(<NetworkShareStatus />)
    await screen.findByText('Ligar compartilhamento')

    expect(screen.getByText(/Nenhum dispositivo ativo/)).toBeInTheDocument()
    expect(screen.getByText('Ligar compartilhamento').closest('button')).toBeDisabled()
    expect(saveConfigSpy).not.toHaveBeenCalled()
  })

  it('warns when only FTP is enabled that OPL browsing requires SMB (R1 finding)', async () => {
    render(<NetworkShareStatus />)
    await screen.findByText('Ligar compartilhamento')

    fireEvent.click(screen.getByRole('checkbox', { name: 'SMB' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'FTP' }))

    expect(screen.getByText(/o OPL só navega e lança jogos pela rede via SMB/i)).toBeInTheDocument()
  })

  it('lets the user edit the SMB port and sends the custom value when starting (fixes the EACCES report)', async () => {
    render(<NetworkShareStatus />)
    await screen.findByText('Ligar compartilhamento')

    const portInput = screen.getByLabelText('Porta SMB')
    expect(portInput).toHaveValue(445)
    expect(screen.getByText(/portas abaixo de 1024/i)).toBeInTheDocument()

    fireEvent.change(portInput, { target: { value: '4450' } })
    expect(screen.queryByText(/portas abaixo de 1024/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'tester' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByText('Ligar compartilhamento'))

    await waitFor(() => expect(config.smbPort).toBe(4450))
  })
})
