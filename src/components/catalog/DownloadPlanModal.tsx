import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { SmartFillPlan } from '@/types/opl'
import { formatBytes } from '@/utils/format'

interface DownloadPlanModalProps {
  open: boolean
  plan: SmartFillPlan | null
  onOpenChange: (open: boolean) => void
  onUsePlan: () => void
}

export function DownloadPlanModal({ open, plan, onOpenChange, onUsePlan }: DownloadPlanModalProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[680px] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-3xl border border-white/10 bg-[#12111b] p-6 shadow-glow">
          <Dialog.Title className="text-xl font-semibold text-white">
            {t('components.downloadPlanModal.title')}
          </Dialog.Title>
          {plan ? (
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>
                {t('components.downloadPlanModal.estimatedTotal', {
                  total: formatBytes(plan.estimatedTotalBytes),
                  remaining: formatBytes(plan.remainingBytes)
                })}
              </p>
              {plan.warnings.map((warning) => (
                <p key={warning} className="text-amber-200">
                  {warning}
                </p>
              ))}
              <div className="space-y-2">
                {plan.selectedGames.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <span className="text-white">{game.title}</span>{' '}
                    <span className="text-white/40">{formatBytes(game.sizeBytes ?? 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('components.downloadPlanModal.cancel')}
            </Button>
            <Button onClick={onUsePlan}>{t('components.downloadPlanModal.usePlan')}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
