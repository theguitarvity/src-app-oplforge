import { ImageDown, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ArtSyncJob } from '../../types/opl-finalization'

const stateLabel: Record<ArtSyncJob['state'], string> = {
  queued: 'Na fila',
  running: 'Sincronizando',
  paused: 'Pausado',
  completed: 'Concluído',
  partial: 'Concluído parcialmente',
  failed: 'Com falhas',
  cancelled: 'Cancelado',
  'recovery-pending': 'Recuperação pendente'
}

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
  const completed =
    (job.counts.installed ?? 0) + (job.counts.skipped ?? 0) + (job.counts.failed ?? 0)
  const percent = job.items.length ? Math.round((completed / job.items.length) * 100) : 0
  return (
    <section aria-label={`Sincronização de artes ${job.jobId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-violet-400/10 p-2 text-violet-300">
            <ImageDown className="size-5" />
          </span>
          <div>
            <p className="font-medium text-white">{stateLabel[job.state]}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {completed} de {job.items.length} artes processadas
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
        aria-label="Progresso das artes"
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
        <span className="text-emerald-300">{job.counts.installed ?? 0} instaladas</span>
        <span>·</span>
        <span>{job.counts.skipped ?? 0} preservadas</span>
        {(job.counts.failed ?? 0) > 0 ? (
          <>
            <span>·</span>
            <span className="text-red-300">{job.counts.failed} falhas</span>
          </>
        ) : null}
        <span className="flex-1" />
        {job.state === 'running' && onPause ? (
          <Button size="sm" variant="secondary" onClick={onPause}>
            <Pause className="size-3.5" />
            Pausar
          </Button>
        ) : null}
        {job.state === 'paused' && onResume ? (
          <Button size="sm" onClick={onResume}>
            <Play className="size-3.5" />
            Retomar
          </Button>
        ) : null}
        {(job.counts.failed ?? 0) > 0 && onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            Tentar falhas
          </Button>
        ) : null}
      </div>
    </section>
  )
}
