import { create } from 'zustand'
import type { DiagnosticsReport } from '../types'
import * as DiagnosticsModule from '../native/DiagnosticsModule'

interface DiagnosticsStoreState {
  report: DiagnosticsReport | undefined
  status: 'idle' | 'loading' | 'error'
  errorMessage: string | undefined
  loadLatest: () => Promise<void>
  runDiagnostics: () => Promise<void>
  prepareDevice: () => Promise<void>
}

export const useDiagnosticsStore = create<DiagnosticsStoreState>((set) => ({
  report: undefined,
  status: 'idle',
  errorMessage: undefined,

  loadLatest: async () => {
    try {
      const report = await DiagnosticsModule.getLatestDiagnosticsReport()
      set({ report })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof DiagnosticsModule.DiagnosticsModuleError ? error.message : String(error)
      })
    }
  },

  runDiagnostics: async () => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const report = await DiagnosticsModule.runDiagnostics()
      set({ report, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof DiagnosticsModule.DiagnosticsModuleError ? error.message : String(error)
      })
    }
  },

  prepareDevice: async () => {
    set({ status: 'loading', errorMessage: undefined })
    try {
      const report = await DiagnosticsModule.prepareDeviceStructure()
      set({ report, status: 'idle' })
    } catch (error) {
      set({
        status: 'error',
        errorMessage: error instanceof DiagnosticsModule.DiagnosticsModuleError ? error.message : String(error)
      })
    }
  }
}))
