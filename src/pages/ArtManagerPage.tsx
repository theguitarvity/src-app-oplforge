import { useMutation, useQuery } from '@tanstack/react-query'
import { Disc3, Image, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ArtPreviewGrid } from '@/components/art/ArtPreviewGrid'
import { ArtStatusBadge } from '@/components/art/ArtStatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

export function ArtManagerPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const [gameId, setGameId] = useState('')
  const [title, setTitle] = useState('')
  const artQuery = useQuery({ queryKey: ['oplm-art-index'], queryFn: oplApi.indexOplmArt, enabled: false })
  const installMutation = useMutation({ mutationFn: () => oplApi.installArtForGame(activeDevice!.path, gameId, title || gameId) })
  const syncDvdMutation = useMutation({ mutationFn: () => oplApi.syncDvdArts(activeDevice!.path) })
  const filtered = useMemo(() => (artQuery.data ?? []).filter((asset) => !gameId || asset.gameId.includes(gameId.toUpperCase())), [artQuery.data, gameId])

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-2xl font-semibold text-white">ART Downloader OPLM</h2><p className="mt-1 text-sm text-muted-foreground">Indexa OPLM_ART_2024_09 e copia assets COV, COV2, LAB, ICO, SCR, SCR2, BG e LGO para /ART.</p></div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!activeDevice || syncDvdMutation.isPending} onClick={() => syncDvdMutation.mutate()}><Disc3 className="size-4" /> Sincronizar /DVD</Button>
            <Button onClick={() => void artQuery.refetch()}><Search className="size-4" /> Indexar ART pack</Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto]">
          <div className="space-y-2"><Label>Game ID</Label><Input value={gameId} onChange={(event) => setGameId(event.target.value)} placeholder="SLUS_209.46" /></div>
          <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título opcional" /></div>
          <div className="flex items-end"><Button disabled={!activeDevice || !gameId || installMutation.isPending} onClick={() => installMutation.mutate()}>Instalar artes</Button></div>
        </div>
        {installMutation.data ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"><ArtStatusBadge status={installMutation.data.status} /><span className="text-sm text-muted-foreground">{installMutation.data.copied.length} asset(s) copiados para /ART.</span></div> : null}
        {syncDvdMutation.data ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-medium text-white">
              DVD lido: {syncDvdMutation.data.scannedGames} jogo(s), {syncDvdMutation.data.updatedGames} atualizado(s), {syncDvdMutation.data.missingGameIds} sem Game ID.
            </p>
            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {syncDvdMutation.data.entries.map((entry) => (
                <div key={entry.path} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-white">{entry.title || entry.path}</p>
                    <p className="text-xs text-muted-foreground">{entry.gameId ?? 'Game ID não identificado'} - {entry.message}</p>
                  </div>
                  <ArtStatusBadge status={entry.status} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
      {!activeDevice ? <EmptyState icon={Image} title="Selecione um dispositivo" description="Escolha um HD/USB ativo para copiar artes para /ART." /> : null}
      <Card><p className="mb-4 text-sm text-muted-foreground">Assets indexados: {artQuery.data?.length ?? 0}. Mostrando {filtered.length}.</p><ArtPreviewGrid assets={filtered} /></Card>
    </div>
  )
}
