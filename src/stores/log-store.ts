import { create } from 'zustand'
import type { LogEntry, OperationProgress } from '@/types/opl'

export type LogLevelFilter = 'all' | 'info' | 'warn' | 'error'

interface LogState {
  logs: LogEntry[]
  progress: OperationProgress | null
  isDrawerOpen: boolean
  logFilter: LogLevelFilter
  pushLog: (entry: LogEntry) => void
  setProgress: (progress: OperationProgress | null) => void
  clearLogs: () => void
  toggleDrawer: (open?: boolean) => void
  setLogFilter: (filter: LogLevelFilter) => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  progress: null,
  isDrawerOpen: false,
  logFilter: 'all',
  pushLog: (entry) =>
    set((state) => ({
      logs: [entry, ...state.logs].slice(0, 300),
      // Automatically open drawer when an error is logged
      isDrawerOpen: entry.level === 'ERROR' ? true : state.isDrawerOpen
    })),
  setProgress: (progress) => set({ progress }),
  clearLogs: () => set({ logs: [] }),
  toggleDrawer: (open) =>
    set((state) => ({ isDrawerOpen: open !== undefined ? open : !state.isDrawerOpen })),
  setLogFilter: (logFilter) => set({ logFilter })
}))
