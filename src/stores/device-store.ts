import { create } from 'zustand'
import type { DeviceInfo } from '@/types/opl'

export interface StorageMetrics {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  ps2GamesCount: number
  ps1GamesCount: number
  appsCount: number
  issuesCount: number
  healthGrade: 'healthy' | 'warning' | 'critical' | 'unformatted'
}

interface DeviceState {
  activeDevice: DeviceInfo | null
  devices: DeviceInfo[]
  selectionRevision: number
  metrics: StorageMetrics | null
  setActiveDevice: (device: DeviceInfo | null) => void
  setDevices: (devices: DeviceInfo[]) => void
  setMetrics: (metrics: StorageMetrics | null) => void
}

export const useDeviceStore = create<DeviceState>((set) => ({
  activeDevice: null,
  devices: [],
  selectionRevision: 0,
  metrics: null,
  setActiveDevice: (device) =>
    set((state) => ({ activeDevice: device, selectionRevision: state.selectionRevision + 1 })),
  setDevices: (devices) => set({ devices }),
  setMetrics: (metrics) => set({ metrics })
}))
