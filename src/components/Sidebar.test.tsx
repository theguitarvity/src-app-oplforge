// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from './Sidebar'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useDeviceStore.setState({ activeDevice: null, selectionRevision: 0 })
})

describe('Sidebar diagnosis activity', () => {
  it('keeps progress visible outside the diagnosis route', async () => {
    useDeviceStore.setState({
      activeDevice: {
        id: 'device-1',
        name: 'HD OPL',
        path: '/media/opl',
        total: 100,
        free: 50,
        used: 50,
        fileSystem: 'exFAT',
        status: 'ready'
      },
      selectionRevision: 1
    })
    vi.spyOn(oplApi, 'getCurrentFragmentationDiagnosis').mockResolvedValue({
      diagnosticId: 'diagnostic-1',
      deviceId: 'device-1',
      devicePath: '/media/opl',
      status: 'running',
      processedItems: 7,
      totalItems: 20,
      progress: 0.35,
      currentItem: 'DVD/SLUS_123.45.iso',
      message: 'Analisado 7 de 20',
      startedAt: '2026-08-02T12:00:00.000Z'
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Sidebar />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Diagnóstico em andamento')
    expect(status).toHaveTextContent('7/20 jogos')
    expect(status).toHaveTextContent('35%')
    expect(screen.getByRole('link', { name: /Diagnóstico em andamento/ })).toHaveAttribute(
      'href',
      '/tools?tab=diagnostics'
    )
  })
})
