import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, Download, HardDrive, Layers3, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DownloadPipelineCard } from '@/components/downloads/DownloadPipelineCard'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useDownloadStore } from '@/stores/download-store'

export function DownloadsPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const [source, setSource] = useState('')
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const taskMap = useDownloadStore((state) => state.tasks)
  const tasks = useMemo(
    () =>
      Object.values(taskMap).filter(
        (task) =>
          !activeDevice ||
          task.targetDeviceId === activeDevice.id ||
          task.targetDeviceId === activeDevice.path
      ),
    [activeDevice, taskMap]
  )
  const setSnapshot = useDownloadStore((state) => state.setSnapshot)
  const applyEvent = useDownloadStore((state) => state.applyEvent)
  const queue = useQuery({
    queryKey: ['durable-downloads'],
    queryFn: () => oplApi.listDownloads({ limit: 500 }),
    enabled: Boolean(activeDevice),
    refetchInterval: 1000
  })
  useEffect(() => {
    if (queue.data) setSnapshot(queue.data)
  }, [queue.data, setSnapshot])
  useEffect(() => {
    return oplApi.onOplPipelineEvent((event) => {
      if (applyEvent(event)) void queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    })
  }, [applyEvent, queryClient])
  const enqueue = useMutation({
    mutationFn: () =>
      oplApi.enqueueDownload({
        source: source.startsWith('magnet:')
          ? { kind: 'torrent', magnet: source }
          : { kind: 'http', url: source },
        deviceId: activeDevice!.id,
        profileId: 'opl-default'
      }),
    onSuccess: async () => {
      setSource('')
      await queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    }
  })
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
  if (!activeDevice)
    return (
      <EmptyState
        icon={Download}
        title="Selecione um dispositivo"
        description="Escolha o dispositivo de destino da fila durável."
      />
    )
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
            <h2 className="text-2xl font-semibold text-white">Central de downloads</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Downloads retomáveis em cache local, com instalação OPL segura e serializada no
              dispositivo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-2xl font-semibold text-white">{active}</p>
              <p className="text-xs text-muted-foreground">em andamento</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-2xl font-semibold text-emerald-200">{ready}</p>
              <p className="text-xs text-muted-foreground">concluídos</p>
            </div>
          </div>
        </div>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            enqueue.mutate()
          }}
        >
          <Input
            aria-label="URL ou magnet"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Cole uma URL HTTP do seu backup"
          />
          <Button disabled={!source || enqueue.isPending}>
            {enqueue.isPending ? 'Adicionando…' : 'Adicionar à fila'}
          </Button>
        </form>
        {enqueue.error ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {enqueue.error.message}
          </p>
        ) : null}
      </section>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HardDrive className="size-4 text-violet-300" /> {activeDevice.name}
        </span>
        <span className="flex items-center gap-1.5">
          <Layers3 className="size-4 text-violet-300" /> {tasks.length} tarefa(s)
        </span>
        {active ? (
          <span className="flex items-center gap-1.5 text-emerald-300">
            <Activity className="size-4" /> Atualização em tempo real
          </span>
        ) : null}
        <Button
          className="ml-auto"
          size="sm"
          variant="secondary"
          disabled={terminal === 0 || clearTerminal.isPending}
          onClick={() => setClearConfirmOpen(true)}
        >
          <Trash2 className="size-4" /> Limpar finalizados
        </Button>
      </div>
      {action.error ? (
        <Card className="border-red-400/25 bg-red-500/5 text-sm text-red-200" role="alert">
          Não foi possível executar a ação: {action.error.message}
        </Card>
      ) : null}
      {tasks.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Fila vazia"
          description="Downloads persistidos aparecerão aqui mesmo após reiniciar o Forge."
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
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Limpar histórico de downloads?"
        description={`Remover ${terminal} tarefa(s) concluída(s), cancelada(s) ou com falha desta lista. Downloads em andamento e arquivos instalados não serão alterados.`}
        confirmLabel="Limpar registros"
        onConfirm={() => clearTerminal.mutate()}
      />
    </div>
  )
}
