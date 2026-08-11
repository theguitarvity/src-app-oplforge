import { create } from 'zustand'
import type { CatalogListing, SmartFillPlan } from '../types'
import * as EssentialsModule from '../native/EssentialsModule'
import type { SmartFillMode } from '../native/EssentialsModule'

interface EssentialsStoreState {
  items: CatalogListing[]
  search: string
  tier: string
  status: 'idle' | 'loading' | 'error'
  errorMessage: string | undefined
  smartFillPlan: SmartFillPlan | undefined
  availableBytes: number | undefined
  loadCatalog: () => Promise<void>
  refresh: () => Promise<void>
  setSearch: (search: string) => void
  setTier: (tier: string) => void
  loadAvailableSpace: () => Promise<number | undefined>
  buildSmartFillPlan: (targetBytes: number, mode: SmartFillMode) => Promise<void>
  resetSmartFillPlan: () => void
  confirmAndDownload: (items: CatalogListing[]) => Promise<void>
}

export const useEssentialsStore = create<EssentialsStoreState>((set, get) => ({
  items: [],
  search: '',
  tier: 'all',
  status: 'idle',
  errorMessage: undefined,
  smartFillPlan: undefined,
  availableBytes: undefined,

  loadCatalog: async () => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const items = await EssentialsModule.listCatalog({ search: get().search, tier: get().tier })
      set({ items, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof EssentialsModule.EssentialsModuleError ? error.message : String(error)
      })
    }
  },

  refresh: async () => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const items = await EssentialsModule.refreshCatalog()
      set({ items, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof EssentialsModule.EssentialsModuleError ? error.message : String(error)
      })
    }
  },

  setSearch: (search) => {
    set({ search })
    void get().loadCatalog()
  },

  setTier: (tier) => {
    set({ tier })
    void get().loadCatalog()
  },

  loadAvailableSpace: async () => {
    try {
      const availableBytes = await EssentialsModule.getAvailableSpace()
      set({ availableBytes })
      return availableBytes
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof EssentialsModule.EssentialsModuleError ? error.message : String(error)
      })
      return undefined
    }
  },

  buildSmartFillPlan: async (targetBytes, mode) => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const smartFillPlan = await EssentialsModule.createSmartFillPlan(targetBytes, mode)
      set({ smartFillPlan, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof EssentialsModule.EssentialsModuleError ? error.message : String(error)
      })
    }
  },

  resetSmartFillPlan: () => set({ smartFillPlan: undefined }),

  confirmAndDownload: async (items) => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      await EssentialsModule.confirmAndEnqueue(items, EssentialsModule.LEGAL_CONFIRMATION_TEXT)
      set({ status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof EssentialsModule.EssentialsModuleError ? error.message : String(error)
      })
    }
  }
}))
