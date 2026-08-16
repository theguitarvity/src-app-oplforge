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

function partialDevice(overrides: Partial<DeviceInfo> = {}): DeviceInfo {
  return {
    id: 'local-2',
    name: 'PastaFora',
    path: '/mnt/external/PastaFora',
    total: 1000,
    free: 500,
    used: 500,
    fileSystem: 'local',
    status: 'missing-structure',
    sourceKind: 'local-folder',
    isOutsideHome: true,
    ...overrides
  }
}

afterEach(() => cleanup())
beforeEach(() => {
  vi.mocked(oplApi.listDevices).mockClear()
  vi.mocked(oplApi.openPathDialog).mockClear()
  vi.mocked(oplApi.getDeviceSummary).mockClear()
})

async function pickAndAdvanceToStep3(device: DeviceInfo) {
  vi.mocked(oplApi.openPathDialog).mockResolvedValueOnce([device.path])
  vi.mocked(oplApi.getDeviceSummary).mockResolvedValueOnce({
    device,
    ps2Games: 0,
    ps1Games: 0,
    apps: 0,
    recentHistory: []
  })
  fireEvent.click(screen.getByText('Escolher pasta local'))
  await waitFor(() => expect(screen.getByText(device.path, { exact: false })).toBeInTheDocument())
  fireEvent.click(screen.getByText('Próximo'))
  await waitFor(() => expect(screen.getByText('Escolha a configuração do OPL')).toBeInTheDocument())
  fireEvent.click(screen.getAllByText('Próximo')[0])
  await waitFor(() => expect(screen.getByText('Aviso de Operação Sensível')).toBeInTheDocument())
}

describe('PrepWizard — extra confirmation outside home (US3 / FR-010)', () => {
  it('requires the extra checkbox before enabling "Iniciar Preparação" when isOutsideHome is true', async () => {
    renderWizard()
    await pickAndAdvanceToStep3(partialDevice({ isOutsideHome: true }))

    expect(
      screen.getByText('Esta pasta está fora da minha pasta pessoal.', { exact: false })
    ).toBeInTheDocument()

    const startButton = screen.getByText('Iniciar Preparação').closest('button')!
    expect(startButton).toBeDisabled()

    fireEvent.click(
      screen.getByText('Estou ciente de que estou alterando o dispositivo', { exact: false })
    )
    expect(startButton).toBeDisabled()

    fireEvent.click(
      screen.getByText('Esta pasta está fora da minha pasta pessoal.', { exact: false })
    )
    expect(startButton).not.toBeDisabled()
  })

  it('does not require the extra checkbox when the folder is inside the home directory', async () => {
    renderWizard()
    await pickAndAdvanceToStep3(partialDevice({ isOutsideHome: false }))

    expect(
      screen.queryByText('Esta pasta está fora da minha pasta pessoal.', { exact: false })
    ).not.toBeInTheDocument()

    const startButton = screen.getByText('Iniciar Preparação').closest('button')!
    expect(startButton).toBeDisabled()
    fireEvent.click(
      screen.getByText('Estou ciente de que estou alterando o dispositivo', { exact: false })
    )
    expect(startButton).not.toBeDisabled()
  })
})
