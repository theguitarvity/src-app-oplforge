import { ImageDown, Pause, Play, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ArtSyncJob } from '../../types/opl-finalization'

export function ArtSyncJobProgress({
  job,
  onPause,
  onResume,
  onRetry
}: {
  job: ArtSyncJob
  onPause?(): void
  onResume?(): void
  onRetry?(): void
}) {
  const { t } = useTranslation()
  const stateLabel: Record<ArtSyncJob['state'], string> = {
    queued: t('components.artSyncJobProgress.stateQueued'),
    running: t('components.artSyncJobProgress.stateRunning'),
    paused: t('components.artSyncJobProgress.statePaused'),
    completed: t('components.artSyncJobProgress.stateCompleted'),
    partial: t('components.artSyncJobProgress.statePartial'),
    failed: t('components.artSyncJobProgress.stateFailed'),
    cancelled: t('components.artSyncJobProgress.stateCancelled'),
    'recovery-pending': t('components.artSyncJobProgress.stateRecoveryPending')
  }
  const completed =
    (job.counts.installed ?? 0) + (job.counts.skipped ?? 0) + (job.counts.failed ?? 0)
  const percent = job.items.length ? Math.round((completed / job.items.length) * 100) : 0
  return (
    <section aria-label={t('components.artSyncJobProgress.ariaLabel', { jobId: job.jobId }) ?? ''}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-violet-400/10 p-2 text-violet-300">
            <ImageDown className="size-5" />
          </span>
          <div>
            <p className="font-medium text-white">{stateLabel[job.state]}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('components.artSyncJobProgress.processed', {
                completed,
                total: job.items.length
              })}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-muted-foreground">
          {percent}%
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-black/30"
        role="progressbar"
        aria-label={t('components.artSyncJobProgress.ariaProgress') ?? ''}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="text-emerald-300">
          {t('components.artSyncJobProgress.installed', { count: job.counts.installed ?? 0 })}
        </span>
        <span>·</span>
        <span>
          {t('components.artSyncJobProgress.skipped', { count: job.counts.skipped ?? 0 })}
        </span>
        {(job.counts.failed ?? 0) > 0 ? (
          <>
            <span>·</span>
            <span className="text-red-300">
              {t('components.artSyncJobProgress.failed', { count: job.counts.failed })}
            </span>
          </>
        ) : null}
        <span className="flex-1" />
        {job.state === 'running' && onPause ? (
          <Button size="sm" variant="secondary" onClick={onPause}>
            <Pause className="size-3.5" />
            {t('components.artSyncJobProgress.pause')}
          </Button>
        ) : null}
        {job.state === 'paused' && onResume ? (
          <Button size="sm" onClick={onResume}>
            <Play className="size-3.5" />
            {t('components.artSyncJobProgress.resume')}
          </Button>
        ) : null}
        {(job.counts.failed ?? 0) > 0 && onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            {t('components.artSyncJobProgress.retryFailed')}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
