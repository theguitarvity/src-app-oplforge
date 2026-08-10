import { create } from 'zustand'
import * as ArtSyncModule from '../native/ArtSyncModule'
import type { ArtSyncEventPayload, ArtSyncState } from '../native/ArtSyncModule'

interface ArtSyncStoreState {
  state: ArtSyncState
  totalGames: number
  matchedInSource: number
  installed: number
  failed: number
  errorMessage: string | undefined
  plan: () => Promise<void>
  start: () => Promise<void>
}

export const useArtSyncStore = create<ArtSyncStoreState>((set) => ({
  state: 'idle',
  totalGames: 0,
  matchedInSource: 0,
  installed: 0,
  failed: 0,
  errorMessage: undefined,

  plan: async () => {
    set({ state: 'planning', errorMessage: undefined })
    try {
      const summary = await ArtSyncModule.planArtSync()
      set({
        state: 'planned',
        totalGames: summary.totalGames,
        matchedInSource: summary.matchedInSource
      })
    } catch (error) {
      set({
        state: 'error',
        errorMessage: error instanceof ArtSyncModule.ArtSyncModuleError ? error.message : String(error)
      })
    }
  },

  start: async () => {
    try {
      await ArtSyncModule.startArtSync()
    } catch (error) {
      set({
        state: 'error',
        errorMessage: error instanceof ArtSyncModule.ArtSyncModuleError ? error.message : String(error)
      })
    }
  }
}))

// Live plan/progress/completion events — a single subscription for the
// app's lifetime, registered once (mirrors sharing-store's convention).
let unsubscribeFromEvents: (() => void) | undefined
if (!unsubscribeFromEvents) {
  unsubscribeFromEvents = ArtSyncModule.onArtSyncEvent((event: ArtSyncEventPayload) => {
    useArtSyncStore.setState({
      state: event.state,
      totalGames: event.totalGames,
      matchedInSource: event.matchedInSource,
      installed: event.installed,
      failed: event.failed,
      errorMessage: event.errorMessage
    })
  })
}
