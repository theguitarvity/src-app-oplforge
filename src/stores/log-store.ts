import { create } from 'zustand'
import type { LogEntry, OperationProgress } from '@/types/opl'

interface LogState {
  logs: LogEntry[]
  progress: OperationProgress | null
  pushLog: (entry: LogEntry) => void
  setProgress: (progress: OperationProgress | null) => void
  clearLogs: () => void
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  progress: null,
  pushLog: (entry) => set((state) => ({ logs: [entry, ...state.logs].slice(0, 150) })),
  setProgress: (progress) => set({ progress }),
  clearLogs: () => set({ logs: [] })
}))
