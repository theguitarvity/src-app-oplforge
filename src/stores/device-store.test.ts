import { describe, it, expect, beforeEach } from 'vitest'
import { useDeviceStore } from '@/stores/device-store'

describe('DeviceStore Workspace State', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      activeDevice: null,
      devices: [],
      selectionRevision: 0,
      metrics: null
    })
  })

  it('initializes with no active device', () => {
    const state = useDeviceStore.getState()
    expect(state.activeDevice).toBeNull()
    expect(state.devices).toEqual([])
  })

  it('updates active device and increments revision', () => {
    const mockDevice = {
      id: 'device-1',
      name: 'MY_PS2_HDD',
      path: '/media/ps2',
      total: 1000000000000,
      free: 400000000000,
      used: 600000000000,
      fileSystem: 'exFAT',
      status: 'ready' as const
    }

    useDeviceStore.getState().setActiveDevice(mockDevice)

    const state = useDeviceStore.getState()
    expect(state.activeDevice).toEqual(mockDevice)
    expect(state.selectionRevision).toBe(1)
  })
})
