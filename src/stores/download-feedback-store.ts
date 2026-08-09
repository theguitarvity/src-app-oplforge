import { create } from 'zustand'
export const useDownloadFeedbackStore = create<{
  attention: boolean
  toast?: { id: number; message: string; kind: 'started' | 'completed' }
  notify(message: string, kind: 'started' | 'completed'): void
  clearAttention(): void
  dismiss(): void
}>((set) => ({
  attention: false,
  notify: (message, kind) => set({ attention: true, toast: { id: Date.now(), message, kind } }),
  clearAttention: () => set({ attention: false }),
  dismiss: () => set({ toast: undefined })
}))
