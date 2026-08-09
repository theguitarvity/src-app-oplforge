import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDrive, Home, LibraryBig, LoaderCircle, Search, Settings, Wrench } from 'lucide-react'
import logo from '@/assets/opl-forge-logo.png'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { cn } from '@/utils/cn'

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
