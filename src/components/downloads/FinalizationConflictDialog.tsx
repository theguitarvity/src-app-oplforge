import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FinalizationPlan } from '../../types/opl-finalization'

export interface FinalizationConflictDialogProps {
  plan: FinalizationPlan
  open: boolean
  onCancel(): void
  onConfirm(input: {
    planId: string
    expectedRevision: number
    collisionResolution?: 'keep-existing' | 'replace-identical' | 'replace-authorized'
  }): void | Promise<void>
}

export function FinalizationConflictDialog({
  plan,
  open,
  onCancel,
  onConfirm
}: FinalizationConflictDialogProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const [resolution, setResolution] = useState<
    'keep-existing' | 'replace-identical' | 'replace-authorized'
  >('keep-existing')
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId}>{t('components.finalizationConflictDialog.title')}</h2>
      <p id={descriptionId}>{t('components.finalizationConflictDialog.description')}</p>
      <dl>
        <dt>{t('components.finalizationConflictDialog.canonicalName')}</dt>
        <dd>{plan.canonicalName ?? t('components.finalizationConflictDialog.pendingIdentity')}</dd>
        <dt>{t('components.finalizationConflictDialog.destination')}</dt>
        <dd>{plan.destinationRelativePaths.join(', ')}</dd>
        <dt>{t('components.finalizationConflictDialog.verification')}</dt>
        <dd>{plan.verificationCapability}</dd>
      </dl>
      {plan.collision && (
        <fieldset>
          <legend>{t('components.finalizationConflictDialog.existingFile')}</legend>
          {(['keep-existing', 'replace-identical', 'replace-authorized'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="collision-resolution"
                value={value}
                checked={resolution === value}
                onChange={() => setResolution(value)}
              />{' '}
              {value}
            </label>
          ))}
        </fieldset>
      )}
      <button type="button" onClick={onCancel}>
        {t('components.finalizationConflictDialog.cancel')}
      </button>
      <button
        type="button"
        onClick={() =>
          void onConfirm({
            planId: plan.planId,
            expectedRevision: plan.revision,
            collisionResolution: plan.collision ? resolution : undefined
          })
        }
      >
        {t('components.finalizationConflictDialog.finalize')}
      </button>
    </div>
  )
}
