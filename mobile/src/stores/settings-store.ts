import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n, { detectSystemLanguage } from '../i18n'
import type { SupportedLanguage } from '../i18n/languages'
import type { AndroidUpdateStatus } from '../services/update-check'
import { registerBootstrapStep } from '../app/bootstrap'
import { checkForAndroidUpdate } from '../services/update-check'

interface LibrarySourceIdentity {
  treeUri: string
}

type LanguageSource = 'user' | 'system-default'

interface SettingsState {
  language: SupportedLanguage
  languageSource: LanguageSource
  lastLibrarySource: LibrarySourceIdentity | null
  updateStatus: AndroidUpdateStatus | null
  setLanguage: (language: SupportedLanguage, source?: LanguageSource) => void
  recordLibrarySource: (source: LibrarySourceIdentity) => void
  hasLibrarySourceChanged: (candidate: LibrarySourceIdentity) => boolean
  setUpdateStatus: (status: AndroidUpdateStatus) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      language: detectSystemLanguage(),
      languageSource: 'system-default',
      lastLibrarySource: null,
      updateStatus: null,
      setLanguage: (language, source = 'user') => {
        set({ language, languageSource: source })
        void i18n.changeLanguage(language)
      },
      recordLibrarySource: (source) => set({ lastLibrarySource: source }),
      hasLibrarySourceChanged: (candidate) => {
        const last = get().lastLibrarySource
        if (!last) return false
        return last.treeUri !== candidate.treeUri
      },
      setUpdateStatus: (status) => set({ updateStatus: status })
    }),
    {
      name: 'opl-forge-mobile-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
        languageSource: state.languageSource,
        lastLibrarySource: state.lastLibrarySource
      }),
      onRehydrateStorage: () => (state) => {
        if (state) void i18n.changeLanguage(state.language)
      }
    }
  )
)

// Runs once per launch (FR-008); never throws (see checkForAndroidUpdate),
// so a failed/offline check cannot block bootstrap or app startup (FR-010).
registerBootstrapStep(async () => {
  const status = await checkForAndroidUpdate()
  useSettingsStore.getState().setUpdateStatus(status)
})
