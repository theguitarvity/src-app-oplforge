import { AlertTriangle, CheckCircle2, Download, Pause, Play, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { DurableDownloadTaskSummary } from '../../types/opl-finalization'
import { formatBytes } from '../../utils/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

function phaseLabel(t: TFunction, phase: string): string {
  const map: Record<string, string> = {
    queued: t('components.downloadPipelineCard.phaseQueued'),
    probing: t('components.downloadPipelineCard.phaseProbing'),
    transferring: t('components.downloadPipelineCard.phaseTransferring'),
    downloaded: t('components.downloadPipelineCard.phaseDownloaded'),
    validating: t('components.downloadPipelineCard.phaseValidating'),
    planning: t('components.downloadPipelineCard.phasePlanning'),
    'awaiting-confirmation': t('components.downloadPipelineCard.phaseAwaitingConfirmation'),
    installing: t('components.downloadPipelineCard.phaseInstalling'),
    promoting: t('components.downloadPipelineCard.phasePromoting'),
    verifying: t('components.downloadPipelineCard.phaseVerifying'),
    cataloging: t('components.downloadPipelineCard.phaseCataloging'),
    'queueing-art': t('components.downloadPipelineCard.phaseQueueingArt'),
    ready: t('components.downloadPipelineCard.phaseReady'),
    paused: t('components.downloadPipelineCard.phasePaused'),
    failed: t('components.downloadPipelineCard.phaseFailed'),
    cancelled: t('components.downloadPipelineCard.phaseCancelled'),
    'waiting-device': t('components.downloadPipelineCard.phaseWaitingDevice')
  }
  return map[phase] ?? phase
}

function friendlyError(t: TFunction, code: string, phase?: string) {
  if (code === 'INVALID_PHASE_TRANSITION' && phase === 'verifying')
    return {
      title: t('components.downloadPipelineCard.errorVerifiedTitle'),
      message: t('components.downloadPipelineCard.errorVerifiedMessage')
    }
  if (code === 'LOCAL_COLLISION')
    return {
      title: t('components.downloadPipelineCard.errorCollisionTitle'),
      message: t('components.downloadPipelineCard.errorCollisionMessage')
    }
  if (code === 'LOCAL_ROOT_CHANGED' || code === 'LOCAL_ROOT_UNAUTHORIZED')
    return {
      title: t('components.downloadPipelineCard.errorRootChangedTitle'),
      message: t('components.downloadPipelineCard.errorRootChangedMessage')
    }
  if (code === 'DEVICE_NOT_FOUND')
    return {
      title: t('components.downloadPipelineCard.errorDeviceNotFoundTitle'),
      message: t('components.downloadPipelineCard.errorDeviceNotFoundMessage')
    }
  if (code === 'ENOSPC')
    return {
      title: t('components.downloadPipelineCard.errorNoSpaceTitle'),
      message: t('components.downloadPipelineCard.errorNoSpaceMessage')
    }
  return {
    title: t('components.downloadPipelineCard.errorGenericTitle'),
    message: t('components.downloadPipelineCard.errorGenericMessage')
  }
}

export function DownloadPipelineCard({
  task,
  pending,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onResolveCollision
}: {
  task: DurableDownloadTaskSummary
  pending?: boolean
  onPause?(): void
  onResume?(): void
  onRetry?(): void
  onCancel?(): void
  onResolveCollision?(action: 'overwrite' | 'cancel'): void
}) {
  const { t } = useTranslation()
  const progress = Math.max(0, Math.min(100, task.overallProgress))
  const transferring = task.phase === 'transferring'
  const terminal = ['ready', 'cancelled'].includes(task.phase)
  return (
    <article
      aria-label={
        t('components.downloadPipelineCard.ariaLabel', { title: task.requestedTitle }) ?? ''
      }
      className="group rounded-2xl border border-white/10 bg-card/75 p-5 shadow-xl shadow-black/10 transition hover:border-violet-400/20"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            task.phase === 'ready'
              ? 'bg-emerald-500/15 text-emerald-300'
              : task.phase === 'failed'
                ? 'bg-red-500/15 text-red-300'
                : 'bg-violet-500/15 text-violet-200'
          )}
        >
          {task.phase === 'ready' ? (
            <CheckCircle2 className="size-5" />
          ) : task.phase === 'failed' ? (
            <AlertTriangle className="size-5" />
          ) : (
            <Download className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-white" title={task.requestedTitle}>
            {task.requestedTitle}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{phaseLabel(t, task.phase)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {task.target?.kind === 'local-folder'
              ? t('components.downloadPipelineCard.targetLocalFolder')
              : t('components.downloadPipelineCard.targetOplDevice')}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-violet-100">
          {Math.round(progress)}%
        </span>
      </div>
      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-black/35"
        role="progressbar"
        aria-label={t('components.downloadPipelineCard.ariaTotalProgress') ?? ''}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300',
            task.phase === 'failed'
              ? 'bg-red-400'
              : task.phase === 'ready'
                ? 'bg-emerald-400'
                : 'bg-gradient-to-r from-violet-500 to-fuchsia-400'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>
          {formatBytes(task.transfer.bytesConfirmed)}
          {task.transfer.totalBytes
            ? t('components.downloadPipelineCard.ofTotal', {
                value: formatBytes(task.transfer.totalBytes)
              })
            : ''}
        </span>
        <span>
          {transferring
            ? t('components.downloadPipelineCard.percentOfDownload', {
                percent: Math.round(task.phaseProgress)
              })
            : phaseLabel(t, task.phase)}
        </span>
      </div>
      {task.lastError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-sm"
        >
          <p className="font-medium text-red-200">
            {friendlyError(t, task.lastError.code, task.lastError.phase).title}
          </p>
          <p className="mt-1 text-red-200/80">
            {task.lastError.action ??
              friendlyError(t, task.lastError.code, task.lastError.phase).message}
          </p>
        </div>
      ) : null}
      {task.phase === 'awaiting-confirmation' ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 text-sm"
        >
          <p className="font-medium text-amber-200">
            {t('components.downloadPipelineCard.existingTitleWarning')}
          </p>
          <p className="mt-1 text-amber-200/80">
            {t('components.downloadPipelineCard.overwriteWarning', {
              title: task.requestedTitle
            })}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => onResolveCollision?.('cancel')}
            >
              {t('components.downloadPipelineCard.cancel')}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => onResolveCollision?.('overwrite')}
            >
              {t('components.downloadPipelineCard.overwrite')}
            </Button>
          </div>
        </div>
      ) : null}
      {task.phase !== 'awaiting-confirmation' ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {!['paused', 'ready', 'failed', 'cancelled'].includes(task.phase) && onPause ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={onPause}>
              <Pause className="size-4" /> {t('components.downloadPipelineCard.pause')}
            </Button>
          ) : null}
          {task.phase === 'paused' && onResume ? (
            <Button size="sm" disabled={pending} onClick={onResume}>
              <Play className="size-4" /> {t('components.downloadPipelineCard.resume')}
            </Button>
          ) : null}
          {task.phase === 'failed' && task.lastError?.retryable && onRetry ? (
            <Button size="sm" disabled={pending} onClick={onRetry}>
              <RotateCcw className="size-4" /> {t('components.downloadPipelineCard.retry')}
            </Button>
          ) : null}
          {!terminal && onCancel ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
              <X className="size-4" /> {t('components.downloadPipelineCard.cancel')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
