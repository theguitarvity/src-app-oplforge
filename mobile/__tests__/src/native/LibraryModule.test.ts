jest.mock('../../../src/native/specs/NativeLibraryModule', () => ({
  __esModule: true,
  default: {
    selectLibrary: jest.fn(),
    getActiveLibrary: jest.fn(),
    revalidateAccess: jest.fn()
  }
}))

import * as LibraryModule from '../../../src/native/LibraryModule'
import NativeLibraryModuleMock from '../../../src/native/specs/NativeLibraryModule'

const mockNativeModule = NativeLibraryModuleMock as unknown as Record<string, jest.Mock>

describe('LibraryModule wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('selectLibrary resolves a typed LibrarySelection on success', async () => {
    mockNativeModule.selectLibrary.mockResolvedValue({
      treeUri: 'content://tree/primary:OPL',
      displayName: 'OPL',
      sourceKind: 'internal',
      accessGrantedAt: '2026-08-09T00:00:00Z',
      accessValid: true,
      lastValidatedAt: '2026-08-09T00:00:00Z'
    })

    const result = await LibraryModule.selectLibrary()

    expect(result.treeUri).toBe('content://tree/primary:OPL')
    expect(result.sourceKind).toBe('internal')
    expect(result.accessValid).toBe(true)
  })

  it('selectLibrary rejects with a LibraryModuleError carrying the native error code', async () => {
    const nativeError = Object.assign(new Error('Seleção cancelada pelo usuário.'), {
      code: 'SELECTION_CANCELLED'
    })
    mockNativeModule.selectLibrary.mockRejectedValue(nativeError)

    await expect(LibraryModule.selectLibrary()).rejects.toMatchObject({
      code: 'SELECTION_CANCELLED',
      message: 'Seleção cancelada pelo usuário.'
    })
  })

  it('getActiveLibrary returns undefined when no library has ever been selected', async () => {
    mockNativeModule.getActiveLibrary.mockResolvedValue({ exists: false })

    const result = await LibraryModule.getActiveLibrary()

    expect(result).toBeUndefined()
  })

  it('revalidateAccess surfaces accessValid: false without throwing (FR-004)', async () => {
    mockNativeModule.revalidateAccess.mockResolvedValue({
      exists: true,
      treeUri: 'content://tree/primary:OPL',
      displayName: 'OPL',
      sourceKind: 'internal',
      accessGrantedAt: '2026-08-01T00:00:00Z',
      accessValid: false,
      lastValidatedAt: '2026-08-09T00:00:00Z'
    })

    const result = await LibraryModule.revalidateAccess()

    expect(result?.accessValid).toBe(false)
  })
})
