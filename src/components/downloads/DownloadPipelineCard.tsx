import { AlertTriangle, CheckCircle2, Download, Pause, Play, RotateCcw, X } from 'lucide-react'
import type { DurableDownloadTaskSummary } from '../../types/opl-finalization'
import { formatBytes } from '../../utils/format'
import { Button } from '@/components/ui/button'
import { cn } from '@/utils/cn'

const phaseLabel: Record<string, string> = {
  queued: 'Na fila',
  probing: 'Conectando',
  transferring: 'Baixando',
  downloaded: 'Download concluído',
  validating: 'Validando imagem',
  planning: 'Preparando instalação',
  installing: 'Instalando no dispositivo',
  promoting: 'Movendo para a pasta local',
  verifying: 'Verificando',
  cataloging: 'Atualizando catálogo',
  'queueing-art': 'Preparando artes',
  ready: 'Pronto para o OPL',
  paused: 'Pausado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  'waiting-device': 'Aguardando dispositivo'
}

function friendlyError(code: string, phase?: string) {
  if (code === 'INVALID_PHASE_TRANSITION' && phase === 'verifying')
    return {
      title: 'O arquivo foi baixado e verificado',
      message:
        'O Forge encontrou um problema antigo ao atualizar o status. Clique em “Tentar novamente” para concluir sem baixar o arquivo outra vez.'
    }
  if (code === 'LOCAL_COLLISION')
    return {
      title: 'Já existe um arquivo com esse nome',
      message: 'Escolha outra pasta ou use a opção de renomear com sufixo.'
    }
  if (code === 'LOCAL_ROOT_CHANGED' || code === 'LOCAL_ROOT_UNAUTHORIZED')
    return {
      title: 'A pasta de destino não está disponível',
      message: 'Selecione novamente a pasta onde o jogo deve ser salvo.'
    }
  if (code === 'DEVICE_NOT_FOUND')
    return {
      title: 'Dispositivo desconectado',
      message: 'Reconecte o dispositivo para continuar este download.'
    }
  if (code === 'ENOSPC')
    return { title: 'Espaço insuficiente', message: 'Libere espaço no destino e tente novamente.' }
  return {
    title: 'Não foi possível concluir o download',
    message: 'Tente novamente. Se o problema continuar, consulte os detalhes de atividade.'
  }
}

export function DownloadPipelineCard({
  task,
  pending,
  onPause,
  onResume,
  onRetry,
  onCancel
}: {
  task: DurableDownloadTaskSummary
  pending?: boolean
  onPause?(): void
  onResume?(): void
  onRetry?(): void
  onCancel?(): void
}) {
  const progress = Math.max(0, Math.min(100, task.overallProgress))
  const transferring = task.phase === 'transferring'
  const terminal = ['ready', 'cancelled'].includes(task.phase)
  return (
    <article
      aria-label={`Download ${task.requestedTitle}`}
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            {phaseLabel[task.phase] ?? task.phase}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {task.target?.kind === 'local-folder' ? 'Este computador' : 'Dispositivo OPL'}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-violet-100">
          {Math.round(progress)}%
        </span>
      </div>
      <div
        className="mt-5 h-2 overflow-hidden rounded-full bg-black/35"
        role="progressbar"
        aria-label="Progresso total"
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
          {task.transfer.totalBytes ? ` de ${formatBytes(task.transfer.totalBytes)}` : ''}
        </span>
        <span>
          {transferring ? `${Math.round(task.phaseProgress)}% do download` : phaseLabel[task.phase]}
        </span>
      </div>
      {task.lastError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-sm"
        >
          <p className="font-medium text-red-200">
            {friendlyError(task.lastError.code, task.lastError.phase).title}
          </p>
          <p className="mt-1 text-red-200/80">
            {task.lastError.action ??
              friendlyError(task.lastError.code, task.lastError.phase).message}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {!['paused', 'ready', 'failed', 'cancelled'].includes(task.phase) && onPause ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={onPause}>
            <Pause className="size-4" /> Pausar
          </Button>
        ) : null}
        {task.phase === 'paused' && onResume ? (
          <Button size="sm" disabled={pending} onClick={onResume}>
            <Play className="size-4" /> Retomar
          </Button>
        ) : null}
        {task.phase === 'failed' && task.lastError?.retryable && onRetry ? (
          <Button size="sm" disabled={pending} onClick={onRetry}>
            <RotateCcw className="size-4" /> Tentar novamente
          </Button>
        ) : null}
        {!terminal && onCancel ? (
          <Button size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
            <X className="size-4" /> Cancelar
          </Button>
        ) : null}
      </div>
    </article>
  )
}
