import { CheckCircle2, AlertTriangle, FileCheck, ScanSearch, Gamepad2 } from 'lucide-react'
import type { UnifiedGameItem } from '@/types/library'

interface GameRowProps {
  item: UnifiedGameItem
  onSelect: (item: UnifiedGameItem) => void
}

function formatBytes(bytes?: number) {
  if (!bytes) return '-'
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(2)} GB`
}

export function GameRow({ item, onSelect }: GameRowProps) {
  return (
    <tr
      onClick={() => onSelect(item)}
      className="group border-b border-white/5 bg-white/5 transition hover:bg-white/10 cursor-pointer"
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-black/40 text-violet-400 border border-white/10">
            <Gamepad2 className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white group-hover:text-violet-300 transition">
              {item.title}
            </p>
            <p className="text-[10px] text-muted-foreground truncate max-w-xs">{item.filePath}</p>
          </div>
        </div>
      </td>

      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.gameId || '-'}</td>
      <td className="py-3 px-4 text-xs font-semibold text-violet-300">{item.type}</td>
      <td className="py-3 px-4 text-xs text-muted-foreground">{item.region || 'NTSC-U'}</td>
      <td className="py-3 px-4 text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</td>

      <td className="py-3 px-4 text-right">
        {item.status === 'ready' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            <CheckCircle2 className="size-3" /> Pronto
          </span>
        )}
        {item.status === 'fragmented' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            <ScanSearch className="size-3" /> Fragmentado
          </span>
        )}
        {item.status === 'invalid_name' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-300">
            <FileCheck className="size-3" /> Nome Inválido
          </span>
        )}
        {item.status === 'needs_attention' && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            <AlertTriangle className="size-3" /> Atenção
          </span>
        )}
      </td>
    </tr>
  )
}
