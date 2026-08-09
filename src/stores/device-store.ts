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
  setDevices: (devices) =>
    set((state) => ({
      devices: [
        ...devices,
        ...state.devices.filter(
          (item) =>
            item.sourceKind === 'local-folder' && !devices.some((next) => next.path === item.path)
        )
      ]
    })),
  setMetrics: (metrics) => set({ metrics })
}))
