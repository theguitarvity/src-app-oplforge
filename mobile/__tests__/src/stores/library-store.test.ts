jest.mock('../../../src/native/specs/NativeLibraryModule', () => ({
  __esModule: true,
  default: {
    selectLibrary: jest.fn(),
    getActiveLibrary: jest.fn(),
    revalidateAccess: jest.fn()
  }
}))

import { useLibraryStore } from '../../../src/stores/library-store'
import NativeLibraryModuleMock from '../../../src/native/specs/NativeLibraryModule'

const mockNativeModule = NativeLibraryModuleMock as unknown as Record<string, jest.Mock>

const sampleLibrary = {
  exists: true,
  treeUri: 'content://tree/primary:OPL',
  displayName: 'OPL',
  sourceKind: 'internal',
  accessGrantedAt: '2026-08-09T00:00:00Z',
  accessValid: true,
  lastValidatedAt: '2026-08-09T00:00:00Z'
}

describe('library-store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useLibraryStore.setState({ library: undefined, status: 'idle', errorMessage: undefined })
  })

  it('selectLibrary transitions idle -> loading -> ready with the selected library', async () => {
    mockNativeModule.selectLibrary.mockResolvedValue(sampleLibrary)

    const promise = useLibraryStore.getState().selectLibrary()
    expect(useLibraryStore.getState().status).toBe('loading')

    await promise

    expect(useLibraryStore.getState().status).toBe('ready')
    expect(useLibraryStore.getState().library?.treeUri).toBe(sampleLibrary.treeUri)
  })

  it('a cancelled selection returns to idle, not error (not a failure)', async () => {
    const cancelledError = Object.assign(new Error('Seleção cancelada pelo usuário.'), {
      code: 'SELECTION_CANCELLED'
    })
    mockNativeModule.selectLibrary.mockRejectedValue(cancelledError)

    await useLibraryStore.getState().selectLibrary()

    expect(useLibraryStore.getState().status).toBe('idle')
    expect(useLibraryStore.getState().errorMessage).toBeUndefined()
  })

  it('a real failure sets status error with a message', async () => {
    mockNativeModule.selectLibrary.mockRejectedValue(
      Object.assign(new Error('O sistema não concedeu acesso persistente a esta pasta.'), {
        code: 'GRANT_FAILED'
      })
    )

    await useLibraryStore.getState().selectLibrary()

    expect(useLibraryStore.getState().status).toBe('error')
    expect(useLibraryStore.getState().errorMessage).toContain('acesso persistente')
  })

  it('revalidate updates the store from the native access-validity check (FR-004)', async () => {
    mockNativeModule.revalidateAccess.mockResolvedValue({ ...sampleLibrary, accessValid: false })

    await useLibraryStore.getState().revalidate()

    expect(useLibraryStore.getState().library?.accessValid).toBe(false)
    expect(useLibraryStore.getState().status).toBe('ready')
  })
})
