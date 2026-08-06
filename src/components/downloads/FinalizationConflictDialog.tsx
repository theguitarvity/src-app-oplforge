import { useId, useState } from 'react'
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
  const titleId = useId()
  const descriptionId = useId()
  const [resolution, setResolution] = useState<
    'keep-existing' | 'replace-identical' | 'replace-authorized'
  >('keep-existing')
  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <h2 id={titleId}>Confirmar finalização OPL</h2>
      <p id={descriptionId}>
        Revise a identidade, o nome e qualquer colisão antes de gravar no dispositivo.
      </p>
      <dl>
        <dt>Nome canônico</dt>
        <dd>{plan.canonicalName ?? 'Identidade pendente'}</dd>
        <dt>Destino</dt>
        <dd>{plan.destinationRelativePaths.join(', ')}</dd>
        <dt>Verificação</dt>
        <dd>{plan.verificationCapability}</dd>
      </dl>
      {plan.collision && (
        <fieldset>
          <legend>Arquivo existente</legend>
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
        Cancelar
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
        Finalizar backup para OPL
      </button>
    </div>
  )
}
