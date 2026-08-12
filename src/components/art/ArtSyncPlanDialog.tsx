import * as Dialog from '@radix-ui/react-dialog'
import { Image, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ArtSyncPlanSummary } from '../../types/opl-finalization'

export function ArtSyncPlanDialog({
  plan,
  open,
  pending,
  error,
  onCancel,
  onStart
}: {
  plan: ArtSyncPlanSummary
  open: boolean
  pending?: boolean
  error?: string
  onCancel(): void
  onStart(): void | Promise<void>
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
          <Dialog.Title className="flex items-center gap-2 text-xl font-semibold text-white">
            <Image className="size-5 text-violet-300" />
            {t('components.artSyncPlanDialog.title')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {t('components.artSyncPlanDialog.description')}
          </Dialog.Description>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3">
              <p className="text-2xl font-semibold text-violet-200">{plan.gameCount}</p>
              <p className="text-xs text-muted-foreground">
                {t('components.artSyncPlanDialog.gamesRecognized')}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
              <p className="text-2xl font-semibold text-emerald-200">{plan.itemCount}</p>
              <p className="text-xs text-muted-foreground">
                {t('components.artSyncPlanDialog.artsToProcess')}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
            <p className="text-sm text-muted-foreground">
              {t('components.artSyncPlanDialog.policyLabel')}{' '}
              <span className="text-white">
                {plan.replacePolicy === 'missing-only'
                  ? t('components.artSyncPlanDialog.policyMissingOnly')
                  : plan.replacePolicy}
              </span>
              .
            </p>
          </div>
          {plan.warnings.length > 0 ? (
            <ul className="mt-4 space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
              {t('components.artSyncPlanDialog.cancel')}
            </Button>
            <Button
              type="button"
              disabled={pending || plan.itemCount === 0}
              onClick={() => void onStart()}
            >
              {pending
                ? t('components.artSyncPlanDialog.starting')
                : t('components.artSyncPlanDialog.startSync')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
