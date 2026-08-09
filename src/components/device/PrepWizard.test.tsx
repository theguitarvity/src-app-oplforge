// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrepWizard } from '@/components/device/PrepWizard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

describe('PrepWizard Safety Check', () => {
  it('renders step 1 device selection', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PrepWizard onClose={() => {}} onSuccess={() => {}} />
      </QueryClientProvider>
    )

    expect(screen.getByText('Preparar Dispositivo para OPL')).toBeInTheDocument()
    expect(screen.getByText('Passo 1 de 5: Selecionar Dispositivo')).toBeInTheDocument()
  })
})
