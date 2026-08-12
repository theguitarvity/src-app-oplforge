import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n, { detectSystemLanguage } from '@/i18n'
import type { SupportedLanguage } from '@/i18n/languages'

interface LibrarySourceIdentity {
  id: string
  path: string
}

type LanguageSource = 'user' | 'system-default'

interface SettingsState {
  language: SupportedLanguage
  languageSource: LanguageSource
  lastLibrarySource: LibrarySourceIdentity | null
  setLanguage: (language: SupportedLanguage, source?: LanguageSource) => void
  recordLibrarySource: (source: LibrarySourceIdentity) => void
  hasLibrarySourceChanged: (candidate: LibrarySourceIdentity) => boolean
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      language: detectSystemLanguage(),
      languageSource: 'system-default',
      lastLibrarySource: null,
      setLanguage: (language, source = 'user') => {
        set({ language, languageSource: source })
        void i18n.changeLanguage(language)
      },
      recordLibrarySource: (source) => set({ lastLibrarySource: source }),
      hasLibrarySourceChanged: (candidate) => {
        const last = get().lastLibrarySource
        if (!last) return false
        return last.id !== candidate.id || last.path !== candidate.path
      }
    }),
    {
      name: 'opl-forge-settings',
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.language)
      }
    }
  )
)

export function hasChosenLanguageExplicitly(): boolean {
  return useSettingsStore.getState().languageSource === 'user'
}
