import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  Clock3,
  CloudDownload,
  Download,
  FolderInput,
  FilePenLine,
  Gamepad2,
  HardDrive,
  Home,
  Images,
  LibraryBig,
  LoaderCircle,
  MonitorPlay,
  ScanSearch,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Wrench
} from 'lucide-react'
import logo from '@/assets/opl-forge-logo.png'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { cn } from '@/utils/cn'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/devices', label: 'Dispositivos', icon: HardDrive },
  { to: '/prepare', label: 'Preparar', icon: Wrench },
  { to: '/games/ps2', label: 'Jogos PS2', icon: Gamepad2 },
  { to: '/library', label: 'Biblioteca OPL', icon: LibraryBig },
  { to: '/fragmentation-repair', label: 'Fragmentação', icon: ScanSearch },
  { to: '/naming', label: 'Nomes OPL', icon: FilePenLine },
  { to: '/validation', label: 'Validar no PCSX2', icon: MonitorPlay },
  { to: '/games/ps1', label: 'Jogos PS1', icon: Sparkles },
  { to: '/apps', label: 'Apps', icon: Boxes },
  { to: '/catalog', label: 'Catálogo', icon: LibraryBig },
  { to: '/catalog/essentials', label: 'Essentials', icon: Trophy },
  { to: '/art-manager', label: 'ART Manager', icon: Images },
  { to: '/sources', label: 'Fontes', icon: FolderInput },
  { to: '/sources/online', label: 'Fontes Online', icon: CloudDownload },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/history', label: 'Historico', icon: Clock3 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/settings/sources', label: 'Config. Fontes', icon: SlidersHorizontal }
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
    <aside className="relative z-20 flex h-screen w-72 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black/30 backdrop-blur-2xl">
      <div className="shrink-0 px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 shadow-glow">
            <img src={logo} alt="" className="size-10 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">OPL Forge</h1>
            <p className="text-xs text-muted-foreground">Prepare seu HD do PS2</p>
          </div>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-2 [scrollbar-color:rgba(139,92,246,.45)_transparent] [scrollbar-width:thin]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-white/8 hover:text-white',
                isActive && 'bg-white/10 text-white shadow-sm'
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {activity ? (
        <div className="mx-5 mt-4" role="status" aria-live="polite">
          <NavLink
            to="/fragmentation-repair"
            className="block rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 text-sm transition hover:bg-violet-500/15"
          >
            <span className="flex items-center gap-2 font-medium text-white">
              <LoaderCircle className="size-4 animate-spin text-violet-300" aria-hidden="true" />
              Diagnóstico em andamento
            </span>
            <span className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                {activity.totalItems > 0
                  ? `${activity.processedItems}/${activity.totalItems} jogos`
                  : 'Inventariando'}
              </span>
              <span>{diagnosisPercent}%</span>
            </span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-black/30">
              <span
                className="block h-full rounded-full bg-violet-400"
                style={{ width: `${diagnosisPercent}%` }}
              />
            </span>
            <span className="mt-2 block text-xs text-violet-200">Ver detalhes</span>
          </NavLink>
        </div>
      ) : null}

      <div className="mx-5 mb-5 mt-4 shrink-0 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
        <p className="text-sm font-medium text-white">Uso legal</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Utilize apenas backups de jogos que voce possua legalmente ou arquivos distribuidos por
          seus respectivos autores.
        </p>
      </div>
    </aside>
  )
}
