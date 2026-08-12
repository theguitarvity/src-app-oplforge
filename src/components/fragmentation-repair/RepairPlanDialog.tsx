import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RepairPlan } from '@/types/opl'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/format'

export function RepairPlanDialog({
  plan,
  pending,
  error,
  onCancel,
  onConfirm
}: {
  plan: RepairPlan
  pending?: boolean
  error?: string
  onCancel(): void
  onConfirm(): void
}) {
  const { t } = useTranslation()
  const [confirmation, setConfirmation] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="repair-plan-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl"
      >
        <h2 id="repair-plan-title" className="text-xl font-semibold text-white">
          {t('components.repairPlanDialog.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('components.repairPlanDialog.description')}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">
              {t('components.repairPlanDialog.temporarySpace')}
            </dt>
            <dd>{formatBytes(plan.peakTemporaryBytes)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t('components.repairPlanDialog.observedFreeSpace')}
            </dt>
            <dd>{formatBytes(plan.freeBytesObserved)}</dd>
          </div>
        </dl>
        <div className="mt-4 space-y-3">
          {plan.items.map((item) => (
            <article key={item.installation.installationId} className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-white">{item.installation.title}</h3>
                <span className="text-xs text-muted-foreground">
                  {t('components.repairPlanDialog.order', { value: item.order })}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase text-muted-foreground">
                {t('components.repairPlanDialog.filesToRewrite')}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {item.filesToRewrite.map((file) => (
                  <li className="break-all" key={file}>
                    {file}
                  </li>
                ))}
              </ul>
              {item.installation.format === 'USBExtreme' ? (
                <div className="mt-3 rounded-lg border border-white/10 p-2 text-sm">
                  <p className="font-medium text-white">
                    {item.ulCfgAction === 'replace'
                      ? t('components.repairPlanDialog.replaceUlCfg')
                      : t('components.repairPlanDialog.preserveUlCfg')}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {item.ulCfgJustification ??
                      t('components.repairPlanDialog.noUlCfgChangeNeeded')}
                  </p>
                </div>
              ) : null}
              <p className="mt-2 text-xs uppercase text-muted-foreground">
                {t('components.repairPlanDialog.risks')}
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-200">
                {item.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        {plan.exclusions.length > 0 ? (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
            <h3 className="font-medium text-amber-100">
              {t('components.repairPlanDialog.excludedGamesTitle')}
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {plan.exclusions.map((exclusion) => (
                <li key={exclusion.installation.installationId}>
                  <span className="font-medium">{exclusion.installation.title}</span> —{' '}
                  {exclusion.explanation}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm">
          <p className="font-medium text-emerald-200">
            {t('components.repairPlanDialog.recovery')}
          </p>
          <p className="mt-1">{plan.recoveryStrategy}</p>
        </div>
        <label className="mt-4 block text-sm text-muted-foreground">
          {t('components.repairPlanDialog.typeToConfirm', { value: plan.confirmationText })}
          <input
            ref={inputRef}
            className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        {error ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t('components.repairPlanDialog.cancel')}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={confirmation !== plan.confirmationText || pending}
          >
            {t('components.repairPlanDialog.confirmRepair')}
          </Button>
        </div>
      </section>
    </div>
  )
}
