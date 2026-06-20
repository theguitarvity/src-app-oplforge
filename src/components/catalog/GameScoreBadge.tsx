import type { GameScoreTier } from '@/types/opl'
import { cn } from '@/utils/cn'

const styles: Record<GameScoreTier, string> = {
  S: 'border-fuchsia-300/30 bg-fuchsia-500/20 text-fuchsia-100',
  A: 'border-violet-300/30 bg-violet-500/20 text-violet-100',
  B: 'border-sky-300/30 bg-sky-500/20 text-sky-100',
  C: 'border-amber-300/30 bg-amber-500/20 text-amber-100',
  Unrated: 'border-white/10 bg-white/8 text-muted-foreground'
}

export function GameScoreBadge({ tier, score }: { tier: GameScoreTier; score?: number }) {
  return <span className={cn('rounded-full border px-2 py-1 text-xs font-semibold', styles[tier])}>{tier}{score ? ` - ${score}` : ''}</span>
}
