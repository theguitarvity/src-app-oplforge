// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DevicesPage } from '@/pages/DevicesPage'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
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
    runDiagnostics: vi.fn(async () => ({
      device: { deviceId: 'x' },
      catalog: { items: [] },
      readiness: 'ready'
    })),
    prepareDevice: vi.fn(async () => ({
      id: '1',
      operation: 'Preparar dispositivo',
      destination: '/mnt/games_test',
      result: 'success',
      message: 'ok',
      timestamp: new Date().toISOString()
    }))
  }
}))

function notReadyDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    id: 'games_test',
    name: 'games_test',
    path: '/mnt/games_test',
    total: 465800000000,
    free: 388100000000,
    used: 77700000000,
    fileSystem: 'fuseblk',
    status: 'missing-structure',
    sourceKind: 'local-folder',
    isOutsideHome: true,
    ...overrides
  }
}

function renderPage(initialEntries: string[] = ['/devices?tab=manage']) {
  const queryClient = new QueryClient()
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <DevicesPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useDeviceStore.setState({ activeDevice: null, devices: [], selectionRevision: 0, metrics: null })
  vi.mocked(oplApi.listDevices).mockClear()
})
afterEach(() => cleanup())

describe('DevicesPage — "Preparar" badge on a not-ready device', () => {
  it('renders as a clickable button, not a static label', async () => {
    const device = notReadyDevice()
    vi.mocked(oplApi.listDevices).mockResolvedValueOnce([device])
    renderPage()

    await waitFor(() => expect(screen.getAllByText('Preparar').length).toBeGreaterThan(0))
    const prepareButton = screen.getAllByText('Preparar').find((el) => el.closest('button'))
    expect(prepareButton?.closest('button')).not.toBeDisabled()
  })

  it('clicking it opens the PrepWizard already scoped to that device (skips device selection)', async () => {
    const device = notReadyDevice()
    vi.mocked(oplApi.listDevices).mockResolvedValueOnce([device])
    renderPage()

    await waitFor(() => expect(screen.getAllByText('Preparar').length).toBeGreaterThan(0))
    const prepareButton = screen.getAllByText('Preparar').find((el) => el.closest('button'))!
    fireEvent.click(prepareButton)

    await waitFor(() => {
      expect(screen.getByText('Preparar Dispositivo para OPL')).toBeInTheDocument()
    })
    // Should land directly on Step 2 (filesystem config), not Step 1 (device selection)
    expect(screen.getByText('Escolha a configuração do OPL')).toBeInTheDocument()
    expect(screen.queryByText('Selecione o dispositivo alvo')).not.toBeInTheDocument()
  })
})
