// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OplNamingPage } from './OplNamingPage'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { DeviceInfo } from '@/types/opl'
import type { NamingAudit, NamingPlan } from '@/types/opl-finalization'

const device = {
  id: 'usb-1',
  name: 'PS2 USB',
  path: '/media/ps2',
  total: 10,
  free: 5,
  used: 5,
  fileSystem: 'FAT32',
  status: 'ready'
} as DeviceInfo
const audit = {
  auditId: 'audit-1',
  revision: 0,
  deviceId: device.id,
  createdAt: new Date().toISOString(),
  items: [
    {
      itemId: 'item-1',
      currentRelativePath: 'DVD/Jogo.iso',
      canonicalRelativePath: 'DVD/SLUS_123.45.Jogo.iso',
      identity: {
        gameId: 'SLUS_123.45',
        title: 'Jogo',
        titleBytes: 4,
        evidence: [],
        conflicts: []
      },
      classification: 'correctable',
      findings: []
    }
  ]
} as NamingAudit
const plan = {
  planId: 'plan-1',
  revision: 0,
  auditId: audit.auditId,
  deviceId: device.id,
  itemIds: ['item-1'],
  exclusions: [],
  status: 'awaiting-confirmation',
  createdAt: new Date().toISOString()
} as NamingPlan

describe('OplNamingPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useDeviceStore.setState({ activeDevice: device, selectionRevision: 1 })
  })

  it('allows reading, planning and confirming canonical OPL names', async () => {
    vi.spyOn(oplApi, 'listDevices').mockResolvedValue([device])
    vi.spyOn(oplApi, 'listOplProfiles').mockResolvedValue([])
    vi.spyOn(oplApi, 'auditOplNaming').mockResolvedValue(audit)
    vi.spyOn(oplApi, 'createOplNamingPlan').mockResolvedValue(plan)
    const confirm = vi
      .spyOn(oplApi, 'confirmOplNaming')
      .mockResolvedValue({ operationId: 'op-1', items: [{ itemId: 'item-1', state: 'renamed' }] })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={client}>
        <OplNamingPage />
      </QueryClientProvider>
    )
    await user.click(screen.getByRole('button', { name: 'Ler dispositivo e auditar nomes' }))
    await user.click(await screen.findByRole('button', { name: 'Corrigir nomes selecionados (1)' }))
    await user.click(await screen.findByRole('button', { name: 'Confirmar adequação' }))
    expect(confirm).toHaveBeenCalledWith({
      planId: 'plan-1',
      expectedRevision: 0,
      confirmation: 'ADEQUAR NOMES OPL'
    })
    expect(await screen.findByRole('status')).toHaveTextContent('1 jogos adequados')
  })
})
