import { create } from 'zustand'
import type { LibrarySelection } from '../types'
import * as LibraryModule from '../native/LibraryModule'
import { registerBootstrapStep } from '../app/bootstrap'
import { useSettingsStore } from './settings-store'

interface LibraryStoreState {
  library: LibrarySelection | undefined
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | undefined
  /** True while a source change was detected and the library is (re)loading — drives the "library changed" popup (FR-011/FR-012/FR-017). */
  sourceChanged: boolean
  selectLibrary: () => Promise<void>
  revalidate: () => Promise<void>
}

function applySourceChangeDetection(library: LibrarySelection): boolean {
  const { hasLibrarySourceChanged, recordLibrarySource } = useSettingsStore.getState()
  const changed = hasLibrarySourceChanged({ treeUri: library.treeUri })
  recordLibrarySource({ treeUri: library.treeUri })
  return changed
}

export const useLibraryStore = create<LibraryStoreState>((set) => ({
  library: undefined,
  status: 'idle',
  errorMessage: undefined,
  sourceChanged: false,

  selectLibrary: async () => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const library = await LibraryModule.selectLibrary()
      const sourceChanged = applySourceChangeDetection(library)
      set({ library, status: 'ready', sourceChanged })
    } catch (error) {
      if (error instanceof LibraryModule.LibraryModuleError && error.code === 'SELECTION_CANCELLED') {
        // User backed out of the picker — not a failure, restore prior state.
        set({ status: 'idle' })
        return
      }
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
    }
  },

  revalidate: async () => {
    // Fast local lookup (no OS access-grant round trip) used only to decide
    // whether to show the "library changed" popup *before* the slower
    // revalidateAccess() call below — otherwise sourceChanged would only be
    // known at the same moment status flips to 'ready', too late to ever
    // render the loading popup (FR-012).
    let sourceChanged = false
    try {
      const activeLibrary = await LibraryModule.getActiveLibrary()
      if (activeLibrary) {
        sourceChanged = useSettingsStore
          .getState()
          .hasLibrarySourceChanged({ treeUri: activeLibrary.treeUri })
      }
    } catch {
      // Non-fatal — fall through without the popup rather than block loading.
    }

    set({ status: 'loading', errorMessage: undefined, sourceChanged })
    try {
      const library = await LibraryModule.revalidateAccess()
      const changed = library ? applySourceChangeDetection(library) : sourceChanged
      set({ library, status: 'ready', sourceChanged: changed })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
    }
  }
}))

// Launch-time access revalidation (FR-004) — registered once, run by
// runBootstrap() in src/app/App.tsx before anything state-dependent renders.
registerBootstrapStep(() => useLibraryStore.getState().revalidate())
