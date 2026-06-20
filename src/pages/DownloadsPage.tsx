import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, FolderOpen, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useDownloadStore } from '@/stores/download-store'
import type { DownloadTask } from '@/types/opl'
import { formatBytes } from '@/utils/format'

const schema = z.object({
  source: z.enum(['torrent-url', 'torrent-file', 'magnet']),
  value: z.string().min(1, 'Informe uma URL, magnet link ou arquivo torrent.'),
  selectedFiles: z.string().optional()
})

type FormValues = z.infer<typeof schema>

function suggestDestination(task: DownloadTask) {
  const value = `${task.name} ${task.selectedFiles.join(' ')}`.toLowerCase()
  if (value.includes('.iso')) return '/DVD ou /CD'
  if (value.includes('.bin') || value.includes('.cue')) return '/PS1'
  if (value.includes('.zip') || value.includes('.7z')) return 'manter em staging para extracao manual'
  return 'revisar staging e escolher destino final'
}

export function DownloadsPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const tasks = useDownloadStore((state) => state.tasks)
  const setTasks = useDownloadStore((state) => state.setTasks)
  const upsertTask = useDownloadStore((state) => state.upsertTask)
  const progressByTask = useDownloadStore((state) => state.progressByTask)
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { source: 'magnet', value: '' } })

  const queueQuery = useQuery({ queryKey: ['downloads'], queryFn: oplApi.getDownloadQueue })
  useEffect(() => {
    if (queueQuery.data) setTasks(queueQuery.data)
  }, [queueQuery.data, setTasks])

  const addMutation = useMutation({
    mutationFn: (values: FormValues) =>
      oplApi.addP2PDownload({
        source: values.source,
        value: values.value,
        destinationPath: activeDevice!.path,
        selectedFiles: values.selectedFiles?.split('\n').map((item) => item.trim()).filter(Boolean)
      }),
    onSuccess: (task) => {
      upsertTask(task)
      form.reset({ source: 'magnet', value: '' })
    }
  })

  async function pickTorrentFile() {
    const [file] = await oplApi.openPathDialog({ mode: 'file', filters: [{ name: 'Torrent', extensions: ['torrent'] }] })
    if (file) {
      form.setValue('source', 'torrent-file')
      form.setValue('value', file)
    }
  }

  if (!activeDevice) {
    return <EmptyState icon={Download} title="Selecione um dispositivo" description="Escolha um dispositivo ativo para baixar em /_OPL_FORGE_STAGING/." />
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Download Manager</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fila P2P com staging em {activeDevice.path}/_OPL_FORGE_STAGING/.</p>
          </div>
          <Button variant="secondary" onClick={pickTorrentFile}><FolderOpen className="size-4" /> Arquivo .torrent</Button>
        </div>
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}>
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2"><Label>Tipo</Label><Select {...form.register('source')}><option value="magnet">Magnet</option><option value="torrent-url">URL .torrent</option><option value="torrent-file">Arquivo .torrent</option></Select></div>
            <div className="space-y-2"><Label>Origem</Label><Input {...form.register('value')} placeholder="magnet:?xt=... ou https://.../arquivo.torrent" /></div>
          </div>
          <div className="space-y-2"><Label>Arquivos selecionados (opcional, um por linha)</Label><textarea className="min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-violet-400" {...form.register('selectedFiles')} /></div>
          {form.formState.errors.value ? <p className="text-sm text-red-300">{form.formState.errors.value.message}</p> : null}
          <Button className="w-fit" disabled={addMutation.isPending}>Adicionar à fila</Button>
        </form>
      </Card>

      <div className="grid gap-4">
        {tasks.length === 0 ? <EmptyState icon={Download} title="Fila vazia" description="Adicione um torrent ou magnet para iniciar o download em staging." /> : null}
        {tasks.map((task) => {
          const progress = progressByTask[task.id]
          const percent = progress?.progress ?? 0
          return (
            <Card key={task.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-white">{task.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{task.status} - destino sugerido: {suggestDestination(task)}</p>
                  <p className="mt-1 text-xs text-white/40">{task.stagingPath}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => oplApi.pauseDownload(task.id)}><Pause className="size-4" /></Button>
                  <Button size="sm" variant="secondary" onClick={() => oplApi.resumeDownload(task.id)}><Play className="size-4" /></Button>
                  <Button size="sm" variant="secondary" onClick={() => oplApi.openFolder(task.stagingPath)}><FolderOpen className="size-4" /></Button>
                  <Button size="sm" variant="danger" onClick={() => oplApi.cancelDownload(task.id)}><Square className="size-4" /></Button>
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${percent}%` }} /></div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-5">
                <span>{percent}%</span>
                <span>{formatBytes(progress?.downloadedBytes ?? 0)} / {formatBytes(progress?.totalBytes ?? 0)}</span>
                <span>Down {formatBytes(progress?.downloadSpeed ?? 0)}/s</span>
                <span>Up {formatBytes(progress?.uploadSpeed ?? 0)}/s</span>
                <span>Peers {progress?.peers ?? 0}</span>
              </div>
              {task.status === 'completed' ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"><RotateCcw className="size-4" /> Reprocessar: abra a pasta staging, valide o arquivo e mova pelo importador PS2/PS1 conforme o tipo detectado.</div> : null}
              {progress?.error ? <p className="mt-3 text-sm text-red-300"><Trash2 className="mr-1 inline size-4" />{progress.error}</p> : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
