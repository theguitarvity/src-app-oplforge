import { create } from 'zustand'
import type { DeviceInfo } from '@/types/opl'

interface DeviceState {
  activeDevice: DeviceInfo | null
  setActiveDevice: (device: DeviceInfo | null) => void
}

export const useDeviceStore = create<DeviceState>((set) => ({
  activeDevice: null,
  setActiveDevice: (device) => set({ activeDevice: device })
}))
