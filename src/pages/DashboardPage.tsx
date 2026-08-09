import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DisconnectedEmptyState } from '@/components/device/DisconnectedEmptyState'
import { DeviceWorkspaceHeader } from '@/components/device/DeviceWorkspaceHeader'
import { DeviceOverviewTab } from '@/components/device/DeviceOverviewTab'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { LocalLibraryChooser } from '@/components/library/LocalLibraryChooser'

export function DashboardPage() {
  const queryClient = useQueryClient()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const setDevices = useDeviceStore((state) => state.setDevices)

  const { isFetching: isScanning } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const list = await oplApi.listDevices()
      setDevices(list)
      if (!activeDevice && list.length > 0) {
        setActiveDevice(list[0])
      }
      return list
    }
  })

  const { data: summary } = useQuery({
    queryKey: ['summary', activeDevice?.path],
    queryFn: () => (activeDevice ? oplApi.getDeviceSummary(activeDevice.path) : null),
    enabled: Boolean(activeDevice)
  })

  const refreshDevices = () => {
    void queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  const device = summary?.device ?? activeDevice

  if (!device) {
    return (
      <div className="space-y-5">
        <DisconnectedEmptyState onRefreshDevices={refreshDevices} isScanning={isScanning} />
        <LocalLibraryChooser />
      </div>
    )
  }

  const ps2Count = summary?.ps2Games ?? 0
  const ps1Count = summary?.ps1Games ?? 0
  const appsCount = summary?.apps ?? 0
  const issuesCount = device.status === 'ready' ? 0 : 1

  return (
    <div className="space-y-6">
      <DeviceWorkspaceHeader
        device={device}
        ps2Count={ps2Count}
        ps1Count={ps1Count}
        appsCount={appsCount}
        issuesCount={issuesCount}
      />
      <DeviceOverviewTab
        ps2Count={ps2Count}
        ps1Count={ps1Count}
        appsCount={appsCount}
        issuesCount={issuesCount}
      />
    </div>
  )
}
