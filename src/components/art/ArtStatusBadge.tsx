import type { GameArtStatus } from '@/types/opl'

export function ArtStatusBadge({ status }: { status: GameArtStatus }) {
  const label = status === 'complete' ? 'Completo' : status === 'partial' ? 'Parcial' : 'Ausente'
  return <span className="rounded-full border border-white/10 bg-white/8 px-2 py-1 text-xs text-white/75">ART {label}</span>
}
