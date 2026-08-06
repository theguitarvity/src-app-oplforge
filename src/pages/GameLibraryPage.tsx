import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LibraryBig } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { GameLibraryTable } from '@/components/library/GameLibraryTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { CatalogItem, CatalogSnapshot } from '@/types/opl'

export function GameLibraryPage() {
  const device = useDeviceStore((state) => state.activeDevice)
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [hashes, setHashes] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const scan = useMutation({
    mutationFn: () => oplApi.scanCatalog({ devicePath: device!.path }),
    onSuccess: (value) => {
      setSnapshot(value)
      queryClient.setQueryData(['device-catalog', value.deviceId], value)
    }
  })
  useEffect(() => oplApi.onCatalogEvent(setSnapshot), [])
  useEffect(() => {
    if (device) scan.mutate()
  }, [device?.path]) // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(
    () =>
      (snapshot?.items ?? []).filter(
        (item) =>
          (status === 'all' || item.classification === status) &&
          `${item.title} ${item.gameId} ${item.relativePath}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [snapshot, search, status]
  )
  async function override(item: CatalogItem, gameId: string) {
    const file = item.files[0]
    if (!snapshot || !file) return
    await oplApi.setCatalogGameId({
      deviceId: snapshot.deviceId,
      relativePath: file.relativePath,
      size: file.sizeBytes,
      fingerprint: file.structuralSignature ?? '',
      gameId
    })
    scan.mutate()
  }
  async function hash(item: CatalogItem) {
    const file = item.files[0]
    if (!snapshot || !file) return
    setHashes({
      ...hashes,
      [item.itemId]: await oplApi.hashCatalogFile({
        deviceId: snapshot.deviceId,
        relativePath: file.relativePath
      })
    })
  }
  if (!device)
    return (
      <EmptyState
        icon={LibraryBig}
        title="Selecione um dispositivo"
        description="A leitura inicial é somente leitura e não altera a biblioteca existente."
      />
    )
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Biblioteca OPL</h2>
          <p className="text-sm text-muted-foreground">
            {snapshot?.status === 'provisional'
              ? 'Leitura em andamento; resultados provisórios.'
              : `${snapshot?.items.length ?? 0} itens catalogados`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate('/naming')}>
            Adequar nomes OPL
          </Button>
          <Button variant="secondary" onClick={() => navigate('/art-manager')}>
            Sincronizar artes
          </Button>
          <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
            Ler dispositivo
          </Button>
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar título, Game ID ou caminho"
        />
        <select
          className="rounded bg-black/30 px-3"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">Todos</option>
          <option value="ready">Prontos</option>
          <option value="warning">Com alertas</option>
          <option value="invalid">Inválidos</option>
        </select>
      </div>
      {scan.error ? (
        <p className="mb-3 text-red-300">
          Leitura falhou: {scan.error.message}. O último catálogo completo foi preservado.
        </p>
      ) : null}
      <GameLibraryTable
        items={items}
        onOverride={(item, id) => void override(item, id)}
        onHash={(item) => void hash(item)}
      />
      {Object.entries(hashes).map(([id, digest]) => (
        <p key={id} className="break-all text-xs text-muted-foreground">
          {id}: {digest}
        </p>
      ))}
    </Card>
  )
}
