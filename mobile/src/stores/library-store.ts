import { create } from 'zustand'
import type { LibrarySelection } from '../types'
import * as LibraryModule from '../native/LibraryModule'
import { registerBootstrapStep } from '../app/bootstrap'

interface LibraryStoreState {
  library: LibrarySelection | undefined
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | undefined
  selectLibrary: () => Promise<void>
  revalidate: () => Promise<void>
}

export const useLibraryStore = create<LibraryStoreState>((set) => ({
  library: undefined,
  status: 'idle',
  errorMessage: undefined,

  selectLibrary: async () => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const library = await LibraryModule.selectLibrary()
      set({ library, status: 'ready' })
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
    set({ status: 'loading', errorMessage: undefined })
    try {
      const library = await LibraryModule.revalidateAccess()
      set({ library, status: 'ready' })
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
