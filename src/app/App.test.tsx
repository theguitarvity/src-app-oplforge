import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '@/components/EmptyState'
import { HardDrive } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState icon={HardDrive} title="Sem dispositivo" description="Conecte um volume." />)
    expect(screen.getByText('Sem dispositivo')).toBeInTheDocument()
    expect(screen.getByText('Conecte um volume.')).toBeInTheDocument()
  })
})
