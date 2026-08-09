import { useSearchParams } from 'react-router-dom'
import { HardDrive, ScanSearch, CheckCircle2, RefreshCw } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DeviceCard } from '@/components/DeviceCard'
import { DisconnectedEmptyState } from '@/components/device/DisconnectedEmptyState'
import { DeviceWorkspaceHeader } from '@/components/device/DeviceWorkspaceHeader'
import { DeviceOverviewTab } from '@/components/device/DeviceOverviewTab'
import { DiagnosticSummary } from '@/components/diagnostics/DiagnosticSummary'
import { ReorganizationWizard } from '@/components/diagnostics/ReorganizationWizard'
import { PrepWizard } from '@/components/device/PrepWizard'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

export function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const action = searchParams.get('action')

  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const setDevices = useDeviceStore((state) => state.setDevices)
  const queryClient = useQueryClient()

  const {
    data: devices = [],
    isLoading,
    isFetching
  } = useQuery({
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

  const diagnostic = useMutation({
    mutationFn: (devicePath: string) =>
      oplApi.runDiagnostics({
        devicePath,
        fileSystem: devices.find((item) => item.path === devicePath)?.fileSystem
      }),
    onSuccess: (result) =>
      queryClient.setQueryData(['device-catalog', result.device.deviceId], result.catalog)
  })

  const { data: summary } = useQuery({
    queryKey: ['summary', activeDevice?.path],
    queryFn: () => (activeDevice ? oplApi.getDeviceSummary(activeDevice.path) : null),
    enabled: Boolean(activeDevice)
  })

  const refreshDevices = () => {
    void queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  if (action === 'prepare') {
    return (
      <PrepWizard
        onClose={() => setSearchParams({ tab: 'overview' })}
        onSuccess={() => {
          refreshDevices()
          setSearchParams({ tab: 'overview' })
        }}
      />
    )
  }

  if (!isLoading && devices.length === 0) {
    return <DisconnectedEmptyState onRefreshDevices={refreshDevices} isScanning={isFetching} />
  }

  const device = summary?.device ?? activeDevice ?? devices[0]

  return (
    <div className="space-y-6">
      {/* Top Workspace Header */}
      {device && (
        <DeviceWorkspaceHeader
          device={device}
          ps2Count={summary?.ps2Games ?? 0}
          ps1Count={summary?.ps1Games ?? 0}
          appsCount={summary?.apps ?? 0}
          issuesCount={device.status === 'ready' ? 0 : 1}
        />
      )}

      {/* Workspace Tabs */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setSearchParams({ tab: 'overview' })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-violet-500 text-white bg-white/5'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <CheckCircle2 className="size-4" />
          Visão Geral
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'manage' })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'manage'
              ? 'border-violet-500 text-white bg-white/5'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <HardDrive className="size-4" />
          Gerenciar Dispositivos ({devices.length})
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'diagnostics' })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'diagnostics'
              ? 'border-violet-500 text-white bg-white/5'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <ScanSearch className="size-4" />
          Diagnóstico
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <DeviceOverviewTab
          ps2Count={summary?.ps2Games ?? 0}
          ps1Count={summary?.ps1Games ?? 0}
          appsCount={summary?.apps ?? 0}
          issuesCount={device?.status === 'ready' ? 0 : 1}
        />
      )}

      {activeTab === 'manage' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-white">Dispositivos Conectados</h3>
            <button
              onClick={refreshDevices}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:text-white"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Atualizar Lista
            </button>
          </div>
          <div className="grid gap-3">
            {devices.map((item) => (
              <DeviceCard
                key={item.id}
                device={item}
                selected={activeDevice?.path === item.path}
                onSelect={() => {
                  setActiveDevice(item)
                  void queryClient.invalidateQueries({ queryKey: ['device-catalog'] })
                  diagnostic.mutate(item.path)
                }}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === 'diagnostics' && (
        <div className="space-y-4">
          {activeDevice && (
            <button
              onClick={() => diagnostic.mutate(activeDevice.path)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-violet-500"
            >
              <ScanSearch className="size-4" />
              Executar Verificação Completa
            </button>
          )}
          {diagnostic.data ? <DiagnosticSummary diagnostic={diagnostic.data} /> : null}
          {diagnostic.data?.readiness === 'requires-reorganization' && activeDevice ? (
            <ReorganizationWizard device={activeDevice} />
          ) : null}
        </div>
      )}
    </div>
  )
}
