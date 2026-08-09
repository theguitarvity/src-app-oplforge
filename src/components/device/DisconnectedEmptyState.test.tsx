// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DisconnectedEmptyState } from '@/components/device/DisconnectedEmptyState'

describe('DisconnectedEmptyState', () => {
  it('renders primary CTA and heading', () => {
    render(
      <MemoryRouter>
        <DisconnectedEmptyState />
      </MemoryRouter>
    )

    expect(screen.getByText('Nenhum dispositivo PS2 selecionado')).toBeInTheDocument()
    expect(screen.getByText('Detectar dispositivos')).toBeInTheDocument()
    expect(screen.getByText('Preparar novo dispositivo')).toBeInTheDocument()
  })
})
