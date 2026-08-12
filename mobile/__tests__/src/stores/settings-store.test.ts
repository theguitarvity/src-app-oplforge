jest.mock('../../../src/native/specs/NativeLibraryModule', () => ({
  __esModule: true,
  default: {
    selectLibrary: jest.fn(),
    getActiveLibrary: jest.fn(),
    revalidateAccess: jest.fn()
  }
}))

import { useSettingsStore } from '../../../src/stores/settings-store'

describe('settings-store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      language: 'pt-BR',
      languageSource: 'system-default',
      lastLibrarySource: null,
      updateStatus: null
    })
  })

  it('setLanguage marks the choice as explicit (FR-015)', () => {
    useSettingsStore.getState().setLanguage('en', 'user')

    expect(useSettingsStore.getState().language).toBe('en')
    expect(useSettingsStore.getState().languageSource).toBe('user')
  })

  describe('hasLibrarySourceChanged (FR-013/FR-017)', () => {
    it('returns false when no source was recorded yet (first install)', () => {
      expect(useSettingsStore.getState().hasLibrarySourceChanged({ treeUri: 'content://tree/A' })).toBe(false)
    })

    it('returns true when the candidate treeUri differs from the recorded one', () => {
      useSettingsStore.getState().recordLibrarySource({ treeUri: 'content://tree/A' })

      expect(useSettingsStore.getState().hasLibrarySourceChanged({ treeUri: 'content://tree/B' })).toBe(true)
    })

    it('returns false when the candidate treeUri matches the recorded one', () => {
      useSettingsStore.getState().recordLibrarySource({ treeUri: 'content://tree/A' })

      expect(useSettingsStore.getState().hasLibrarySourceChanged({ treeUri: 'content://tree/A' })).toBe(false)
    })
  })
})
