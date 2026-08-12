import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '@/stores/settings-store'

describe('SettingsStore language preference (FR-004/FR-005/FR-007/FR-015)', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      language: 'pt-BR',
      languageSource: 'system-default',
      lastLibrarySource: null
    })
  })

  it('setLanguage updates language and marks the choice as explicit', () => {
    useSettingsStore.getState().setLanguage('en', 'user')

    expect(useSettingsStore.getState().language).toBe('en')
    expect(useSettingsStore.getState().languageSource).toBe('user')
  })

  it('defaults languageSource to user when not specified', () => {
    useSettingsStore.getState().setLanguage('de')

    expect(useSettingsStore.getState().languageSource).toBe('user')
  })

  describe('hasLibrarySourceChanged (FR-013/FR-017)', () => {
    it('returns false when no source was recorded yet', () => {
      expect(useSettingsStore.getState().hasLibrarySourceChanged({ id: 'a', path: '/a' })).toBe(
        false
      )
    })

    it('returns true when the candidate id/path differs from the recorded one', () => {
      useSettingsStore.getState().recordLibrarySource({ id: 'a', path: '/a' })

      expect(useSettingsStore.getState().hasLibrarySourceChanged({ id: 'b', path: '/b' })).toBe(
        true
      )
    })

    it('returns false when the candidate id/path matches the recorded one', () => {
      useSettingsStore.getState().recordLibrarySource({ id: 'a', path: '/a' })

      expect(useSettingsStore.getState().hasLibrarySourceChanged({ id: 'a', path: '/a' })).toBe(
        false
      )
    })
  })
})
