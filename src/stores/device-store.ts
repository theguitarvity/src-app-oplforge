import { create } from 'zustand'
import type { DeviceInfo } from '@/types/opl'

interface DeviceState {
  activeDevice: DeviceInfo | null
  selectionRevision: number
  setActiveDevice: (device: DeviceInfo | null) => void
}

export const useDeviceStore = create<DeviceState>((set) => ({
  activeDevice: null,
  selectionRevision: 0,
  setActiveDevice: (device) =>
    set((state) => ({ activeDevice: device, selectionRevision: state.selectionRevision + 1 }))
}))
