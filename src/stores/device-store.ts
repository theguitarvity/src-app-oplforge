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
  /** Remembers, per root device id, the last subfolder chosen as the working target
   *  (see "Selecionar subpasta..."), so reselecting that device resolves back to it. */
  subfolderByDeviceId: Record<string, string>
  setActiveDevice: (device: DeviceInfo | null) => void
  setDevices: (devices: DeviceInfo[]) => void
  setMetrics: (metrics: StorageMetrics | null) => void
  setSubfolderForDevice: (deviceId: string, subfolderPath: string) => void
  clearSubfolderForDevice: (deviceId: string) => void
}

export const useDeviceStore = create<DeviceState>((set) => ({
  activeDevice: null,
  devices: [],
  selectionRevision: 0,
  metrics: null,
  subfolderByDeviceId: {},
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
  setMetrics: (metrics) => set({ metrics }),
  setSubfolderForDevice: (deviceId, subfolderPath) =>
    set((state) => ({
      subfolderByDeviceId: { ...state.subfolderByDeviceId, [deviceId]: subfolderPath }
    })),
  clearSubfolderForDevice: (deviceId) =>
    set((state) => {
      const next = { ...state.subfolderByDeviceId }
      delete next[deviceId]
      return { subfolderByDeviceId: next }
    })
}))
