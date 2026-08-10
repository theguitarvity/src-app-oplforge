import { create } from 'zustand'
import type { CatalogSnapshot } from '../types'
import * as CatalogModule from '../native/CatalogModule'
import { registerBootstrapStep } from '../app/bootstrap'

interface CatalogStoreState {
  snapshot: CatalogSnapshot | undefined
  status: 'idle' | 'scanning' | 'ready' | 'error'
  errorMessage: string | undefined
  startScan: () => Promise<void>
  cancelScan: () => Promise<void>
  loadLatest: () => Promise<void>
}

let unsubscribeFromEvents: (() => void) | undefined

export const useCatalogStore = create<CatalogStoreState>((set) => ({
  snapshot: undefined,
  status: 'idle',
  errorMessage: undefined,

  startScan: async () => {
    set({ status: 'scanning', errorMessage: undefined })
    try {
      const snapshot = await CatalogModule.startScan()
      set({ snapshot })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
    }
  },

  cancelScan: async () => {
    try {
      await CatalogModule.cancelScan()
    } catch (error) {
      console.warn('[catalog-store] cancelScan failed', error)
    }
  },

  loadLatest: async () => {
    try {
      const snapshot = await CatalogModule.getLatestSnapshot()
      set({ snapshot, status: snapshot?.state === 'completed' ? 'ready' : 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      })
    }
  }
}))

// Reflects live scan progress/completion/cancellation/error (FR-010) — a
// single subscription for the lifetime of the app, registered once.
if (!unsubscribeFromEvents) {
  unsubscribeFromEvents = CatalogModule.onCatalogScanEvent(({ snapshot }) => {
    useCatalogStore.setState({
      snapshot,
      status: snapshot.state === 'completed' ? 'ready' : snapshot.state === 'error' ? 'error' : snapshot.state === 'cancelled' ? 'idle' : 'scanning'
    })
  })
}

registerBootstrapStep(() => useCatalogStore.getState().loadLatest())
