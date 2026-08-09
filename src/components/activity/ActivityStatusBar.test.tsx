// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ActivityStatusBar } from '@/components/activity/ActivityStatusBar'
import { useLogStore } from '@/stores/log-store'

afterEach(() => {
  cleanup()
})

describe('ActivityStatusBar', () => {
  it('renders default system ready status', () => {
    useLogStore.setState({ logs: [], progress: null, isDrawerOpen: false })

    render(<ActivityStatusBar />)

    expect(screen.getByText('Sistema pronto')).toBeInTheDocument()
    expect(screen.getByText('Mostrar Detalhes')).toBeInTheDocument()
  })

  it('renders active progress when running', () => {
    useLogStore.setState({
      logs: [],
      progress: { id: 'op-1', label: 'Copiando Shadow of the Colossus.iso', value: 50 },
      isDrawerOpen: false
    })

    render(<ActivityStatusBar />)

    expect(
      screen.getByText('Copiando Shadow of the Colossus.iso', { selector: 'span' })
    ).toBeInTheDocument()
    expect(screen.getByText('50%', { selector: 'span' })).toBeInTheDocument()
  })
})
