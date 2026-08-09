import {
  Gamepad2,
  Sparkles,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ScanSearch
} from 'lucide-react'
import type { UnifiedGameItem } from '@/types/library'

interface GameCardProps {
  item: UnifiedGameItem
  onSelect: (item: UnifiedGameItem) => void
}

function formatBytes(bytes?: number) {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(2)} GB`
}

export function GameCard({ item, onSelect }: GameCardProps) {
  return (
    <div
      onClick={() => onSelect(item)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition duration-200 hover:border-violet-500/50 hover:bg-white/10 cursor-pointer shadow-lg"
    >
      {/* Cover / Media Area */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/50">
        {item.hasCoverArt ? (
          <img
            src={`file://${item.filePath}`}
            alt={item.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-violet-950/40 to-slate-950/80 p-4 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/5 border border-white/10 text-violet-400">
              {item.type === 'PS2' && <Gamepad2 className="size-6" />}
              {item.type === 'PS1' && <Sparkles className="size-6" />}
              {item.type === 'APP' && <Boxes className="size-6" />}
            </div>
            <p className="mt-2 text-xs font-semibold text-white line-clamp-2">{item.title}</p>
          </div>
        )}

        {/* Top Type & Region Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-violet-300 backdrop-blur-md">
            {item.type}
          </span>
          {item.region && (
            <span className="rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-mono text-white/80 backdrop-blur-md">
              {item.region}
            </span>
          )}
        </div>

        {/* Status Badge Over Cover */}
        <div className="absolute bottom-2 left-2 right-2">
          {item.status === 'ready' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-2 py-1 text-[10px] font-bold text-black backdrop-blur-md">
              <CheckCircle2 className="size-3" /> Pronto
            </span>
          )}
          {item.status === 'fragmented' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-[10px] font-bold text-black backdrop-blur-md">
              <ScanSearch className="size-3" /> Fragmentado
            </span>
          )}
          {item.status === 'invalid_name' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/90 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
              <FileCheck className="size-3" /> Nome Inválido
            </span>
          )}
          {item.status === 'needs_attention' && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-1 text-[10px] font-bold text-black backdrop-blur-md">
              <AlertTriangle className="size-3" /> Atenção
            </span>
          )}
        </div>
      </div>

      {/* Card Info Details */}
      <div className="flex flex-1 flex-col justify-between p-3.5">
        <div>
          <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-violet-300 transition">
            {item.title}
          </h4>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {item.gameId || 'Sem Game ID'}
          </p>
        </div>
        {item.sizeBytes ? (
          <p className="mt-2 text-[10px] text-muted-foreground/70">{formatBytes(item.sizeBytes)}</p>
        ) : null}
      </div>
    </div>
  )
}
