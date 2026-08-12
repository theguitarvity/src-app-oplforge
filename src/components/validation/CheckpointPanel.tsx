import { useTranslation } from 'react-i18next'
import type { ValidationCheckpoint, ValidationCheckpointResult } from '@/types/opl'
import { Button } from '@/components/ui/button'

export function CheckpointPanel({
  checkpoints,
  onConfirm
}: {
  checkpoints: ValidationCheckpoint[]
  onConfirm(stage: number, result: ValidationCheckpointResult): void
}) {
  const { t } = useTranslation()
  const labels = t('components.checkpointPanel.labels', { returnObjects: true }) as string[]
  const resultLabels: Record<ValidationCheckpointResult, string> = {
    passed: t('components.checkpointPanel.passed'),
    failed: t('components.checkpointPanel.failed'),
    'not-verified': t('components.checkpointPanel.notVerified')
  }
  return (
    <div className="space-y-2">
      {labels.map((label, index) => {
        const stage = index + 1
        const current = checkpoints.find((item) => item.stage === stage)
        return (
          <div
            key={label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 p-3"
          >
            <span>
              {stage}. {label} —{' '}
              {current ? resultLabels[current.result] : t('components.checkpointPanel.waiting')}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="secondary" onClick={() => onConfirm(stage, 'passed')}>
                {t('components.checkpointPanel.passed')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onConfirm(stage, 'failed')}>
                {t('components.checkpointPanel.failed')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onConfirm(stage, 'not-verified')}
              >
                {t('components.checkpointPanel.notVerified')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
