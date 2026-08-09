import { Link } from 'react-router-dom'
import { HardDrive, RefreshCw, Wrench, Library, Search } from 'lucide-react'

interface DisconnectedEmptyStateProps {
  onRefreshDevices?: () => void
  isScanning?: boolean
}

export function DisconnectedEmptyState({
  onRefreshDevices,
  isScanning
}: DisconnectedEmptyStateProps) {
  return (
    <div className="flex min-h-[460px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center backdrop-blur-md">
      {/* Icon Graphic */}
      <div className="relative mb-6">
        <div className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 shadow-glow">
          <HardDrive className="size-10 text-violet-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full bg-violet-600 text-white shadow">
          <Wrench className="size-4" />
        </div>
      </div>

      {/* Primary Message */}
      <h3 className="text-xl font-bold text-white">Nenhum dispositivo PS2 selecionado</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
        Conecte um HD externo ou dispositivo USB formatado em exFAT/FAT32 para gerenciar seus jogos,
        verificar fragmentação e estrutura OPL.
      </p>

      {/* Primary Recommended CTA */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={onRefreshDevices}
          disabled={isScanning}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Procurando dispositivos...' : 'Detectar dispositivos'}
        </button>

        <Link
          to="/devices?action=prepare"
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <Wrench className="size-4 text-violet-400" />
          Preparar novo dispositivo
        </Link>
      </div>

      {/* Secondary CTAs */}
      <div className="mt-8 flex items-center gap-6 text-xs font-medium text-muted-foreground border-t border-white/10 pt-6">
        <Link to="/library" className="flex items-center gap-1.5 transition hover:text-white">
          <Library className="size-3.5" />
          Abrir biblioteca local
        </Link>
        <span className="text-white/20">•</span>
        <Link to="/catalog" className="flex items-center gap-1.5 transition hover:text-white">
          <Search className="size-3.5" />
          Explorar catálogo
        </Link>
      </div>
    </div>
  )
}
