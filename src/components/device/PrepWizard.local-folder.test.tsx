// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrepWizard } from '@/components/device/PrepWizard'
import { oplApi } from '@/services/api'
import type { DeviceInfo } from '@/types/opl'

vi.mock('@/services/api', () => ({
  oplApi: {
    listDevices: vi.fn(async () => []),
    openPathDialog: vi.fn(async () => []),
    getDeviceSummary: vi.fn(async () => ({
      device: null,
      ps2Games: 0,
      ps1Games: 0,
      apps: 0,
      recentHistory: []
    })),
    prepareDevice: vi.fn(async () => ({
      id: '1',
      operation: 'Preparar dispositivo',
      destination: '/tmp/x',
      result: 'success',
      message: 'ok',
      timestamp: new Date().toISOString()
    }))
  }
}))

function renderWizard() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <PrepWizard onClose={() => {}} onSuccess={() => {}} />
    </QueryClientProvider>
  )
}

function readyDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    id: 'local-1',
    name: 'MinhaPasta',
    path: '/home/user/MinhaPasta',
    total: 1000,
    free: 500,
    used: 500,
    fileSystem: 'local',
    status: 'ready',
    sourceKind: 'opl-device',
    isOutsideHome: false,
    ...overrides
  }
}

beforeEach(() => {
  vi.mocked(oplApi.listDevices).mockClear()
  vi.mocked(oplApi.openPathDialog).mockClear()
  vi.mocked(oplApi.getDeviceSummary).mockClear()
})

afterEach(() => {
  cleanup()
})

describe('PrepWizard — local folder selection (US2)', () => {
  it('opens the native folder dialog with restrictSystemRoots when "Escolher pasta local" is clicked', async () => {
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([])
    renderWizard()

    fireEvent.click(screen.getByText('Escolher pasta local'))

    await waitFor(() => {
      expect(oplApi.openPathDialog).toHaveBeenCalledWith({
        mode: 'folder',
        restrictSystemRoots: true
      })
    })
  })

  it('does nothing when the folder dialog is cancelled', async () => {
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([])
    renderWizard()

    fireEvent.click(screen.getByText('Escolher pasta local'))

    await waitFor(() => expect(oplApi.openPathDialog).toHaveBeenCalled())
    expect(screen.getByText('Selecionar Dispositivo', { exact: false })).toBeInTheDocument()
  })

  it('shows the picked folder path once selected via the dialog', async () => {
    const device = readyDevice({ status: 'missing-structure' })
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([device.path])
    vi.mocked(oplApi.getDeviceSummary).mockResolvedValueOnce({
      device,
      ps2Games: 0,
      ps1Games: 0,
      apps: 0,
      recentHistory: []
    })
    renderWizard()

    fireEvent.click(screen.getByText('Escolher pasta local'))

    await waitFor(() => {
      expect(screen.getByText(device.path, { exact: false })).toBeInTheDocument()
    })
  })
})

describe('PrepWizard — skip wizard when already ready (US4)', () => {
  it('jumps straight to the "ready" screen when the picked folder already has full OPL structure', async () => {
    const device = readyDevice()
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([device.path])
    vi.mocked(oplApi.getDeviceSummary).mockResolvedValueOnce({
      device,
      ps2Games: 0,
      ps1Games: 0,
      apps: 0,
      recentHistory: []
    })
    renderWizard()

    fireEvent.click(screen.getByText('Escolher pasta local'))

    await waitFor(() => {
      expect(screen.getByText('Estrutura OPL já está pronta')).toBeInTheDocument()
    })
    expect(screen.queryByText('Escolha a configuração do OPL')).not.toBeInTheDocument()
  })

  it('continues the normal wizard when the picked folder has a missing/partial structure', async () => {
    const device = readyDevice({ status: 'missing-structure' })
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([device.path])
    vi.mocked(oplApi.getDeviceSummary).mockResolvedValueOnce({
      device,
      ps2Games: 0,
      ps1Games: 0,
      apps: 0,
      recentHistory: []
    })
    renderWizard()

    fireEvent.click(screen.getByText('Escolher pasta local'))

    await waitFor(() => {
      expect(screen.getByText(device.path, { exact: false })).toBeInTheDocument()
    })
    expect(screen.queryByText('Estrutura OPL já está pronta')).not.toBeInTheDocument()
  })
})
