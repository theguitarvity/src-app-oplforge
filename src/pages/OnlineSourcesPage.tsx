import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, FileArchive, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useDownloadStore } from '@/stores/download-store'
import type { RemoteFile, RemoteSearchResult } from '@/types/opl'
import { formatBytes } from '@/utils/format'

export function OnlineSourcesPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const upsertTask = useDownloadStore((state) => state.upsertTask)
  const [query, setQuery] = useState('')
  const [creator, setCreator] = useState('')
  const [collection, setCollection] = useState('')
  const [kind, setKind] = useState('')
  const [selected, setSelected] = useState<RemoteSearchResult | null>(null)

  const searchQuery = useQuery({
    queryKey: ['remote-search', query, creator, collection],
    queryFn: () => oplApi.searchRemoteSource({ query, creator, collection, limit: 24 }),
    enabled: false
  })

  const detailsQuery = useQuery({
    queryKey: ['remote-details', selected?.id],
    queryFn: () => oplApi.getRemoteItemDetails(selected!.id),
    enabled: Boolean(selected)
  })

  const addMutation = useMutation({
    mutationFn: (file: RemoteFile) => {
      if (!activeDevice) throw new Error('Selecione um dispositivo.')
      const torrentUrl = file.kind === 'torrent' ? file.url : file.torrentUrl
      if (!file.magnetUri && !torrentUrl) throw new Error('Arquivo remoto sem torrent ou magnet disponivel.')
      return oplApi.addP2PDownload({
        source: file.magnetUri ? 'magnet' : 'torrent-url',
        value: file.magnetUri ?? torrentUrl!,
        destinationPath: activeDevice.path,
        selectedFiles: file.kind === 'torrent' ? undefined : [file.name]
      })
    },
    onSuccess: upsertTask
  })

  const files = (detailsQuery.data?.files ?? []).filter((file) => (kind ? file.kind === kind : true))

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card className="h-fit">
        <h2 className="text-2xl font-semibold text-white">Fontes Online</h2>
        <p className="mt-1 text-sm text-muted-foreground">Pesquise fontes remotas configuradas e adicione arquivos suportados à fila P2P.</p>
        <div className="mt-5 grid gap-3">
          <div className="space-y-2"><Label>Busca</Label><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Termo de busca" /></div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2"><Label>Creator</Label><Input value={creator} onChange={(event) => setCreator(event.target.value)} /></div>
            <div className="space-y-2"><Label>Collection</Label><Input value={collection} onChange={(event) => setCollection(event.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Tipo de arquivo</Label><Select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">Todos</option><option value="iso">ISO</option><option value="bin">BIN</option><option value="cue">CUE</option><option value="archive">ZIP/7Z</option><option value="torrent">Torrent</option></Select></div>
          <Button onClick={() => void searchQuery.refetch()}><Search className="size-4" /> Pesquisar</Button>
        </div>

        <div className="mt-5 space-y-2">
          {(searchQuery.data ?? []).map((result) => (
            <button key={result.id} className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10" onClick={() => setSelected(result)}>
              <p className="font-medium text-white">{result.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{result.creator ?? result.source}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        {!selected ? <div className="grid min-h-96 place-items-center text-center text-muted-foreground"><div><FileArchive className="mx-auto mb-3 size-8 text-violet-200" />Selecione um resultado para ver detalhes e arquivos.</div></div> : null}
        {selected ? (
          <div>
            <div className="flex gap-4">
              {selected.thumbnailUrl ? <img src={selected.thumbnailUrl} alt="" className="size-28 rounded-2xl object-cover" /> : null}
              <div>
                <h3 className="text-xl font-semibold text-white">{detailsQuery.data?.title ?? selected.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{detailsQuery.data?.description ?? selected.description}</p>
                <a className="mt-2 inline-block text-sm text-violet-200" href={selected.url} target="_blank" rel="noreferrer">Abrir detalhes da fonte</a>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {files.map((file) => (
                <div key={file.name} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div><p className="font-medium text-white">{file.name}</p><p className="text-xs text-muted-foreground">{file.kind} - {file.format ?? 'sem formato'} - {formatBytes(file.size ?? 0)}</p></div>
                  <Button disabled={!activeDevice || addMutation.isPending || (!file.magnetUri && !file.torrentUrl && file.kind !== 'torrent')} onClick={() => addMutation.mutate(file)}><Download className="size-4" /> Adicionar à fila</Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
