// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DownloadPipelineCard } from '@/components/downloads/DownloadPipelineCard'
import { DownloadsPage } from '@/pages/DownloadsPage'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useDownloadStore } from '@/stores/download-store'
import type { DurableDownloadTaskSummary } from '@/types/opl-finalization'

describe('DownloadsPage pipeline presentation', () => {
  beforeEach(() => {
    useDeviceStore.setState({ activeDevice: null, selectionRevision: 0 })
    useDownloadStore.setState({ tasks: {}, queueRevision: 0, lastSequenceByOperation: {} })
    vi.restoreAllMocks()
  })

  it('mounts with a device and an empty durable snapshot without a render loop', async () => {
    useDeviceStore.setState({
      activeDevice: {
        id: 'device-1',
        path: '/media/opl',
        name: 'OPL',
        fileSystem: 'FAT32',
        total: 1,
        free: 1,
        used: 0,
        status: 'ready'
      },
      selectionRevision: 1
    })
    vi.spyOn(oplApi, 'listDownloads').mockResolvedValue({ items: [], revision: 1 })
    vi.spyOn(oplApi, 'onOplPipelineEvent').mockReturnValue(() => undefined)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <DownloadsPage />
      </QueryClientProvider>
    )
    await waitFor(() => expect(screen.getByText('Fila vazia')).toBeInTheDocument())
    expect(oplApi.listDownloads).toHaveBeenCalledOnce()
  })

  it('shows Essentials tasks persisted with the legacy mount path', async () => {
    const device = {
      id: 'device-1',
      path: '/run/media/user/PS2',
      name: 'PS2',
      fileSystem: 'exFAT',
      total: 1,
      free: 1,
      used: 0,
      status: 'ready'
    } as const
    useDeviceStore.setState({ activeDevice: device, selectionRevision: 1 })
    const task = {
      taskId: 'legacy-path-task',
      targetDeviceId: device.path,
      requestedTitle: 'Mega Man X7',
      phase: 'transferring',
      overallProgress: 20,
      phaseProgress: 30,
      revision: 2,
      transfer: { bytesConfirmed: 100, totalBytes: 500 }
    } as DurableDownloadTaskSummary
    vi.spyOn(oplApi, 'listDownloads').mockResolvedValue({ items: [task], revision: 2 })
    vi.spyOn(oplApi, 'onOplPipelineEvent').mockReturnValue(() => undefined)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <DownloadsPage />
      </QueryClientProvider>
    )
    expect(await screen.findAllByText('Mega Man X7')).not.toHaveLength(0)
    expect(screen.getAllByText('Baixando')).not.toHaveLength(0)
  })

  it('exposes phase, progress, actionable error and retry accessibly', () => {
    const retry = vi.fn()
    const task = {
      taskId: 't1',
      requestedTitle: 'Game',
      phase: 'failed',
      overallProgress: 62,
      phaseProgress: 0,
      revision: 4,
      transfer: { bytesConfirmed: 4096, totalBytes: 8192 },
      lastError: {
        code: 'NETWORK',
        message: 'Conexão interrompida',
        action: 'Verifique a rede',
        retryable: true
      }
    } as DurableDownloadTaskSummary
    render(<DownloadPipelineCard task={task} onRetry={retry} />)
    expect(screen.getAllByText('Falhou')).not.toHaveLength(0)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62')
    expect(screen.getByRole('alert')).toHaveTextContent('Verifique a rede')
    screen.getByRole('button', { name: 'Tentar novamente' }).click()
    expect(retry).toHaveBeenCalledOnce()
  })
})
