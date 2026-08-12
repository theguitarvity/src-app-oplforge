import { CheckCircle2, PlusCircle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GameScoreBadge } from '@/components/catalog/GameScoreBadge'
import type { CatalogGame } from '@/types/opl'
import { formatBytes } from '@/utils/format'

interface CatalogGameCardProps {
  game: CatalogGame
  selected: boolean
  onToggle: () => void
  /** Only passed for user-managed lists (e.g. the custom Essentials catalog) — renders a delete action alongside select. */
  onRemove?: () => void
}

export function CatalogGameCard({ game, selected, onToggle, onRemove }: CatalogGameCardProps) {
  const { t } = useTranslation()
  return (
    <Card className={selected ? 'border-violet-400/50 bg-violet-500/10' : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <GameScoreBadge tier={game.scoreTier} score={game.score} />
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-muted-foreground">
              {game.priority}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-muted-foreground">
              {game.mediaType}
            </span>
          </div>
          <h3 className="font-semibold text-white">{game.title}</h3>
          <p className="mt-1 text-xs text-white/40">{game.fileName}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {game.genres.join(', ') || t('components.catalogGameCard.unrated')} -{' '}
            {formatBytes(game.sizeBytes ?? 0)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRemove ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              title={t('components.catalogGameCard.removeFromList') ?? ''}
            >
              <Trash2 className="size-4 text-red-300" />
            </Button>
          ) : null}
          <Button variant={selected ? 'secondary' : 'primary'} onClick={onToggle}>
            {selected ? <CheckCircle2 className="size-4" /> : <PlusCircle className="size-4" />}
            {selected
              ? t('components.catalogGameCard.selected')
              : t('components.catalogGameCard.select')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
