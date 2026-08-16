import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HardDrive, ScanSearch, CheckCircle2, FolderPlus, RefreshCw, Wrench } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DeviceCard } from '@/components/DeviceCard'
import { DisconnectedEmptyState } from '@/components/device/DisconnectedEmptyState'
import { DeviceWorkspaceHeader } from '@/components/device/DeviceWorkspaceHeader'
import { DeviceOverviewTab } from '@/components/device/DeviceOverviewTab'
import { DiagnosticSummary } from '@/components/diagnostics/DiagnosticSummary'
import { ReorganizationWizard } from '@/components/diagnostics/ReorganizationWizard'
import { PrepWizard } from '@/components/device/PrepWizard'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { DeviceInfo } from '@/types/opl'

interface ManagedDeviceCardProps {
  item: DeviceInfo
  selected: boolean
  subfolderPath?: string
  onSelect: () => void
  onSelectSubfolder: () => void
  onClearSubfolder: () => void
  onPrepare: () => void
}

function ManagedDeviceCard({
  item,
  selected,
  subfolderPath,
  onSelect,
  onSelectSubfolder,
  onClearSubfolder,
  onPrepare
}: ManagedDeviceCardProps) {
  const { data: subfolderSummary } = useQuery({
    queryKey: ['subfolder-summary', item.id, subfolderPath],
    queryFn: () => oplApi.getDeviceSummary(subfolderPath!),
    enabled: Boolean(subfolderPath)
  })

  const effectiveDevice: DeviceInfo =
    subfolderPath && subfolderSummary?.device
      ? { ...subfolderSummary.device, id: item.id, name: item.name, sourceKind: item.sourceKind }
      : item

  return (
    <DeviceCard
      device={effectiveDevice}
      rootPath={subfolderPath ? item.path : undefined}
      selected={selected}
      onSelect={onSelect}
      onSelectSubfolder={onSelectSubfolder}
      onClearSubfolder={onClearSubfolder}
      onPrepare={onPrepare}
    />
  )
}

export function DevicesPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const action = searchParams.get('action')

  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const setDevices = useDeviceStore((state) => state.setDevices)
  const subfolderByDeviceId = useDeviceStore((state) => state.subfolderByDeviceId)
  const setSubfolderForDevice = useDeviceStore((state) => state.setSubfolderForDevice)
  const clearSubfolderForDevice = useDeviceStore((state) => state.clearSubfolderForDevice)
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

  const [subfolderError, setSubfolderError] = useState<string | null>(null)
  const [prepareTarget, setPrepareTarget] = useState<DeviceInfo | null>(null)

  /** The root device with its remembered subfolder (if any) resolved as the effective
   *  target — same `id` as the root so selection/preparation stay consistent when the
   *  user switches devices and comes back. */
  const resolveEffectiveDevice = async (item: DeviceInfo): Promise<DeviceInfo> => {
    const subfolderPath = subfolderByDeviceId[item.id]
    if (!subfolderPath) return item
    const summary = await oplApi.getDeviceSummary(subfolderPath)
    if (!summary.device) return item
    return {
      ...summary.device,
      id: item.id,
      name: `${item.name} → ${subfolderPath.split(/[\\/]/).filter(Boolean).at(-1) || summary.device.name}`,
      sourceKind: item.sourceKind
    }
  }

  const preparePresetDevice = async (item: DeviceInfo) => {
    setPrepareTarget(await resolveEffectiveDevice(item))
    setSearchParams({ tab: 'manage', action: 'prepare' })
  }

  const refreshDevices = () => {
    void queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  const selectDevice = async (item: DeviceInfo) => {
    const effective = await resolveEffectiveDevice(item)
    setActiveDevice(effective)
    void queryClient.invalidateQueries({ queryKey: ['device-catalog'] })
    diagnostic.mutate(effective.path)
  }

  const selectSubfolder = async (item: DeviceInfo) => {
    setSubfolderError(null)
    try {
      const [picked] = await oplApi.openPathDialog({
        mode: 'folder',
        defaultPath: item.path,
        withinRoot: item.path
      })
      if (!picked) return
      const summary = await oplApi.getDeviceSummary(picked)
      if (!summary.device) {
        setSubfolderError(t('pages.devices.couldNotReadSubfolder'))
        return
      }
      setSubfolderForDevice(item.id, picked)
      const subfolder: DeviceInfo = {
        ...summary.device,
        id: item.id,
        name: `${item.name} → ${picked.split(/[\\/]/).filter(Boolean).at(-1) || summary.device.name}`,
        sourceKind: item.sourceKind
      }
      setActiveDevice(subfolder)
      void queryClient.invalidateQueries({ queryKey: ['device-catalog'] })
      diagnostic.mutate(subfolder.path)
    } catch (err) {
      setSubfolderError(err instanceof Error ? err.message : t('pages.devices.subfolderPickFailed'))
    }
  }

  const clearSubfolder = (item: DeviceInfo) => {
    clearSubfolderForDevice(item.id)
    if (activeDevice?.id === item.id) void selectDevice(item)
  }

  const addLocalLibrary = async () => {
    const [selectedPath] = await oplApi.openPathDialog({ mode: 'folder' })
    if (!selectedPath) return
    await oplApi.authorizeLocalFolder(selectedPath)
    const local = {
      id: `local:${selectedPath}`,
      name:
        selectedPath.split(/[\\/]/).filter(Boolean).at(-1) || t('pages.devices.defaultLocalName'),
      path: selectedPath,
      total: 0,
      free: 0,
      used: 0,
      fileSystem: t('pages.devices.localFolderLabel'),
      status: 'ready' as const,
      sourceKind: 'local-folder' as const
    }
    setDevices([...devices, local])
    setActiveDevice(local)
    setSearchParams({ tab: 'manage' })
  }

  if (action === 'prepare') {
    return (
      <PrepWizard
        initialDevice={prepareTarget}
        onClose={() => {
          setPrepareTarget(null)
          setSearchParams({ tab: 'manage' })
        }}
        onSuccess={() => {
          setPrepareTarget(null)
          refreshDevices()
          setSearchParams({ tab: 'overview' })
        }}
      />
    )
  }

  if (!isLoading && devices.length === 0)
    return (
      <div className="space-y-5">
        <DisconnectedEmptyState onRefreshDevices={refreshDevices} isScanning={isFetching} />
        <button
          onClick={() => void addLocalLibrary()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
        >
          <FolderPlus className="size-5" /> {t('pages.devices.addLocalFolder')}
        </button>
      </div>
    )

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
          {t('pages.devices.tabOverview')}
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
          {t('pages.devices.tabManage', { count: devices.length })}
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
          {t('pages.devices.tabDiagnostics')}
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
            <h3 className="text-sm font-semibold text-white">
              {t('pages.devices.connectedDevices')}
            </h3>
            <button
              onClick={refreshDevices}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:text-white"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {t('pages.devices.refreshList')}
            </button>
            <button
              onClick={() => {
                setPrepareTarget(null)
                setSearchParams({ tab: 'manage', action: 'prepare' })
              }}
              className="flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-500/20"
            >
              <Wrench className="size-3.5" /> {t('pages.devices.prepareDevice')}
            </button>
            <button
              onClick={() => void addLocalLibrary()}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              <FolderPlus className="size-3.5" /> {t('pages.devices.addLocalFolderShort')}
            </button>
          </div>
          {subfolderError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/20 p-3 text-xs text-rose-200">
              {subfolderError}
            </div>
          )}
          <div className="grid gap-3">
            {devices.map((item) => (
              <ManagedDeviceCard
                key={item.id}
                item={item}
                selected={activeDevice?.id === item.id}
                subfolderPath={subfolderByDeviceId[item.id]}
                onSelect={() => void selectDevice(item)}
                onSelectSubfolder={() => void selectSubfolder(item)}
                onClearSubfolder={() => clearSubfolder(item)}
                onPrepare={() => void preparePresetDevice(item)}
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
              {t('pages.devices.runFullScan')}
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
