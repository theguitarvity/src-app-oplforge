import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CatalogGameCard } from '@/components/catalog/CatalogGameCard'
import { DownloadPlanModal } from '@/components/catalog/DownloadPlanModal'
import { LegalConfirmationModal } from '@/components/catalog/LegalConfirmationModal'
import { SmartFillButton } from '@/components/catalog/SmartFillButton'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useDownloadStore } from '@/stores/download-store'
import type { CatalogGame, CatalogQuery, SmartFillPlan } from '@/types/opl'
import { formatBytes } from '@/utils/format'

export function EssentialsCatalogPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const upsertTask = useDownloadStore((state) => state.upsertTask)
  const queryClient = useQueryClient()
  const [query, setQuery] = useState<CatalogQuery>({
    search: '',
    tier: 'all',
    mediaType: 'all',
    priority: 'all'
  })
  const [selected, setSelected] = useState<CatalogGame[]>([])
  const [plan, setPlan] = useState<SmartFillPlan | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)

  const catalogQuery = useQuery({
    queryKey: ['essentials-catalog', query],
    queryFn: () => oplApi.listEssentialsCatalog(query)
  })
  const smartFillMutation = useMutation({
    mutationFn: () => oplApi.createSmartFillPlan(activeDevice!.path, 500 * 1000 ** 3),
    onSuccess: (nextPlan) => {
      setPlan(nextPlan)
      setPlanOpen(true)
    }
  })
  const refreshLinksMutation = useMutation({
    mutationFn: oplApi.refreshEssentialsSourceLinks,
    onSuccess: () => void catalogQuery.refetch()
  })
  const addMutation = useMutation({
    mutationFn: (confirmation: string) =>
      oplApi.addCatalogGamesToQueue({
        devicePath: activeDevice!.path,
        games: selected,
        legalConfirmationText: confirmation
      }),
    onSuccess: async (tasks) => {
      tasks.forEach(upsertTask)
      setSelected([])
      setLegalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    }
  })

  const totalSelected = useMemo(
    () => selected.reduce((total, game) => total + (game.sizeBytes ?? 0), 0),
    [selected]
  )

  function toggle(game: CatalogGame) {
    setSelected((current) =>
      current.some((item) => item.id === game.id)
        ? current.filter((item) => item.id !== game.id)
        : [game, ...current]
    )
  }

  function usePlan() {
    if (!plan) return
    setSelected(plan.selectedGames)
    setPlanOpen(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Essentials Catalog</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fontes pré-configuradas: Internet Archive - PlayStation 2 Essentials (Partes 1 e 2),
              reunidas em uma única lista.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={refreshLinksMutation.isPending}
              onClick={() => refreshLinksMutation.mutate()}
            >
              <RefreshCw className="size-4" /> Verificar links
            </Button>
            <SmartFillButton
              disabled={!activeDevice || smartFillMutation.isPending}
              onClick={() => smartFillMutation.mutate()}
            />
            <Button
              disabled={!activeDevice || selected.length === 0}
              onClick={() => setLegalOpen(true)}
            >
              <Download className="size-4" /> Adicionar selecionados
            </Button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_150px_170px_180px_auto]">
          <div className="space-y-2">
            <Label>Busca</Label>
            <Input
              value={query.search ?? ''}
              onChange={(event) =>
                setQuery((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Buscar jogo"
            />
          </div>
          <div className="space-y-2">
            <Label>Tier</Label>
            <Select
              value={query.tier}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  tier: event.target.value as CatalogQuery['tier']
                }))
              }
            >
              <option value="all">Todos</option>
              <option value="S">S</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="Unrated">Unrated</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mídia</Label>
            <Select
              value={query.mediaType}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  mediaType: event.target.value as CatalogQuery['mediaType']
                }))
              }
            >
              <option value="all">Todas</option>
              <option value="ps2-dvd">PS2 DVD</option>
              <option value="ps2-cd">PS2 CD</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={query.priority}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  priority: event.target.value as CatalogQuery['priority']
                }))
              }
            >
              <option value="all">Todas</option>
              <option value="must-have">Must-have</option>
              <option value="recommended">Recommended</option>
              <option value="unrated">Unrated</option>
            </Select>
          </div>
          <Button variant="secondary" onClick={() => void catalogQuery.refetch()}>
            <Search className="size-4" /> Atualizar
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
          Selecionados: {selected.length} - espaço estimado: {formatBytes(totalSelected)}
          {refreshLinksMutation.data
            ? ` - links acessíveis: ${refreshLinksMutation.data.links.filter((link) => link.accessible).length}/${refreshLinksMutation.data.links.length}`
            : ''}
        </div>
      </Card>

      {!activeDevice ? (
        <EmptyState
          icon={Download}
          title="Selecione um dispositivo"
          description="Escolha um HD/USB ativo para gerar plano e adicionar downloads à fila."
        />
      ) : null}
      {catalogQuery.isLoading ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Carregando catálogo do Internet Archive...
          </p>
        </Card>
      ) : null}
      {catalogQuery.isError ? (
        <Card className="border-red-400/20 bg-red-500/10">
          <p className="text-sm text-red-200">
            Não foi possível carregar o catálogo. Verifique a conexão e tente “Atualizar”.
          </p>
        </Card>
      ) : null}
      {!catalogQuery.isLoading &&
      !catalogQuery.isError &&
      (catalogQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum jogo encontrado"
          description="Tente limpar os filtros ou clique em Verificar links para regenerar o índice local."
        />
      ) : null}
      <div className="grid gap-4">
        {(catalogQuery.data ?? []).map((game) => (
          <CatalogGameCard
            key={game.id}
            game={game}
            selected={selected.some((item) => item.id === game.id)}
            onToggle={() => toggle(game)}
          />
        ))}
      </div>
      <DownloadPlanModal
        open={planOpen}
        plan={plan}
        onOpenChange={setPlanOpen}
        onUsePlan={usePlan}
      />
      <LegalConfirmationModal
        open={legalOpen}
        games={selected}
        onOpenChange={setLegalOpen}
        onConfirm={(text) => addMutation.mutate(text)}
      />
    </div>
  )
}
