import { create } from 'zustand'
import type { TransferItem } from '../types'
import * as TransferModule from '../native/TransferModule'
import type { EnqueueImportResult } from '../native/TransferModule'
import { registerBootstrapStep } from '../app/bootstrap'

interface TransferStoreState {
  items: TransferItem[]
  status: 'idle' | 'busy' | 'error'
  errorMessage: string | undefined
  loadQueue: () => Promise<void>
  enqueueImport: (sourceUri: string, destinationHint?: string, overwrite?: boolean) => Promise<EnqueueImportResult>
  cancel: (transferId: string) => Promise<void>
  retry: (transferId: string) => Promise<void>
}

function upsert(items: TransferItem[], item: TransferItem): TransferItem[] {
  const index = items.findIndex((existing) => existing.id === item.id)
  if (index === -1) return [item, ...items]
  const next = items.slice()
  next[index] = item
  return next
}

export const useTransferStore = create<TransferStoreState>((set, get) => ({
  items: [],
  status: 'idle',
  errorMessage: undefined,

  loadQueue: async () => {
    try {
      const items = await TransferModule.getQueue()
      set({ items, status: 'idle' })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  },

  enqueueImport: async (sourceUri, destinationHint = '', overwrite = false) => {
    set({ status: 'busy', errorMessage: undefined })
    try {
      const result = await TransferModule.enqueueImport(sourceUri, destinationHint, overwrite)
      if (result.status === 'queued') set({ items: upsert(get().items, result), status: 'idle' })
      else set({ status: 'idle' })
      return result
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof TransferModule.TransferModuleError ? error.message : String(error)
      })
      throw error
    }
  },

  cancel: async (transferId) => {
    try {
      const item = await TransferModule.cancel(transferId)
      set({ items: upsert(get().items, item) })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  },

  retry: async (transferId) => {
    try {
      const item = await TransferModule.retry(transferId)
      set({ items: upsert(get().items, item) })
    } catch (error) {
      set({ status: 'error', errorMessage: error instanceof Error ? error.message : String(error) })
    }
  }
}))

// Live per-item progress/state-change events — a single subscription for the
// app's lifetime, registered once (mirrors sharing-store's convention).
let unsubscribeFromEvents: (() => void) | undefined
if (!unsubscribeFromEvents) {
  unsubscribeFromEvents = TransferModule.onTransferQueueEvent(({ item }) => {
    useTransferStore.setState({ items: upsert(useTransferStore.getState().items, item) })
  })
}

registerBootstrapStep(() => useTransferStore.getState().loadQueue())
