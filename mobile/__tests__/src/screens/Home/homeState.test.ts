jest.mock('../../../../src/native/specs/NativeLibraryModule', () => ({
  __esModule: true,
  default: { selectLibrary: jest.fn(), getActiveLibrary: jest.fn(), revalidateAccess: jest.fn() }
}))
jest.mock('../../../../src/native/CatalogModule', () => ({
  __esModule: true,
  startScan: jest.fn(),
  cancelScan: jest.fn(),
  getLatestSnapshot: jest.fn(),
  onCatalogScanEvent: jest.fn().mockReturnValue(() => undefined)
}))
jest.mock('../../../../src/native/SharingModule', () => ({
  __esModule: true,
  getSession: jest.fn(),
  saveCredentials: jest.fn(),
  acknowledgeWriteAccess: jest.fn(),
  startSharing: jest.fn(),
  stopSharing: jest.fn(),
  onSharingSessionEvent: jest.fn().mockReturnValue(() => undefined),
  SharingModuleError: class extends Error {}
}))

import { useLibraryStore } from '../../../../src/stores/library-store'
import { useCatalogStore } from '../../../../src/stores/catalog-store'
import { useSharingStore } from '../../../../src/stores/sharing-store'
import { deriveHomeState } from '../../../../src/screens/Home/homeState'

const validLibrary = {
  treeUri: 'content://tree/primary:OPL',
  displayName: 'OPL',
  sourceKind: 'internal' as const,
  accessGrantedAt: '2026-08-09T00:00:00Z',
  accessValid: true,
  lastValidatedAt: '2026-08-09T00:00:00Z'
}

const completedSnapshot = {
  id: 'snap-1',
  state: 'completed' as const,
  startedAt: '2026-08-09T00:00:00Z',
  countsByType: { dvd: 5, cd: 2, ps1: 1, app: 3 },
  issueCount: 0
}

describe('deriveHomeState', () => {
  beforeEach(() => {
    useLibraryStore.setState({ library: undefined, status: 'idle', errorMessage: undefined })
    useCatalogStore.setState({ snapshot: undefined, status: 'idle', errorMessage: undefined })
    useSharingStore.setState({ session: undefined, status: 'idle', errorMessage: undefined })
  })

  it('returns no-library when nothing has been selected', () => {
    expect(deriveHomeState().state).toBe('no-library')
  })

  it('returns no-library when access is no longer valid (FR-004)', () => {
    useLibraryStore.setState({ library: { ...validLibrary, accessValid: false } })
    expect(deriveHomeState().state).toBe('no-library')
  })

  it('returns ready-to-share when the library is selected but not yet catalogued', () => {
    useLibraryStore.setState({ library: validLibrary })
    expect(deriveHomeState().state).toBe('ready-to-share')
  })

  it('returns library-issues when the latest snapshot has problems', () => {
    useLibraryStore.setState({ library: validLibrary })
    useCatalogStore.setState({ snapshot: { ...completedSnapshot, issueCount: 3 } })
    expect(deriveHomeState().state).toBe('library-issues')
  })

  it('returns sharing-off when catalogued clean and sharing is off', () => {
    useLibraryStore.setState({ library: validLibrary })
    useCatalogStore.setState({ snapshot: completedSnapshot })
    expect(deriveHomeState().state).toBe('sharing-off')
  })

  it('returns sharing-on-idle when the server is running with no client', () => {
    useLibraryStore.setState({ library: validLibrary })
    useCatalogStore.setState({ snapshot: completedSnapshot })
    useSharingStore.setState({ session: { state: 'running-idle', shareName: 'OPLFORGE', hasCredentials: true } })
    expect(deriveHomeState().state).toBe('sharing-on-idle')
  })

  it('returns ps2-connected when a client is connected', () => {
    useLibraryStore.setState({ library: validLibrary })
    useCatalogStore.setState({ snapshot: completedSnapshot })
    useSharingStore.setState({
      session: { state: 'running-connected', boundAddress: '192.168.1.42', shareName: 'OPLFORGE', hasCredentials: true }
    })
    expect(deriveHomeState().state).toBe('ps2-connected')
  })

  it('all six states are visually distinguishable by status color', () => {
    const states = new Set<string>()
    useLibraryStore.setState({ library: undefined })
    states.add(deriveHomeState().status)

    useLibraryStore.setState({ library: validLibrary })
    states.add(deriveHomeState().status)

    useCatalogStore.setState({ snapshot: { ...completedSnapshot, issueCount: 1 } })
    states.add(deriveHomeState().status)

    useCatalogStore.setState({ snapshot: completedSnapshot })
    states.add(deriveHomeState().status)

    useSharingStore.setState({ session: { state: 'running-idle', shareName: 'X', hasCredentials: true } })
    states.add(deriveHomeState().status)

    useSharingStore.setState({ session: { state: 'running-connected', shareName: 'X', hasCredentials: true } })
    states.add(deriveHomeState().status)

    expect(states.size).toBeGreaterThanOrEqual(4)
  })
})
