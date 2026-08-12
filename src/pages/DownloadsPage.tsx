import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Download, HardDrive, Layers3, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DownloadPipelineCard } from '@/components/downloads/DownloadPipelineCard'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { oplApi } from '@/services/api'
import { useDownloadStore } from '@/stores/download-store'
import { Select } from '@/components/ui/select'

export function DownloadsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [targetFilter, setTargetFilter] = useState<'all' | 'opl-device' | 'local-folder'>('all')
  const taskMap = useDownloadStore((state) => state.tasks)
  const tasks = useMemo(
    () =>
      Object.values(taskMap).filter(
        (task) => targetFilter === 'all' || task.target?.kind === targetFilter
      ),
    [targetFilter, taskMap]
  )
  const setSnapshot = useDownloadStore((state) => state.setSnapshot)
  const applyEvent = useDownloadStore((state) => state.applyEvent)
  const queue = useQuery({
    queryKey: ['durable-downloads'],
    queryFn: () => oplApi.listDownloads({ limit: 500 }),
    refetchInterval: 1000
  })
  useEffect(() => {
    if (!queue.data) return
    setSnapshot(queue.data)
  }, [queue.data, setSnapshot])
  useEffect(() => {
    return oplApi.onOplPipelineEvent((event) => {
      if (applyEvent(event)) void queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    })
  }, [applyEvent, queryClient])
  const executeAction = async (
    action: 'pause' | 'resume' | 'retry' | 'cancel',
    taskId: string,
    expectedRevision: number
  ) => {
    let reference = { taskId, expectedRevision }
    const invoke = async () => {
      if (action === 'pause') await oplApi.pauseDurableDownload(reference)
      if (action === 'resume') await oplApi.resumeDurableDownload(reference)
      if (action === 'retry') await oplApi.retryDurableDownload(reference)
      if (action === 'cancel')
        await oplApi.cancelDurableDownload({ ...reference, partialPolicy: 'keep-for-resume' })
    }
    try {
      await invoke()
    } catch (error) {
      if (!/stale/i.test((error as Error).message)) throw error
      const latest = await oplApi.getDurableDownload(taskId)
      if (!latest) throw error
      reference = { taskId, expectedRevision: latest.revision }
      await invoke()
    }
    await queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
  }
  const action = useMutation({
    mutationFn: ({
      kind,
      taskId,
      revision
    }: {
      kind: 'pause' | 'resume' | 'retry' | 'cancel'
      taskId: string
      revision: number
    }) => executeAction(kind, taskId, revision)
  })
  const resolveCollision = useMutation({
    mutationFn: ({
      taskId,
      action: collisionAction
    }: {
      taskId: string
      action: 'overwrite' | 'cancel'
    }) => oplApi.resolveDownloadCollision(taskId, collisionAction),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    }
  })
  const clearTerminal = useMutation({
    mutationFn: () =>
      oplApi.clearTerminalDownloads({
        expectedQueueRevision: queue.data?.revision ?? 0
      }),
    onSuccess: async () => {
      setClearConfirmOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    }
  })
  const active = tasks.filter(
    (task) => !['ready', 'failed', 'cancelled'].includes(task.phase)
  ).length
  const ready = tasks.filter((task) => task.phase === 'ready').length
  const terminal = tasks.filter((task) =>
    ['ready', 'failed', 'cancelled'].includes(task.phase)
  ).length
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-card/80 to-fuchsia-500/10 p-6 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-violet-500/20">
              <Download className="size-5 text-violet-200" />
            </div>
            <h2 className="text-2xl font-semibold text-white">{t('pages.downloads.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t('pages.downloads.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-2xl font-semibold text-white">{active}</p>
              <p className="text-xs text-muted-foreground">{t('pages.downloads.inProgress')}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-2xl font-semibold text-emerald-200">{ready}</p>
              <p className="text-xs text-muted-foreground">{t('pages.downloads.completed')}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-end gap-3">
          <div className="w-56 space-y-2">
            <label className="text-xs text-muted-foreground">
              {t('pages.downloads.showDownloads')}
            </label>
            <Select
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value as typeof targetFilter)}
            >
              <option value="all">{t('pages.downloads.filterAll')}</option>
              <option value="opl-device">{t('pages.downloads.filterOplDevice')}</option>
              <option value="local-folder">{t('pages.downloads.filterLocalFolder')}</option>
            </Select>
          </div>
        </div>
      </section>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HardDrive className="size-4 text-violet-300" /> {t('pages.downloads.allDestinations')}
        </span>
        <span className="flex items-center gap-1.5">
          <Layers3 className="size-4 text-violet-300" />{' '}
          {t('pages.downloads.taskCount', { count: tasks.length })}
        </span>
        {active ? (
          <span className="flex items-center gap-1.5 text-emerald-300">
            <Activity className="size-4" /> {t('pages.downloads.realtimeUpdate')}
          </span>
        ) : null}
        <Button
          className="ml-auto"
          size="sm"
          variant="secondary"
          disabled={terminal === 0 || clearTerminal.isPending}
          onClick={() => setClearConfirmOpen(true)}
        >
          <Trash2 className="size-4" /> {t('pages.downloads.clearFinished')}
        </Button>
      </div>
      {action.error ? (
        <Card className="border-red-400/25 bg-red-500/5 text-sm text-red-200" role="alert">
          {t('pages.downloads.actionError', { message: action.error.message })}
        </Card>
      ) : null}
      {tasks.length === 0 ? (
        <EmptyState
          icon={Download}
          title={t('pages.downloads.emptyQueueTitle')}
          description={t('pages.downloads.emptyQueueDescription')}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {tasks.map((task) => (
            <DownloadPipelineCard
              key={task.taskId}
              task={task}
              pending={action.isPending && action.variables?.taskId === task.taskId}
              onPause={() =>
                action.mutate({ kind: 'pause', taskId: task.taskId, revision: task.revision })
              }
              onResume={() =>
                action.mutate({ kind: 'resume', taskId: task.taskId, revision: task.revision })
              }
              onRetry={() =>
                action.mutate({ kind: 'retry', taskId: task.taskId, revision: task.revision })
              }
              onCancel={() =>
                action.mutate({ kind: 'cancel', taskId: task.taskId, revision: task.revision })
              }
              onResolveCollision={(collisionAction) =>
                resolveCollision.mutate({ taskId: task.taskId, action: collisionAction })
              }
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t('pages.downloads.clearHistoryTitle')}
        description={t('pages.downloads.clearHistoryDescription', { count: terminal })}
        confirmLabel={t('pages.downloads.clearRecords')}
        onConfirm={() => clearTerminal.mutate()}
      />
    </div>
  )
}
