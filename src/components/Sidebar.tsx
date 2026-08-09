import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  HardDrive,
  Home,
  LibraryBig,
  LoaderCircle,
  Search,
  Settings,
  Wrench
} from 'lucide-react'
import logo from '@/assets/opl-forge-logo.png'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { cn } from '@/utils/cn'
import { useDownloadStore } from '@/stores/download-store'

const primaryItems = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/devices', label: 'Dispositivos', icon: HardDrive },
  { to: '/library', label: 'Biblioteca', icon: LibraryBig },
  { to: '/catalog', label: 'Catálogo', icon: Search },
  { to: '/tools', label: 'Ferramentas', icon: Wrench },
  { to: '/settings', label: 'Configurações', icon: Settings }
]

export function Sidebar() {
  const queryClient = useQueryClient()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const devices = useDeviceStore((state) => state.devices)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const [catalogScanning, setCatalogScanning] = useState(false)
  const downloadTaskMap = useDownloadStore((state) => state.tasks)
  const downloadTasks = Object.values(downloadTaskMap)
  const activeDownloads = downloadTasks.filter(
    (task) => !['ready', 'failed', 'cancelled'].includes(task.phase)
  )
  const failedDownloads = downloadTasks.filter((task) => task.phase === 'failed').length
  const averageDownloadProgress = activeDownloads.length
    ? Math.round(
        activeDownloads.reduce((sum, task) => sum + task.overallProgress, 0) /
          activeDownloads.length
      )
    : 0
  useEffect(
    () =>
      oplApi.onCatalogEvent((snapshot) => {
        if (!activeDevice) return
        setCatalogScanning(snapshot.status === 'provisional')
      }),
    [activeDevice]
  )
  const diagnosis = useQuery({
    queryKey: ['fragmentation-diagnosis-activity', activeDevice?.path],
    queryFn: () => oplApi.getCurrentFragmentationDiagnosis(activeDevice!.path),
    enabled: Boolean(activeDevice),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 500 : false)
  })
  useEffect(
    () =>
      oplApi.onFragmentationRepairEvent((event) => {
        if (event.phase !== 'diagnosing' && event.phase !== 'diagnosis-complete') return
        void queryClient.invalidateQueries({
          queryKey: ['fragmentation-diagnosis-activity', activeDevice?.path]
        })
      }),
    [activeDevice?.path, queryClient]
  )
  const activity = diagnosis.data?.status === 'running' ? diagnosis.data : undefined
  const diagnosisPercent = Math.round((activity?.progress ?? 0) * 100)

  return (
    <aside className="relative z-20 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black/40 backdrop-blur-2xl">
      {/* Brand Header */}
      <div className="shrink-0 px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 shadow-glow">
            <img src={logo} alt="" className="size-9 object-contain" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white">OPL Forge</h1>
            <p className="text-xs text-muted-foreground">PS2 Storage Workspace</p>
          </div>
        </div>
      </div>

      {/* Main Consolidated Navigation - Max 6 items, fits without scrollbar */}
      <nav className="flex-1 space-y-1.5 px-4 py-3">
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-muted-foreground transition hover:bg-white/10 hover:text-white',
                isActive &&
                  'bg-violet-600/20 text-white border border-violet-500/30 font-semibold shadow-sm'
              )
            }
          >
            <item.icon className="size-4.5 text-violet-400" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {activeDevice ? (
        <div className="mx-4 mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3 shadow-[0_0_24px_rgba(16,185,129,.08)]">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              {catalogScanning ? 'Lendo biblioteca…' : 'Dispositivo ativo'}
            </span>
            {catalogScanning ? (
              <LoaderCircle className="ml-auto size-3.5 animate-spin text-violet-300" />
            ) : null}
          </div>
          {devices.length > 1 ? (
            <select
              className="mt-2 h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-xs font-medium text-white outline-none focus:border-violet-400"
              value={activeDevice.id}
              onChange={(event) =>
                setActiveDevice(devices.find((device) => device.id === event.target.value) ?? null)
              }
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name || device.path}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-2 truncate text-sm font-semibold text-white" title={activeDevice.path}>
              {activeDevice.name || 'Dispositivo OPL'}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{activeDevice.fileSystem || 'Sistema detectado'}</span>
            <Link to="/devices" className="shrink-0 text-violet-300 hover:text-violet-200">
              Trocar
            </Link>
          </div>
        </div>
      ) : null}

      {activeDownloads.length > 0 || failedDownloads > 0 ? (
        <Link
          to="/catalog?tab=downloads"
          className="mx-4 mb-3 block rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3 transition hover:border-violet-400/40 hover:bg-violet-500/15"
        >
          <div className="flex items-center gap-2">
            <span className="relative grid size-8 place-items-center rounded-xl bg-violet-500/20">
              <Download className="size-4 text-violet-200" />
              {activeDownloads.length > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,.9)]" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Downloads</p>
              <p className="text-[11px] text-muted-foreground">
                {activeDownloads.length > 0
                  ? `${activeDownloads.length} ativo(s) · ${averageDownloadProgress}%`
                  : `${failedDownloads} requer atenção`}
              </p>
            </div>
            <span className="text-xs text-violet-300">Abrir</span>
          </div>
          {activeDownloads.length > 0 ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                style={{ width: `${averageDownloadProgress}%` }}
              />
            </div>
          ) : null}
        </Link>
      ) : null}

      {/* Active Diagnostic Status Indicator */}
      {activity ? (
        <div className="mx-4 mb-3" role="status" aria-live="polite">
          <NavLink
            to="/tools?tab=diagnostics"
            className="block rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 text-xs transition hover:bg-violet-500/15"
          >
            <span className="flex items-center gap-2 font-medium text-white">
              <LoaderCircle className="size-3.5 animate-spin text-violet-300" aria-hidden="true" />
              Diagnóstico em andamento
            </span>
            <span className="mt-2 flex justify-between text-muted-foreground">
              <span>
                {activity.totalItems > 0
                  ? `${activity.processedItems}/${activity.totalItems} jogos`
                  : 'Inventariando'}
              </span>
              <span>{diagnosisPercent}%</span>
            </span>
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/40">
              <span
                className="block h-full rounded-full bg-violet-400 transition-all duration-300"
                style={{ width: `${diagnosisPercent}%` }}
              />
            </span>
          </NavLink>
        </div>
      ) : null}

      {/* Legal Footer Notice */}
      <div className="mx-4 mb-4 shrink-0 rounded-xl border border-white/5 bg-white/5 p-3.5">
        <p className="text-xs font-medium text-white">Uso legal</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Utilize apenas backups de jogos que você possua legalmente.
        </p>
      </div>
    </aside>
  )
}
