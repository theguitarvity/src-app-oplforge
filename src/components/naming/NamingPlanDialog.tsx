import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import type { NamingPlan } from '../../types/opl-finalization'
import { Button } from '@/components/ui/button'

export function NamingPlanDialog({
  plan,
  open,
  pending,
  error,
  onCancel,
  onConfirm
}: {
  plan: NamingPlan
  open: boolean
  pending?: boolean
  error?: string
  onCancel(): void
  onConfirm(): void | Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-white/10 bg-[#12111b] p-6 shadow-glow">
          <Dialog.Title className="text-xl font-semibold text-white">
            {t('components.namingPlanDialog.title')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {t('components.namingPlanDialog.description')}
          </Dialog.Description>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
              <p className="text-2xl font-semibold text-emerald-200">{plan.itemIds.length}</p>
              <p className="text-xs text-muted-foreground">
                {t('components.namingPlanDialog.renamesSelected')}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-2xl font-semibold text-white">{plan.exclusions.length}</p>
              <p className="text-xs text-muted-foreground">
                {t('components.namingPlanDialog.itemsPreserved')}
              </p>
            </div>
          </div>
          {plan.exclusions.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
              <p className="text-sm font-medium text-amber-100">
                {t('components.namingPlanDialog.unchangedTitle')}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {plan.exclusions.map((item) => (
                  <li key={item.itemId}>{item.reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
              {t('components.namingPlanDialog.cancel')}
            </Button>
            <Button
              type="button"
              disabled={pending || plan.itemIds.length === 0}
              onClick={() => void onConfirm()}
            >
              {pending
                ? t('components.namingPlanDialog.renaming')
                : t('components.namingPlanDialog.confirm')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
