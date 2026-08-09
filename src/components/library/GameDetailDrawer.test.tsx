// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { GameDetailDrawer } from '@/components/library/GameDetailDrawer'
import type { UnifiedGameItem } from '@/types/library'
import type { ReactElement } from 'react'

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('GameDetailDrawer', () => {
  const mockItem: UnifiedGameItem = {
    id: 'SLUS-21259',
    title: 'Shadow of the Colossus',
    gameId: 'SLUS_212.59',
    type: 'PS2',
    region: 'NTSC-U',
    filePath: '/media/ps2/DVD/SLUS_212.59.Shadow.iso',
    status: 'ready',
    sizeBytes: 4300000000
  }

  it('renders game metadata and contextual actions', () => {
    renderWithClient(<GameDetailDrawer item={mockItem} isOpen={true} onClose={() => {}} />)

    expect(screen.getByText('Shadow of the Colossus')).toBeInTheDocument()
    expect(screen.getByText('SLUS_212.59')).toBeInTheDocument()
    expect(screen.getByText('Testar no PCSX2')).toBeInTheDocument()
    expect(screen.getByText('Renomear para Padrão OPL')).toBeInTheDocument()
    expect(screen.getByText('Verificar Fragmentação')).toBeInTheDocument()
  })
})
