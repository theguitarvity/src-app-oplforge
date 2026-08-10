jest.mock('../../../src/native/CatalogModule', () => ({
  __esModule: true,
  startScan: jest.fn(),
  cancelScan: jest.fn(),
  getLatestSnapshot: jest.fn(),
  onCatalogScanEvent: jest.fn().mockReturnValue(() => undefined)
}))

import { useCatalogStore } from '../../../src/stores/catalog-store'
import * as CatalogModule from '../../../src/native/CatalogModule'

const mockCatalogModule = CatalogModule as unknown as Record<string, jest.Mock>

// Captured immediately at module-load time — catalog-store.ts subscribes to
// onCatalogScanEvent exactly once as a top-level side effect, before any
// beforeEach()'s jest.clearAllMocks() would otherwise wipe that call record.
const liveEventHandler = mockCatalogModule.onCatalogScanEvent.mock.calls[0][0] as (event: {
  snapshot: typeof completedSnapshot
  message: string
  timestamp: string
}) => void

const runningSnapshot = {
  id: 'snap-1',
  state: 'running',
  startedAt: '2026-08-09T00:00:00Z',
  countsByType: { dvd: 1, cd: 0, ps1: 0, app: 0 },
  issueCount: 0
}

const completedSnapshot = {
  ...runningSnapshot,
  state: 'completed',
  completedAt: '2026-08-09T00:05:00Z',
  countsByType: { dvd: 5, cd: 2, ps1: 1, app: 3 },
  issueCount: 1
}

describe('catalog-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useCatalogStore.setState({ snapshot: undefined, status: 'idle', errorMessage: undefined })
  })

  it('startScan transitions to scanning and stores the initial snapshot', async () => {
    mockCatalogModule.startScan.mockResolvedValue(runningSnapshot)

    await useCatalogStore.getState().startScan()

    expect(useCatalogStore.getState().status).toBe('scanning')
    expect(useCatalogStore.getState().snapshot?.id).toBe('snap-1')
  })

  it('a scan failure surfaces a plain-language error message, not a stack trace', async () => {
    mockCatalogModule.startScan.mockRejectedValue(new Error('Nenhuma biblioteca foi selecionada.'))

    await useCatalogStore.getState().startScan()

    expect(useCatalogStore.getState().status).toBe('error')
    expect(useCatalogStore.getState().errorMessage).toBe('Nenhuma biblioteca foi selecionada.')
  })

  it('loadLatest marks status ready when the latest snapshot is completed', async () => {
    mockCatalogModule.getLatestSnapshot.mockResolvedValue(completedSnapshot)

    await useCatalogStore.getState().loadLatest()

    expect(useCatalogStore.getState().status).toBe('ready')
    expect(useCatalogStore.getState().snapshot?.issueCount).toBe(1)
  })

  it('loadLatest leaves status idle when no scan has ever completed', async () => {
    mockCatalogModule.getLatestSnapshot.mockResolvedValue(undefined)

    await useCatalogStore.getState().loadLatest()

    expect(useCatalogStore.getState().status).toBe('idle')
    expect(useCatalogStore.getState().snapshot).toBeUndefined()
  })

  it('applies a live onCatalogScanEvent (subscribed once at module load) to the store', () => {
    liveEventHandler({ snapshot: completedSnapshot, message: 'done', timestamp: '2026-08-09T00:05:00Z' })

    expect(useCatalogStore.getState().status).toBe('ready')
    expect(useCatalogStore.getState().snapshot?.countsByType.dvd).toBe(5)
  })
})
