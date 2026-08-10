import { render, waitFor, fireEvent } from '@testing-library/react-native'

jest.mock('../../../src/native/CatalogModule', () => ({
  __esModule: true,
  getCatalogEntries: jest.fn(),
  startScan: jest.fn(),
  cancelScan: jest.fn(),
  getLatestSnapshot: jest.fn(),
  onCatalogScanEvent: jest.fn().mockReturnValue(() => undefined)
}))

import { LibraryScreen } from '../../../src/screens/Library/LibraryScreen'
import * as CatalogModule from '../../../src/native/CatalogModule'

const mockCatalogModule = CatalogModule as unknown as Record<string, jest.Mock>

function entry(id: string, contentType: 'dvd' | 'cd' | 'ps1' | 'app', title: string) {
  return {
    id,
    contentType,
    title,
    extension: 'iso',
    sizeBytes: 1024 * 1024 * 700,
    logicalPath: `/DVD/${title}.iso`,
    hasArt: false,
    namingConformance: 'conforms' as const,
    structuralIssues: [] as string[]
  }
}

describe('LibraryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows an empty state when there are no catalogued entries', async () => {
    mockCatalogModule.getCatalogEntries.mockResolvedValue([])

    const { getByText } = await render(<LibraryScreen />)

    await waitFor(() => expect(getByText('Nenhum item catalogado ainda.')).toBeTruthy())
  })

  it('lists catalogued entries returned by the native module', async () => {
    mockCatalogModule.getCatalogEntries.mockResolvedValue([entry('1', 'dvd', 'Shadow of the Colossus')])

    const { getByText } = await render(<LibraryScreen />)

    await waitFor(() => expect(getByText('Shadow of the Colossus')).toBeTruthy())
  })

  it('reloads with the selected type filter (FR-011)', async () => {
    mockCatalogModule.getCatalogEntries.mockResolvedValue([entry('1', 'dvd', 'Shadow of the Colossus')])

    const { getByText } = await render(<LibraryScreen />)
    await waitFor(() => expect(getByText('Shadow of the Colossus')).toBeTruthy())

    mockCatalogModule.getCatalogEntries.mockResolvedValue([entry('2', 'ps1', 'Final Fantasy IX')])
    fireEvent.press(getByText('PS1'))

    await waitFor(() =>
      expect(mockCatalogModule.getCatalogEntries).toHaveBeenLastCalledWith(0, 30, 'ps1')
    )
    await waitFor(() => expect(getByText('Final Fantasy IX')).toBeTruthy())
  })

  it('opens the game detail sheet when a card is pressed', async () => {
    mockCatalogModule.getCatalogEntries.mockResolvedValue([entry('1', 'dvd', 'Shadow of the Colossus')])

    const { getByText } = await render(<LibraryScreen />)
    await waitFor(() => expect(getByText('Shadow of the Colossus')).toBeTruthy())

    fireEvent.press(getByText('Shadow of the Colossus'))

    await waitFor(() => expect(getByText('Fechar')).toBeTruthy())
  })
})
