import { create } from 'zustand'
import type { SharingSession } from '../types'
import * as SharingModule from '../native/SharingModule'
import type { RecentConnection } from '../native/SharingModule'
import { registerBootstrapStep } from '../app/bootstrap'

export interface SharingLogEntry {
  id: number
  kind: string
  message: string
  timestamp: string
}

const MAX_LOG_ENTRIES = 100

interface SharingStoreState {
  session: SharingSession | undefined
  status: 'idle' | 'busy' | 'error'
  errorMessage: string | undefined
  logs: SharingLogEntry[]
  clearLogs: () => void
  recentConnections: RecentConnection[]
  loadRecentConnections: () => Promise<void>
  loadSession: () => Promise<void>
  saveCredentials: (username: string, password: string) => Promise<void>
  acknowledgeWriteAccess: () => Promise<void>
  startSharing: (shareName: string) => Promise<void>
  stopSharing: () => Promise<void>
  /** One-tap activation: saves credentials, confirms write access, and starts sharing in a single action — no separate "definir credenciais" step first. */
  activate: (username: string, password: string, shareName: string, writeAccessAcknowledged: boolean) => Promise<void>
}

export const useSharingStore = create<SharingStoreState>((set) => ({
  session: undefined,
  status: 'idle',
  errorMessage: undefined,
  logs: [],
  recentConnections: [],

  clearLogs: () => set({ logs: [] }),

  loadRecentConnections: async () => {
    try {
      const recentConnections = await SharingModule.getRecentConnections()
      set({ recentConnections })
    } catch {
      // Best-effort — recent connections are a convenience, never block the screen on this.
    }
  },

  loadSession: async () => {
    try {
      const session = await SharingModule.getSession()
      set({ session, status: 'idle' })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  },

  saveCredentials: async (username, password) => {
    set({ status: 'busy', errorMessage: undefined })
    try {
      const session = await SharingModule.saveCredentials(username, password)
      set({ session, status: 'idle' })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  },

  acknowledgeWriteAccess: async () => {
    try {
      const session = await SharingModule.acknowledgeWriteAccess()
      set({ session })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  },

  startSharing: async (shareName) => {
    set({ status: 'busy', errorMessage: undefined })
    try {
      const session = await SharingModule.startSharing(shareName)
      set({ session, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof SharingModule.SharingModuleError ? error.message : String(error)
      })
    }
  },

  activate: async (username, password, shareName, writeAccessAcknowledged) => {
    set({ status: 'busy', errorMessage: undefined })
    if (!writeAccessAcknowledged) {
      set({ status: 'error', errorMessage: 'Confirme o acesso de escrita do PS2 antes de compartilhar.' })
      return
    }
    if (!username || !password) {
      set({ status: 'error', errorMessage: 'Usuário e senha são obrigatórios.' })
      return
    }
    try {
      await SharingModule.saveCredentials(username, password)
      await SharingModule.acknowledgeWriteAccess()
      const session = await SharingModule.startSharing(shareName || 'oplforge')
      set({ session, status: 'idle' })
      void useSharingStore.getState().loadRecentConnections()
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof SharingModule.SharingModuleError ? error.message : String(error)
      })
    }
  },

  stopSharing: async () => {
    set({ status: 'busy', errorMessage: undefined })
    try {
      const session = await SharingModule.stopSharing()
      set({ session, status: 'idle' })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  }
}))

// Live state (start/stop/client connect-disconnect/write-conflict) — a
// single subscription for the app's lifetime, registered once (FR-024).
let unsubscribeFromEvents: (() => void) | undefined
let nextLogId = 0
if (!unsubscribeFromEvents) {
  unsubscribeFromEvents = SharingModule.onSharingSessionEvent(({ session, kind, message, timestamp }) => {
    const entry: SharingLogEntry = { id: nextLogId++, kind, message, timestamp }
    useSharingStore.setState((state) => ({ session, logs: [entry, ...state.logs].slice(0, MAX_LOG_ENTRIES) }))
  })
}

registerBootstrapStep(() => useSharingStore.getState().loadSession())
