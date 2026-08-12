jest.mock('../../../src/native/specs/NativeLibraryModule', () => ({
  __esModule: true,
  default: {
    selectLibrary: jest.fn(),
    getActiveLibrary: jest.fn(),
    revalidateAccess: jest.fn()
  }
}))

import { useLibraryStore } from '../../../src/stores/library-store'
import { useSettingsStore } from '../../../src/stores/settings-store'
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
    useLibraryStore.setState({ library: undefined, status: 'idle', errorMessage: undefined, sourceChanged: false })
    useSettingsStore.setState({ lastLibrarySource: null, updateStatus: null })
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

  describe('source-change detection (FR-011/FR-012/FR-013/FR-017)', () => {
    it('does not flag a change on first install (no prior source recorded)', async () => {
      mockNativeModule.getActiveLibrary.mockResolvedValue({ ...sampleLibrary, exists: true })
      mockNativeModule.revalidateAccess.mockResolvedValue(sampleLibrary)

      await useLibraryStore.getState().revalidate()

      expect(useLibraryStore.getState().sourceChanged).toBe(false)
    })

    it('flags a change when the treeUri differs from the previously recorded source', async () => {
      useSettingsStore.setState({ lastLibrarySource: { treeUri: 'content://tree/primary:OLD' } })
      mockNativeModule.getActiveLibrary.mockResolvedValue({ ...sampleLibrary, exists: true })
      mockNativeModule.revalidateAccess.mockResolvedValue(sampleLibrary)

      await useLibraryStore.getState().revalidate()

      expect(useLibraryStore.getState().sourceChanged).toBe(true)
      expect(useSettingsStore.getState().lastLibrarySource?.treeUri).toBe(sampleLibrary.treeUri)
    })

    it('does not flag a change when the treeUri matches the previously recorded source', async () => {
      useSettingsStore.setState({ lastLibrarySource: { treeUri: sampleLibrary.treeUri } })
      mockNativeModule.getActiveLibrary.mockResolvedValue({ ...sampleLibrary, exists: true })
      mockNativeModule.revalidateAccess.mockResolvedValue(sampleLibrary)

      await useLibraryStore.getState().revalidate()

      expect(useLibraryStore.getState().sourceChanged).toBe(false)
    })
  })
})
