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
    }))
  }
}))

function rootDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    id: 'dev-1',
    name: 'games_test',
    path: '/mnt/games_test',
    total: 465800000000,
    free: 388100000000,
    used: 77700000000,
    fileSystem: 'fuseblk',
    status: 'ready',
    sourceKind: 'local-folder',
    isOutsideHome: true,
    ...overrides
  }
}

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <MemoryRouter initialEntries={['/devices?tab=manage']}>
      <QueryClientProvider client={queryClient}>
        <DevicesPage />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  useDeviceStore.setState({
    activeDevice: null,
    devices: [],
    selectionRevision: 0,
    metrics: null,
    subfolderByDeviceId: {}
  })
  vi.mocked(oplApi.listDevices).mockClear()
  vi.mocked(oplApi.openPathDialog).mockClear()
  vi.mocked(oplApi.getDeviceSummary).mockClear()
})
afterEach(() => cleanup())

describe('DevicesPage — selecionar subpasta', () => {
  it('opens the folder dialog scoped to the device path (defaultPath + withinRoot)', async () => {
    const device = rootDevice()
    vi.mocked(oplApi.listDevices).mockResolvedValueOnce([device])
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([])
    renderPage()

    await waitFor(() => expect(screen.getByText(device.name)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Selecionar subpasta...'))

    await waitFor(() => {
      expect(oplApi.openPathDialog).toHaveBeenCalledWith({
        mode: 'folder',
        defaultPath: device.path,
        withinRoot: device.path
      })
    })
  })

  it('makes the picked subfolder the active reference for the SAME device (no duplicate card)', async () => {
    const device = rootDevice()
    const subPath = `${device.path}/subpasta`
    const subDevice = rootDevice({
      id: 'sub-1',
      name: 'subpasta',
      path: subPath,
      status: 'missing-structure'
    })

    vi.mocked(oplApi.listDevices).mockResolvedValueOnce([device])
    vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([subPath])
    vi.mocked(oplApi.getDeviceSummary).mockImplementation(async (path?: string) => ({
      device: path === subPath ? subDevice : path === device.path ? device : null,
      ps2Games: 0,
      ps1Games: 0,
      apps: 0,
      recentHistory: []
    }))

    renderPage()
    await waitFor(() => expect(screen.getByText(device.name)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Selecionar subpasta...'))

    await waitFor(() => {
      expect(screen.getByText(subPath, { exact: false })).toBeInTheDocument()
    })
    expect(screen.getByText('Dispositivo: /mnt/games_test')).toBeInTheDocument()
    expect(screen.getByText('Subpasta ativa')).toBeInTheDocument()

    // The subfolder is a reference on the same device — no second card is created.
    expect(useDeviceStore.getState().devices).toHaveLength(1)
    expect(useDeviceStore.getState().devices[0].path).toBe(device.path)

    expect(useDeviceStore.getState().activeDevice?.id).toBe(device.id)
    expect(useDeviceStore.getState().activeDevice?.path).toBe(subPath)
    expect(useDeviceStore.getState().subfolderByDeviceId[device.id]).toBe(subPath)
  })

  it('shows an error message when the subfolder pick fails', async () => {
    const device = rootDevice()
    vi.mocked(oplApi.listDevices).mockResolvedValueOnce([device])
    vi.mocked(oplApi.openPathDialog).mockRejectedValueOnce(
      new Error('A pasta escolhida precisa estar dentro do dispositivo selecionado.')
    )

    renderPage()
    await waitFor(() => expect(screen.getByText(device.name)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Selecionar subpasta...'))

    await waitFor(() => {
      expect(
        screen.getByText('A pasta escolhida precisa estar dentro do dispositivo selecionado.')
      ).toBeInTheDocument()
    })
  })
})
