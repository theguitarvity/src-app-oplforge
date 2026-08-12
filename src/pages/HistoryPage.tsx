import { Clock3, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { oplApi } from '@/services/api'
import { formatDate } from '@/utils/format'

export function HistoryPage() {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const queryClient = useQueryClient()
  const { data: history = [] } = useQuery({ queryKey: ['history'], queryFn: oplApi.getHistory })
  const clearMutation = useMutation({
    mutationFn: oplApi.clearHistory,
    onSuccess: () => {
      setConfirmOpen(false)
      return queryClient.invalidateQueries({ queryKey: ['history'] })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t('pages.history.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('pages.history.subtitle')}</p>
        </div>
        <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="size-4" /> {t('pages.history.clearButton')}
        </Button>
      </div>
      {history.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title={t('pages.history.emptyTitle')}
          description={t('pages.history.emptyDescription')}
        />
      ) : null}
      <div className="space-y-3">
        {history.map((entry) => (
          <Card key={entry.id} className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-white">{entry.operation}</p>
                <p className="mt-1 text-sm text-muted-foreground">{entry.message}</p>
                <p className="mt-2 text-xs text-white/40">
                  {entry.origin ? t('pages.history.origin', { value: entry.origin }) : ''}
                </p>
                <p className="text-xs text-white/40">
                  {entry.destination
                    ? t('pages.history.destination', { value: entry.destination })
                    : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/80">
                  {entry.result}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">{formatDate(entry.timestamp)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('pages.history.confirmTitle')}
        description={t('pages.history.confirmDescription')}
        confirmLabel={t('pages.history.confirmLabel')}
        onConfirm={() => clearMutation.mutate()}
      />
    </div>
  )
}
