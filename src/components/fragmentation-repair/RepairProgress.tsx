import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RepairEvent, RepairOperation } from '@/types/opl'
import { Button } from '@/components/ui/button'
import { oplApi } from '@/services/api'

const terminal = new Set<RepairEvent['phase']>([
  'cleanup-complete',
  'aborted-unchanged',
  'restored',
  'recovery-pending'
])

export function RepairProgress({
  operation,
  onTerminal
}: {
  operation: RepairOperation
  onTerminal(operationId: string): void
}) {
  const { t } = useTranslation()
  const [events, setEvents] = useState<RepairEvent[]>([])
  const [cancelPending, setCancelPending] = useState(false)
  useEffect(
    () =>
      oplApi.onFragmentationRepairEvent((event) => {
        if (event.operationId !== operation.operationId) return
        setEvents((current) =>
          current.some((item) => item.sequence === event.sequence)
            ? current
            : [...current, event].sort((a, b) => a.sequence - b.sequence)
        )
        if (terminal.has(event.phase)) onTerminal(operation.operationId)
      }),
    [onTerminal, operation.operationId]
  )
  const latest = events.at(-1)
  async function cancel() {
    setCancelPending(true)
    try {
      await oplApi.cancelFragmentationRepair(operation.operationId)
    } finally {
      setCancelPending(false)
    }
  }
  return (
    <section
      aria-labelledby="repair-progress-title"
      className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="repair-progress-title" className="font-semibold text-white">
            {t('components.repairProgress.title')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {latest?.message ?? t('components.repairProgress.preparingOperation')}
          </p>
        </div>
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={cancelPending}
          onClick={() => void cancel()}
        >
          {t('components.repairProgress.cancelRepair')}
        </Button>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded bg-white/10"
        role="progressbar"
        aria-label={t('components.repairProgress.ariaTotalProgress') ?? ''}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={latest?.progress ?? 0}
      >
        <div className="h-full bg-violet-400" style={{ width: `${latest?.progress ?? 0}%` }} />
      </div>
      <ol className="mt-3 space-y-1 text-sm">
        {events.map((event) => (
          <li key={event.sequence}>
            <span className="text-muted-foreground">
              #{event.sequence}
              {event.installationId ? ` · ${event.installationId}` : ''}
            </span>{' '}
            {event.message}
          </li>
        ))}
      </ol>
    </section>
  )
}
