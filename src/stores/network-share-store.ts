import { create } from 'zustand'
import type { NetworkShareConfig, NetworkShareStatus } from '@/types/opl'

interface NetworkShareState {
  config: NetworkShareConfig | null
  status: NetworkShareStatus | null
  setConfig: (config: NetworkShareConfig | null) => void
  setStatus: (status: NetworkShareStatus | null) => void
}

export const useNetworkShareStore = create<NetworkShareState>((set) => ({
  config: null,
  status: null,
  setConfig: (config) => set({ config }),
  setStatus: (status) => set({ status })
}))
