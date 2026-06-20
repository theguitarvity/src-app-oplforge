import { NavLink } from 'react-router-dom'
import { Boxes, Clock3, CloudDownload, Database, Download, FolderInput, Gamepad2, HardDrive, Home, Images, LibraryBig, Settings, SlidersHorizontal, Sparkles, Trophy, Wrench } from 'lucide-react'
import { cn } from '@/utils/cn'

const items = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/devices', label: 'Dispositivos', icon: HardDrive },
  { to: '/prepare', label: 'Preparar', icon: Wrench },
  { to: '/games/ps2', label: 'Jogos PS2', icon: Gamepad2 },
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
  return (
    <aside className="relative z-20 flex w-72 flex-col border-r border-white/10 bg-black/30 p-5 backdrop-blur-2xl">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-glow">
          <Database className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">OPL Forge</h1>
          <p className="text-xs text-muted-foreground">Prepare seu HD do PS2</p>
        </div>
      </div>

      <nav className="space-y-1">
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

      <div className="mt-auto rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
        <p className="text-sm font-medium text-white">Uso legal</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Utilize apenas backups de jogos que voce possua legalmente ou arquivos distribuidos por seus respectivos autores.
        </p>
      </div>
    </aside>
  )
}
