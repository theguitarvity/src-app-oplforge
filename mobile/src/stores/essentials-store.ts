import { create } from 'zustand'
import type { CatalogListing, SmartFillPlan } from '../types'
import * as EssentialsModule from '../native/EssentialsModule'

interface EssentialsStoreState {
  items: CatalogListing[]
  search: string
  tier: string
  status: 'idle' | 'loading' | 'error'
  errorMessage: string | undefined
  smartFillPlan: SmartFillPlan | undefined
  loadCatalog: () => Promise<void>
  refresh: () => Promise<void>
  setSearch: (search: string) => void
  setTier: (tier: string) => void
  buildSmartFillPlan: (targetBytes: number) => Promise<void>
  confirmAndDownload: (items: CatalogListing[]) => Promise<void>
}

export const useEssentialsStore = create<EssentialsStoreState>((set, get) => ({
  items: [],
  search: '',
  tier: 'all',
  status: 'idle',
  errorMessage: undefined,
  smartFillPlan: undefined,

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

  buildSmartFillPlan: async (targetBytes) => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const smartFillPlan = await EssentialsModule.createSmartFillPlan(targetBytes)
      set({ smartFillPlan, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof EssentialsModule.EssentialsModuleError ? error.message : String(error)
      })
    }
  },

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
